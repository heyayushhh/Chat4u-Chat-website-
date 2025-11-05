import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import { logger } from "../lib/logger";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import { initializeCallSocketListeners } from "./useCallStore";
import { initializeGlobalMessageListeners, useChatStore } from "./useChatStore";
import { initializeGroupMessageListeners, useGroupStore } from "./useGroupStore";
import { initializeGroupCallSocketListeners } from "./useGroupCallStore";

const BASE_URL = import.meta.env.MODE === "development" ? "http://localhost:5001" : "/";

export const useAuthStore = create((set, get) => ({
  authUser: null,
  isSigningUp: false,
  isLoggingIn: false,
  isUpdatingProfile: false,
  isCheckingAuth: true,
  onlineUsers: [],
  socket: null,
  // Heartbeat management
  lastHeartbeatAckAt: 0,
  heartbeatIntervalId: null,
  heartbeatCheckIntervalId: null,
  heartbeatReconnecting: false,

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");

      set({ authUser: res.data });
      get().connectSocket();
    } catch (error) {
      // Suppress expected unauthenticated states (401/403) to avoid noisy logs
      const status = error?.response?.status;
      if (status !== 401 && status !== 403) {
        logger.error("Error in checkAuth:", error);
      }
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      const res = await axiosInstance.post("/auth/signup", data);
      set({ authUser: res.data });
      toast.success("Account created successfully");
      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to sign up");
    } finally {
      set({ isSigningUp: false });
    }
  },

  requestPhoneOtp: async ({ countryCode, phone }) => {
    try {
      const res = await axiosInstance.post("/otp/request", { countryCode, phone });
      const expires = res.data?.expiresInMinutes || 10;
      const devCode = res.data?.devEchoCode || null;
      toast.success(`OTP sent. Expires in ${expires} minutes`);
      if (devCode) toast(`Dev OTP: ${devCode}`);
      return { ok: true, devCode, expiresInMinutes: expires };
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send OTP");
      return { ok: false, devCode: null, expiresInMinutes: null };
    }
  },

  verifyPhoneOtp: async ({ countryCode, phone, code }) => {
    try {
      const res = await axiosInstance.post("/otp/verify", { countryCode, phone, code });
      const token = res.data?.verificationToken;
      if (!token) throw new Error("No verification token");
      try {
        // Write to new and old keys for compatibility
        localStorage.setItem("chat4u_phone_verification_token", token);
        localStorage.setItem("chatty_phone_verification_token", token);
      } catch {}
      toast.success("Phone verified");
      return token;
    } catch (error) {
      toast.error(error.response?.data?.message || "Invalid OTP");
      return null;
    }
  },

  // Email OTP flow
  requestEmailOtp: async ({ email }) => {
    try {
      const res = await axiosInstance.post("/otp/email/request", { email });
      const expires = res.data?.expiresInMinutes || 10;
      const devCode = res.data?.devEchoCode || null;
      toast.success(`Verification code sent. Expires in ${expires} minutes`);
      if (devCode) toast(`Dev Code: ${devCode}`);
      return { ok: true, devCode, expiresInMinutes: expires };
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send email code");
      return { ok: false, devCode: null, expiresInMinutes: null };
    }
  },
  verifyEmailOtp: async ({ email, code }) => {
    try {
      const res = await axiosInstance.post("/otp/email/verify", { email, code });
      const token = res.data?.verificationToken;
      if (!token) throw new Error("No verification token");
      try {
        localStorage.setItem("chat4u_email_verification_token", token);
        localStorage.setItem("chatty_email_verification_token", token);
      } catch {}
      toast.success("Email verified");
      return token;
    } catch (error) {
      toast.error(error.response?.data?.message || "Invalid code");
      return null;
    }
  },

  login: async (data) => {
    set({ isLoggingIn: true });
    try {
      const res = await axiosInstance.post("/auth/login", data);
      set({ authUser: res.data });
      toast.success("Logged in successfully");

      get().connectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to log in");
    } finally {
      set({ isLoggingIn: false });
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post("/auth/logout");
      set({ authUser: null });
      toast.success("Logged out successfully");
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to log out");
    }
  },

  deleteAccount: async () => {
    try {
      const res = await axiosInstance.delete("/auth/delete-account");
      toast.success(res.data?.message || "Account deleted");
      set({ authUser: null });
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete account");
    }
  },

  updateProfile: async (data) => {
    set({ isUpdatingProfile: true });
    try {
      const res = await axiosInstance.put("/auth/update-profile", data);
      set({ authUser: res.data });
      toast.success("Profile updated successfully");
    } catch (error) {
      logger.error("error in update profile:", error);
      toast.error(error.response?.data?.message || "Failed to update profile");
    } finally {
      set({ isUpdatingProfile: false });
    }
  },

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || authUser.accountStatus !== "active" || get().socket?.connected) return;

    const socket = io(BASE_URL, {
      query: {
        userId: authUser._id,
      },
    });
    socket.connect();

    set({ socket: socket });

    // Client heartbeat: ping every 15s; if no ack in 45s, reconnect
    const startHeartbeat = () => {
      try {
        // Clear any existing timers
        const prevPing = get().heartbeatIntervalId;
        const prevCheck = get().heartbeatCheckIntervalId;
        if (prevPing) clearInterval(prevPing);
        if (prevCheck) clearInterval(prevCheck);
      } catch {}
      set({ lastHeartbeatAckAt: Date.now() });
      const pingId = setInterval(() => {
        try { get().socket?.emit("heartbeat", { t: Date.now() }); } catch {}
      }, 15000);
      const checkId = setInterval(() => {
        const last = get().lastHeartbeatAckAt || 0;
        if (Date.now() - last > 45000) {
          const s = get().socket;
          try { s?.disconnect(); } catch {}
          if (!get().heartbeatReconnecting) {
            set({ heartbeatReconnecting: true });
            try { toast("Reconnecting…"); } catch (_) {}
            setTimeout(() => {
              set({ heartbeatReconnecting: false });
              get().connectSocket();
            }, 500);
          }
        }
      }, 10000);
      set({ heartbeatIntervalId: pingId, heartbeatCheckIntervalId: checkId });
    };
    socket.on("heartbeat:ack", () => {
      set({ lastHeartbeatAckAt: Date.now() });
    });
    startHeartbeat();

    socket.on("getOnlineUsers", (userIds) => {
      set({ onlineUsers: userIds });
    });

    // Initialize call listeners globally once socket is connected
    initializeCallSocketListeners();
    
    // Initialize global message listeners for unread counts
    initializeGlobalMessageListeners();
    // Initialize global group message listeners for unread counts
    initializeGroupMessageListeners();
    // Initialize group call listeners for reliable incoming notifications
    initializeGroupCallSocketListeners();

    // Bootstrap requests, contacts, groups, and unread hydration without requiring a refresh
    try {
      // Fire-and-forget initial data fetches
      useChatStore.getState().fetchIncomingRequests();
      useChatStore.getState().getUsers();
      useGroupStore.getState().getGroups();
      // After a short delay, hydrate unread counts (ensure lists are likely loaded)
      setTimeout(() => {
        try { useChatStore.getState().hydrateUnreadCounts(); } catch {}
        try { useGroupStore.getState().hydrateGroupUnreadCounts(); } catch {}
      }, 300);
    } catch {}
  },
  disconnectSocket: () => {
    if (get().socket?.connected) get().socket.disconnect();
    set({ socket: null, onlineUsers: [], lastHeartbeatAckAt: 0 });
    try {
      const prevPing = get().heartbeatIntervalId;
      const prevCheck = get().heartbeatCheckIntervalId;
      if (prevPing) clearInterval(prevPing);
      if (prevCheck) clearInterval(prevCheck);
      set({ heartbeatIntervalId: null, heartbeatCheckIntervalId: null });
    } catch {}
  },
}));
