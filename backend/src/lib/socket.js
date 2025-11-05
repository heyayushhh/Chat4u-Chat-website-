import { Server } from "socket.io";
import http from "http";
import express from "express";
import Group from "../models/group.model.js";
import Call from "../models/call.model.js";
import GroupCall from "../models/groupCall.model.js";
import { logger } from "./logger.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
  },
});

export function getReceiverSocketId(userId) {
  const set = userSocketMap.get(String(userId));
  // Return any active socketId for the user (prefer the most recently added)
  if (!set || set.size === 0) return undefined;
  const arr = Array.from(set);
  return arr[arr.length - 1];
}

// Track all active socket connections per user
// Map<userId, Set<socketId>> so multiple tabs/windows remain mapped reliably
const userSocketMap = new Map();

io.on("connection", (socket) => {
  logger.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) {
    const key = String(userId);
    const existing = userSocketMap.get(key) || new Set();
    existing.add(socket.id);
    userSocketMap.set(key, existing);
    // Also join a room named by userId for future broadcasts if needed
    try { socket.join(key); } catch {}
  }

  // io.emit() is used to send events to all the connected clients
  io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));

  // --- Call & WebRTC signaling ---
  socket.on("call:request", async ({ toUserId, fromUser, callType, offer }) => {
    const receiverSocketId = getReceiverSocketId(toUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call:incoming", { fromUser, callType, offer });
    }

    // Log call start (ringing)
    try {
      await Call.create({
        callerId: fromUser._id,
        calleeId: toUserId,
        type: callType === "video" ? "video" : "audio",
        status: "ringing",
      });
    } catch (e) {
      // ignore logging errors
    }
  });

  socket.on("call:accepted", async ({ toUserId, answer }) => {
    const receiverSocketId = getReceiverSocketId(toUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call:accepted", { answer });
    }

    // Mark latest ringing call as active
    try {
      const callerId = socket.handshake.query.userId; // the accepting user is callee in prior record
      const calleeId = toUserId;
      const latest = await Call.findOne({
        callerId: calleeId, // original caller
        calleeId: callerId, // original callee (me)
        status: { $in: ["ringing"] },
      }).sort({ createdAt: -1 });
      if (latest) {
        latest.status = "active";
        latest.startedAt = new Date();
        await latest.save();
      }
    } catch (e) {
      // ignore logging errors
    }
  });

  socket.on("call:declined", async ({ toUserId }) => {
    const receiverSocketId = getReceiverSocketId(toUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call:declined");
    }

    // Mark latest ringing call as missed
    try {
      const calleeId = socket.handshake.query.userId; // decliner is callee
      const callerId = toUserId; // original caller
      const latest = await Call.findOne({ callerId, calleeId, status: { $in: ["ringing", "active"] } }).sort({ createdAt: -1 });
      if (latest) {
        latest.status = "missed";
        latest.endedAt = new Date();
        await latest.save();
      }
    } catch (e) {
      // ignore logging errors
    }
  });

  socket.on("call:end", async ({ toUserId }) => {
    const receiverSocketId = getReceiverSocketId(toUserId);
    if (receiverSocketId) {
      // Include the ender's userId so the client can scope UI updates
      io.to(receiverSocketId).emit("call:end", { fromUserId: socket.handshake.query.userId });
    }

    // Complete the latest call between the two users
    try {
      const enderId = socket.handshake.query.userId;
      const otherId = toUserId;
      const latest = await Call.findOne({
        $or: [
          { callerId: enderId, calleeId: otherId },
          { callerId: otherId, calleeId: enderId },
        ],
        status: { $in: ["ringing", "active"] },
      }).sort({ createdAt: -1 });
      if (latest) {
        const now = new Date();
        latest.endedAt = now;
        if (latest.startedAt) {
          latest.status = "completed";
          latest.durationSeconds = Math.max(0, Math.floor((now - latest.startedAt) / 1000));
        } else {
          latest.status = "missed";
        }
        await latest.save();
      }
    } catch (e) {
      // ignore logging errors
    }
  });

  // --- Group call signaling ---
  socket.on("group:call:request", async ({ groupId, fromUser, callType }) => {
    try {
      const group = await Group.findById(groupId).select("members");
      if (!group) return;
      // create call record and mark initiator as active immediately
      await GroupCall.create({
        groupId,
        initiatorId: fromUser._id,
        type: callType === "video" ? "video" : "audio",
        status: "active",
        startedAt: new Date(),
        participantsAccepted: [fromUser._id],
        participantsActive: [fromUser._id],
      });
      // notify all members except initiator
      for (const uid of group.members) {
        const idStr = String(uid);
        if (idStr === String(fromUser._id)) continue;
        const sockId = getReceiverSocketId(idStr);
        if (sockId) {
          io.to(sockId).emit("group:call:incoming", { groupId, fromUser, callType });
        }
      }
    } catch (e) {
      // ignore
    }
  });

  socket.on("group:call:accepted", async ({ groupId, user }) => {
    try {
      const latest = await GroupCall.findOne({ groupId }).sort({ createdAt: -1 });
      if (latest) {
        if (!latest.startedAt) {
          latest.status = "active";
          latest.startedAt = new Date();
        }
        const uid = user?._id || socket.handshake.query.userId;
        if (uid && !latest.participantsAccepted.map(String).includes(String(uid))) {
          latest.participantsAccepted.push(uid);
        }
        // mark user active
        const uidStr = String(uid);
        if (uidStr && !latest.participantsActive.map(String).includes(uidStr)) {
          latest.participantsActive.push(uidStr);
        }
        await latest.save();
      }
      // notify group members of acceptance
      const group = await Group.findById(groupId).select("members");
      for (const uid of group.members) {
        const sockId = getReceiverSocketId(String(uid));
        if (sockId) io.to(sockId).emit("group:call:participant-joined", { groupId, user });
      }
    } catch (e) {}
  });

  socket.on("group:call:declined", async ({ groupId, user }) => {
    try {
      const group = await Group.findById(groupId).select("members");
      for (const uid of group.members) {
        const sockId = getReceiverSocketId(String(uid));
        if (sockId) io.to(sockId).emit("group:call:participant-declined", { groupId, user });
      }
    } catch (e) {}
  });

  // When a user leaves the group call, update active participants.
  // The call only ends when all users have left.
  socket.on("group:call:left", async ({ groupId, userId }) => {
    try {
      const latest = await GroupCall.findOne({ groupId }).sort({ createdAt: -1 });
      if (!latest) return;
      const uid = userId || socket.handshake.query.userId;
      const uidStr = String(uid);
      // remove from active participants
      latest.participantsActive = (latest.participantsActive || []).filter((p) => String(p) !== uidStr);
      await latest.save();

      const group = await Group.findById(groupId).select("members");
      // notify members that a participant left
      for (const mid of group.members) {
        const sockId = getReceiverSocketId(String(mid));
        if (sockId) io.to(sockId).emit("group:call:participant-left", { groupId, userId: uidStr });
      }

      // If no one remains, end the call and broadcast completion
      const remaining = latest.participantsActive?.length || 0;
      if (remaining === 0) {
        const now = new Date();
        latest.endedAt = now;
        if (latest.startedAt) {
          latest.status = "completed";
          latest.durationSeconds = Math.max(0, Math.floor((now - latest.startedAt) / 1000));
        } else {
          latest.status = "missed";
        }
        await latest.save();

        for (const mid of group.members) {
          const sockId = getReceiverSocketId(String(mid));
          if (sockId) io.to(sockId).emit("group:call:end", { groupId });
        }
      }
    } catch (e) {}
  });

  // Ensure calls auto-end when users disconnect unexpectedly
  socket.on("disconnect", async () => {
    try {
      const uidStr = String(socket.handshake.query.userId || "");
      if (!uidStr) return;
      // Find active calls where this user is marked active
      const activeCalls = await GroupCall.find({ participantsActive: uidStr, status: "active", endedAt: { $exists: false } }).select("groupId participantsActive startedAt");
      const processedGroups = new Set();
      for (const c of activeCalls) {
        const gid = String(c.groupId);
        if (processedGroups.has(gid)) continue;
        processedGroups.add(gid);
        const latest = await GroupCall.findOne({ groupId: c.groupId }).sort({ createdAt: -1 });
        if (!latest) continue;
        latest.participantsActive = (latest.participantsActive || []).filter((p) => String(p) !== uidStr);
        await latest.save();
        const group = await Group.findById(c.groupId).select("members");
        // notify left
        for (const mid of group.members) {
          const sid = getReceiverSocketId(String(mid));
          if (sid) io.to(sid).emit("group:call:participant-left", { groupId: gid, userId: uidStr });
        }
        // end if empty
        const remaining = latest.participantsActive?.length || 0;
        if (remaining === 0) {
          const now = new Date();
          latest.endedAt = now;
          if (latest.startedAt) {
            latest.status = "completed";
            latest.durationSeconds = Math.max(0, Math.floor((now - latest.startedAt) / 1000));
          } else {
            latest.status = "missed";
          }
          await latest.save();
          for (const mid of group.members) {
            const sid = getReceiverSocketId(String(mid));
            if (sid) io.to(sid).emit("group:call:end", { groupId: gid });
          }
        }
      }
    } catch (e) {
      // ignore
    }
  });

  // Lightweight heartbeat to detect stale sockets
  socket.on("heartbeat", () => {
    try {
      socket.emit("heartbeat:ack", { t: Date.now() });
    } catch (_) {}
  });

  // --- Group WebRTC peer-to-peer signaling ---
  socket.on("group:webrtc:offer", ({ toUserId, fromUserId, groupId, offer }) => {
    const receiverSocketId = getReceiverSocketId(String(toUserId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("group:webrtc:offer", { fromUserId, groupId, offer });
    }
  });

  socket.on("group:webrtc:answer", ({ toUserId, fromUserId, groupId, answer }) => {
    const receiverSocketId = getReceiverSocketId(String(toUserId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("group:webrtc:answer", { fromUserId, groupId, answer });
    }
  });

  socket.on("group:webrtc:ice-candidate", ({ toUserId, fromUserId, groupId, candidate }) => {
    const receiverSocketId = getReceiverSocketId(String(toUserId));
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("group:webrtc:ice-candidate", { fromUserId, groupId, candidate });
    }
  });

  socket.on("webrtc:ice-candidate", ({ toUserId, candidate }) => {
    const receiverSocketId = getReceiverSocketId(toUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("webrtc:ice-candidate", { candidate });
    }
  });

  // --- Chat typing indicators ---
  socket.on("chat:typing", ({ toUserId, fromUserId }) => {
    const receiverSocketId = getReceiverSocketId(toUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("chat:typing", { fromUserId });
    }
  });

  socket.on("chat:stopTyping", ({ toUserId, fromUserId }) => {
    const receiverSocketId = getReceiverSocketId(toUserId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("chat:stopTyping", { fromUserId });
    }
  });

  // --- Group typing indicators ---
  socket.on("group:typing", async ({ groupId, fromUserId }) => {
    try {
      const group = await Group.findById(groupId).select("members");
      if (!group) return;
      for (const memberId of group.members) {
        const sid = getReceiverSocketId(String(memberId));
        if (sid && String(memberId) !== String(fromUserId)) {
          io.to(sid).emit("group:typing", { groupId, fromUserId });
        }
      }
    } catch (e) {
      // silently ignore
    }
  });

  socket.on("group:stopTyping", async ({ groupId, fromUserId }) => {
    try {
      const group = await Group.findById(groupId).select("members");
      if (!group) return;
      for (const memberId of group.members) {
        const sid = getReceiverSocketId(String(memberId));
        if (sid && String(memberId) !== String(fromUserId)) {
          io.to(sid).emit("group:stopTyping", { groupId, fromUserId });
        }
      }
    } catch (e) {
      // silently ignore
    }
  });

  socket.on("disconnect", () => {
    logger.log("A user disconnected", socket.id);
    const key = String(userId || "");
    if (key && userSocketMap.has(key)) {
      const set = userSocketMap.get(key) || new Set();
      set.delete(socket.id);
      if (set.size === 0) {
        userSocketMap.delete(key);
      } else {
        userSocketMap.set(key, set);
      }
    }
    io.emit("getOnlineUsers", Array.from(userSocketMap.keys()));
  });
});

export { io, app, server };
