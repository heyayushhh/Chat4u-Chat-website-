import { create } from "zustand";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";
import { axiosInstance } from "../lib/axios";
import { useGroupStore } from "./useGroupStore";
import { logger } from "../lib/logger";

export const useGroupCallStore = create((set, get) => ({
  inGroupCall: false,
  callType: null, // 'audio' | 'video'
  group: null,
  initiator: null,
  participants: [], // { _id, fullName, username, profilePic, hasVideo?: boolean }
  showIncomingModal: false,
  callStartAt: null,
  localStream: null,
  hasLocalVideo: false,
  isMuted: false,
  peers: {}, // { userId: RTCPeerConnection }
  remoteStreams: {}, // { userId: MediaStream }
  pendingCandidatesByPeer: {}, // { userId: RTCIceCandidate[] }

  // Ensure participants list is unique by _id
  setUniqueParticipants: (list) => {
    const map = new Map();
    for (const p of list || []) {
      const id = String(p?._id || "");
      if (!id) continue;
      if (!map.has(id)) map.set(id, p);
    }
    set({ participants: Array.from(map.values()) });
  },

  startGroupCall: async (group, type) => {
    try {
      const me = useAuthStore.getState().authUser;
      const socket = useAuthStore.getState().socket;
      const constraints = { audio: true, video: type === "video" };
      let localStream;
      try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          toast("Starting audio-only call (camera unavailable)");
        } catch (err) {
          // Gracefully degrade: let user join without local media
          localStream = null;
          toast.error("Microphone blocked. Joining without local audio.");
        }
      }
      const hasVideo = localStream.getVideoTracks().length > 0;
      set({ inGroupCall: true, callType: type, group, initiator: me, callStartAt: Date.now(), localStream, hasLocalVideo: hasVideo, isMuted: false, participants: [{ ...me, hasVideo }] });
      // Deduplicate defensively
      get().setUniqueParticipants(get().participants);
      if (!socket) {
        useAuthStore.getState().connectSocket();
      }
      useAuthStore.getState().socket?.emit("group:call:request", { groupId: group._id, fromUser: me, callType: type });
    } catch (err) {
      logger.error("startGroupCall error", err);
      toast.error("Failed to start group call");
      get().endGroupCall();
    }
  },

  handleIncomingGroupCall: ({ groupId, fromUser, callType }) => {
    // resolve group object minimal
    set({ showIncomingModal: true, callType, initiator: fromUser, group: { _id: groupId } });
  },

  acceptGroupCall: async () => {
    const socket = useAuthStore.getState().socket;
    const me = useAuthStore.getState().authUser;
    const { group, callType } = get();
    try {
      const constraints = { audio: true, video: callType === "video" };
      let localStream;
      try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          toast("Starting audio-only call (camera unavailable)");
        } catch (err) {
          localStream = null;
          toast.error("Microphone blocked. Joining without local audio.");
        }
      }
      const hasVideo = localStream.getVideoTracks().length > 0;
      set({ showIncomingModal: false, inGroupCall: true, callStartAt: Date.now(), localStream, hasLocalVideo: hasVideo, isMuted: false, participants: [...get().participants, { ...me, hasVideo }] });
      get().setUniqueParticipants(get().participants);
      useAuthStore.getState().socket?.emit("group:call:accepted", { groupId: group._id, user: me });
      // After joining, discover already-active participants and render them
      await get().connectToExistingParticipants();
    } catch (err) {
      logger.error("acceptGroupCall error", err);
      toast.error("Failed to join group call");
    }
  },

  declineGroupCall: () => {
    const socket = useAuthStore.getState().socket;
    const me = useAuthStore.getState().authUser;
    const { group } = get();
    if (group?._id) socket.emit("group:call:declined", { groupId: group._id, user: me });
    set({ showIncomingModal: false, initiator: null, callType: null, group: null });
  },

  // Allow joining an ongoing group call even if the incoming modal was missed
  joinActiveGroupCall: async ({ group, type }) => {
    const socket = useAuthStore.getState().socket;
    const me = useAuthStore.getState().authUser;
    try {
      const constraints = { audio: true, video: type === "video" };
      let localStream;
      try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        try {
          localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          toast("Starting audio-only call (camera unavailable)");
        } catch (err) {
          localStream = null;
          toast.error("Microphone blocked. Joining without local audio.");
        }
      }
      const hasVideo = localStream.getVideoTracks().length > 0;
      set({
        showIncomingModal: false,
        inGroupCall: true,
        callStartAt: Date.now(),
        localStream,
        hasLocalVideo: hasVideo,
        isMuted: false,
        callType: type,
        group,
        participants: [...get().participants, { ...me, hasVideo }],
      });
      get().setUniqueParticipants(get().participants);
      useAuthStore.getState().socket?.emit("group:call:accepted", { groupId: group._id, user: me });
      // Populate existing participants so the rejoiner sees everyone
      await get().connectToExistingParticipants();
    } catch (err) {
      logger.error("joinActiveGroupCall error", err);
      toast.error("Failed to join group call");
    }
  },

  participantJoined: ({ user }) => {
    const exists = get().participants.some((p) => String(p._id) === String(user._id));
    if (!exists) {
      set({ participants: [...get().participants, { ...user }] });
      get().setUniqueParticipants(get().participants);
    }
    // Proactively create a peer connection and send an offer to the new participant
    const me = useAuthStore.getState().authUser;
    const { group } = get();
    if (!group?._id || String(user._id) === String(me._id)) return;
    get().ensurePeer(user._id);
    get().sendOfferTo(user._id);
  },

  participantDeclined: ({ user }) => {
    // no-op for now; could track declined list
  },

  endGroupCall: (opts = {}) => {
    const socket = useAuthStore.getState().socket;
    const { group } = get();
    // Leave the call locally; do NOT end for everyone.
    if (group?._id) socket.emit("group:call:left", { groupId: group._id });
    const localStream = get().localStream;
    localStream?.getTracks().forEach((t) => t.stop());
    // Close peers
    const peers = get().peers;
    Object.values(peers).forEach((pc) => {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.close();
      } catch {}
    });
    set({
      inGroupCall: false,
      callType: null,
      group: null,
      initiator: null,
      participants: [],
      showIncomingModal: false,
      callStartAt: null,
      localStream: null,
      hasLocalVideo: false,
      isMuted: false,
      peers: {},
      remoteStreams: {},
      pendingCandidatesByPeer: {},
    });
  },

  participantLeft: ({ userId }) => {
    // Remove participant and close any peer connection to them
    const filtered = get().participants.filter((p) => String(p._id) !== String(userId));
    const peers = { ...get().peers };
    const pc = peers[userId];
    if (pc) {
      try {
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.close();
      } catch {}
      delete peers[userId];
    }
    const remoteStreams = { ...get().remoteStreams };
    delete remoteStreams[userId];
    set({ participants: filtered, peers, remoteStreams });
    get().setUniqueParticipants(get().participants);
  },

  toggleMute: () => {
    const localStream = get().localStream;
    if (!localStream) return;
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length) {
      const next = !get().isMuted;
      audioTracks.forEach((t) => (t.enabled = !next));
      set({ isMuted: next });
    }
  },

  // --- WebRTC helpers for group ---
  ensurePeer: (userId) => {
    const peers = get().peers;
    if (peers[userId]) return peers[userId];
    const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      const remoteStreams = { ...get().remoteStreams };
      remoteStreams[userId] = stream;
      set({ remoteStreams });
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = useAuthStore.getState().socket;
        const { group } = get();
        const me = useAuthStore.getState().authUser;
        socket.emit("group:webrtc:ice-candidate", { toUserId: userId, fromUserId: me._id, groupId: group._id, candidate: event.candidate });
      }
    };
    // add local tracks
    const localStream = get().localStream;
    localStream?.getTracks().forEach((t) => pc.addTrack(t, localStream));
    const nextPeers = { ...peers, [userId]: pc };
    set({ peers: nextPeers });
    return pc;
  },

  sendOfferTo: async (userId) => {
    try {
      const pc = get().ensurePeer(userId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const socket = useAuthStore.getState().socket;
      const { group } = get();
      const me = useAuthStore.getState().authUser;
      socket.emit("group:webrtc:offer", { toUserId: userId, fromUserId: me._id, groupId: group._id, offer });
    } catch (e) {
      logger.error("sendOfferTo error", e);
    }
  },

  handleIncomingOffer: async ({ fromUserId, offer }) => {
    try {
      // Ensure the sender is shown in participants list for tile and audio binding
      const exists = get().participants.some((p) => String(p._id) === String(fromUserId));
      if (!exists) {
        const info = await get().resolveUserInfo(fromUserId);
        set({ participants: [...get().participants, info] });
        // Immediately deduplicate in case another concurrent path added same user
        get().setUniqueParticipants(get().participants);
      }
      const pc = get().ensurePeer(fromUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const socket = useAuthStore.getState().socket;
      const { group } = get();
      const me = useAuthStore.getState().authUser;
      socket.emit("group:webrtc:answer", { toUserId: fromUserId, fromUserId: me._id, groupId: group._id, answer });
      // flush queued candidates if any
      const pending = get().pendingCandidatesByPeer[fromUserId] || [];
      for (const c of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch (err) {
          logger.error("group flush candidate error", err);
        }
      }
      const map = { ...get().pendingCandidatesByPeer };
      delete map[fromUserId];
      set({ pendingCandidatesByPeer: map });
    } catch (e) {
      logger.error("handleIncomingOffer error", e);
    }
  },

  // Resolve minimal user info for participant tiles
  resolveUserInfo: async (userId) => {
    try {
      const group = get().group;
      const selectedGroup = useGroupStore.getState().selectedGroup;
      const members = selectedGroup?._id === group?._id ? (selectedGroup.members || []) : [];
      const found = members.find((m) => String(m?._id || m) === String(userId));
      if (found) {
        if (typeof found === "object") return { _id: found._id, username: found.username, fullName: found.fullName, profilePic: found.profilePic };
        // bare id fallback
        const res = await axiosInstance.get(`/users/${userId}`);
        const { username, fullName, profilePic } = res.data || {};
        return { _id: userId, username, fullName, profilePic };
      }
      // Not present in selectedGroup members; fetch directly
      const res = await axiosInstance.get(`/users/${userId}`);
      const { username, fullName, profilePic } = res.data || {};
      return { _id: userId, username, fullName, profilePic };
    } catch (_) {
      return { _id: userId, username: null, fullName: null, profilePic: "/avatar.png" };
    }
  },

  // After joining/rejoining, fetch active call and render all current participants, then let offers flow in
  connectToExistingParticipants: async () => {
    try {
      const { group } = get();
      if (!group?._id) return;
      const res = await axiosInstance.get(`/group-calls/${group._id}`);
      const list = res.data || [];
      const latest = list[0];
      if (!latest || latest.status !== "active") return;
      const me = useAuthStore.getState().authUser;
      const activeIds = (latest.participantsActive || []).map(String).filter((uid) => uid !== String(me?._id));
      const existingIds = new Set(get().participants.map((p) => String(p._id)));
      const toAdd = activeIds.filter((uid) => !existingIds.has(String(uid)));
      let next = get().participants;
      for (const uid of toAdd) {
        const info = await get().resolveUserInfo(uid);
        next = [...next, info];
      }
      get().setUniqueParticipants(next);
      // Offers will be sent to us by existing participants via participant-joined event; we only need to be ready
    } catch (e) {
      // best-effort; don't fail join
    }
  },

  handleIncomingAnswer: async ({ fromUserId, answer }) => {
    try {
      const pc = get().peers[fromUserId];
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      // flush queued candidates
      const pending = get().pendingCandidatesByPeer[fromUserId] || [];
      for (const c of pending) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch (err) {
          logger.error("group flush candidate error", err);
        }
      }
      const map = { ...get().pendingCandidatesByPeer };
      delete map[fromUserId];
      set({ pendingCandidatesByPeer: map });
    } catch (e) {
      logger.error("handleIncomingAnswer error", e);
    }
  },

  addGroupRemoteCandidate: async ({ fromUserId, candidate }) => {
    try {
      const pc = get().peers[fromUserId];
      if (!pc) return;
      if (!pc.remoteDescription) {
        const map = { ...get().pendingCandidatesByPeer };
        const list = map[fromUserId] || [];
        map[fromUserId] = [...list, candidate];
        set({ pendingCandidatesByPeer: map });
        return;
      }
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (e) {
      logger.error("addGroupRemoteCandidate error", e);
    }
  },
}));

