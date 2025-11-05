import { create } from "zustand";
import toast from "react-hot-toast";
import { logger } from "../lib/logger";
import { useAuthStore } from "./useAuthStore";

const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export const useCallStore = create((set, get) => ({
  inCall: false,
  callType: null, // 'audio' | 'video'
  caller: null,
  callee: null,
  incomingOffer: null,
  localStream: null,
  remoteStream: null,
  pc: null,
  showIncomingModal: false,
  isMuted: false,
  isCameraOff: false,
  callStartAt: null,
  pendingCandidates: [],
  hasLocalVideo: false,
  hasRemoteVideo: false,

  // Initialize peer connection
  createPeer: () => {
    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
    pc.ontrack = (event) => {
      const [stream] = event.streams;
      set({ remoteStream: stream, hasRemoteVideo: stream.getVideoTracks().length > 0 });
      // Update flags on track mute/unmute
      event.track.onmute = () => {
        if (event.track.kind === "video") set({ hasRemoteVideo: false });
      };
      event.track.onunmute = () => {
        if (event.track.kind === "video") set({ hasRemoteVideo: true });
      };
    };
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const { callee, caller } = get();
        const me = useAuthStore.getState().authUser;
        const toUserId = callee?._id || caller?._id; // send to other party
        const socket = useAuthStore.getState().socket;
        socket.emit("webrtc:ice-candidate", { toUserId, candidate: event.candidate });
      }
    };
    set({ pc });
    return pc;
  },

  startCall: async (user, type) => {
    try {
      const me = useAuthStore.getState().authUser;
      const socket = useAuthStore.getState().socket;
      const pc = get().createPeer();
      const constraints = { audio: true, video: type === "video" };
      let localStream;
      try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        // Fallback to audio-only when camera fails
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        toast("Starting audio-only call (camera unavailable)");
      }
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
      const hasVideo = localStream.getVideoTracks().length > 0;
      set({ localStream, callee: user, callType: type, inCall: true, callStartAt: Date.now(), isMuted: false, isCameraOff: false, hasLocalVideo: hasVideo });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("call:request", {
        toUserId: user._id,
        fromUser: me,
        callType: type,
        offer,
        hasVideo,
      });
    } catch (err) {
      logger.error("startCall error", err);
      toast.error("Failed to start call");
      get().endCall();
    }
  },

  handleIncomingCall: ({ fromUser, callType, offer, hasVideo }) => {
    set({ showIncomingModal: true, caller: fromUser, callType, incomingOffer: offer, hasRemoteVideo: !!hasVideo });
  },

  acceptCall: async () => {
    try {
      const { incomingOffer, caller } = get();
      const socket = useAuthStore.getState().socket;
      const pc = get().createPeer();
      const constraints = { audio: true, video: get().callType === "video" };
      let localStream;
      try {
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        toast("Starting audio-only call (camera unavailable)");
      }
      localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
      set({ localStream, inCall: true, showIncomingModal: false, callStartAt: Date.now(), isMuted: false, isCameraOff: false, hasLocalVideo: localStream.getVideoTracks().length > 0 });

      await pc.setRemoteDescription(new RTCSessionDescription(incomingOffer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:accepted", { toUserId: caller._id, answer });

      // flush any queued ICE candidates
      const queued = get().pendingCandidates;
      for (const c of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch (e) {
          logger.error("flush candidate error", e);
        }
      }
      set({ pendingCandidates: [] });
    } catch (err) {
      logger.error("acceptCall error", err);
      toast.error("Failed to accept call");
      get().endCall();
    }
  },

  declineCall: () => {
    const socket = useAuthStore.getState().socket;
    const { caller } = get();
    if (caller) socket.emit("call:declined", { toUserId: caller._id });
    set({ showIncomingModal: false, caller: null, incomingOffer: null, callType: null });
  },

  receiveAccepted: async ({ answer }) => {
    try {
      const pc = get().pc;
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      // flush any queued ICE candidates
      const queued = get().pendingCandidates;
      for (const c of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch (e) {
          logger.error("flush candidate error", e);
        }
      }
      set({ pendingCandidates: [] });
    } catch (err) {
      logger.error("receiveAccepted error", err);
    }
  },

  addRemoteCandidate: async ({ candidate }) => {
    try {
      const pc = get().pc;
      if (!pc) return;
      // If remote description not yet set, queue candidate
      if (!pc.remoteDescription) {
        set({ pendingCandidates: [...get().pendingCandidates, candidate] });
        return;
      }
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      logger.error("addRemoteCandidate error", err);
    }
  },

  endCall: () => {
    const socket = useAuthStore.getState().socket;
    const { callee, caller } = get();
    const toUserId = callee?._id || caller?._id;
    if (toUserId) {
      socket.emit("call:end", { toUserId });
      // Broadcast locally so the ender also sees the banner in the correct chat
      try {
        window.dispatchEvent(new CustomEvent("dm-call-ended", { detail: { userId: toUserId } }));
      } catch (_) {}
    }

    const pc = get().pc;
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.close();
    }
    const localStream = get().localStream;
    localStream?.getTracks().forEach((t) => t.stop());

    set({
      inCall: false,
      callType: null,
      caller: null,
      callee: null,
      incomingOffer: null,
      localStream: null,
      remoteStream: null,
      pc: null,
      showIncomingModal: false,
      isMuted: false,
      isCameraOff: false,
      callStartAt: null,
      pendingCandidates: [],
      hasLocalVideo: false,
      hasRemoteVideo: false,
    });
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

  toggleCamera: () => {
    const localStream = get().localStream;
    if (!localStream) return;
    if (!get().hasLocalVideo) return;
    const videoTracks = localStream.getVideoTracks();
    if (videoTracks.length) {
      const next = !get().isCameraOff;
      videoTracks.forEach((t) => (t.enabled = !next));
      set({ isCameraOff: next });
    }
  },
}));

// Wire socket listeners once socket is ready
export function initializeCallSocketListeners() {
  const socket = useAuthStore.getState().socket;
  if (!socket) return;
  if (socket._callListenersInitialized) return; // prevent double registration
  socket._callListenersInitialized = true;

  socket.on("call:incoming", (payload) => {
    useCallStore.getState().handleIncomingCall(payload);
  });
  socket.on("call:accepted", (payload) => {
    useCallStore.getState().receiveAccepted(payload);
  });
  socket.on("call:declined", () => {
    toast.error("Call declined");
    useCallStore.getState().endCall();
  });
  socket.on("call:end", (payload) => {
    // Receiver gets the ender's id from backend; broadcast for UI scoping
    const fromUserId = payload?.fromUserId;
    if (fromUserId) {
      try {
        window.dispatchEvent(new CustomEvent("dm-call-ended", { detail: { userId: String(fromUserId) } }));
      } catch (_) {}
    }
    useCallStore.getState().endCall();
  });
  socket.on("webrtc:ice-candidate", (payload) => {
    useCallStore.getState().addRemoteCandidate(payload);
  });
}