export const initializeGroupCallSocketListeners = () => {
  const socket = useAuthStore.getState().socket;
  if (!socket) return;
  // incoming request
  socket.off("group:call:incoming");
  socket.on("group:call:incoming", (payload) => {
    useGroupCallStore.getState().handleIncomingGroupCall(payload);
  });
  // participant join/decline
  socket.off("group:call:participant-joined");
  socket.on("group:call:participant-joined", ({ groupId, user }) => {
    const { inGroupCall, group } = useGroupCallStore.getState();
    if (!inGroupCall) return;
    if (!group?._id || String(groupId) !== String(group._id)) return;
    useGroupCallStore.getState().participantJoined({ user });
  });
  socket.off("group:call:participant-declined");
  socket.on("group:call:participant-declined", ({ groupId, user }) => {
    const { inGroupCall, group } = useGroupCallStore.getState();
    if (!inGroupCall) return;
    if (!group?._id || String(groupId) !== String(group._id)) return;
    useGroupCallStore.getState().participantDeclined({ user });
  });
  // end
  socket.off("group:call:end");
  socket.on("group:call:end", ({ groupId }) => {
    // Broadcast to UI so non-participants can hide Join immediately
    try {
      window.dispatchEvent(new CustomEvent("group-call-ended", { detail: { groupId } }));
    } catch (_) {}
    const { inGroupCall, group } = useGroupCallStore.getState();
    if (inGroupCall && group?._id && String(groupId) === String(group._id)) {
      try { toast("Call ended"); } catch (_) {}
      useGroupCallStore.getState().endGroupCall();
    }
  });
  socket.off("group:call:participant-left");
  socket.on("group:call:participant-left", (payload) => {
    const { groupId } = payload || {};
    const { inGroupCall, group } = useGroupCallStore.getState();
    if (!inGroupCall) return;
    if (!group?._id || String(groupId) !== String(group._id)) return;
    useGroupCallStore.getState().participantLeft(payload);
  });
  // group WebRTC signaling
  socket.off("group:webrtc:offer");
  socket.on("group:webrtc:offer", (payload) => {
    const { groupId } = payload || {};
    const { inGroupCall, group } = useGroupCallStore.getState();
    if (!inGroupCall) return;
    if (!group?._id || String(groupId) !== String(group._id)) return;
    useGroupCallStore.getState().handleIncomingOffer(payload);
  });
  socket.off("group:webrtc:answer");
  socket.on("group:webrtc:answer", (payload) => {
    const { groupId } = payload || {};
    const { inGroupCall, group } = useGroupCallStore.getState();
    if (!inGroupCall) return;
    if (!group?._id || String(groupId) !== String(group._id)) return;
    useGroupCallStore.getState().handleIncomingAnswer(payload);
  });
  socket.off("group:webrtc:ice-candidate");
  socket.on("group:webrtc:ice-candidate", (payload) => {
    const { groupId } = payload || {};
    const { inGroupCall, group } = useGroupCallStore.getState();
    if (!inGroupCall) return;
    if (!group?._id || String(groupId) !== String(group._id)) return;
    useGroupCallStore.getState().addGroupRemoteCandidate(payload);
  });
};