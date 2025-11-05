import { create } from "zustand";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import { useAuthStore } from "./useAuthStore";

export const useChatStore = create((set, get) => ({
  messages: [],
  users: [],
  selectedUser: null,
  isUsersLoading: false,
  isMessagesLoading: false,
  isOlderLoading: false,
  hasMoreMessages: true,
  dmLastSeenTimers: {}, // { userId: timeoutId }
  dmLastSeenPendingTs: {}, // { userId: timestamp }
  incomingRequests: [],
  isRequestsLoading: false,
  isPartnerTyping: false,
  unreadCounts: {}, // { userId: count }
  pinnedUserIds: [],
  mutedUserIds: [],
  mutedUntil: {}, // { userId: timestamp }
  archivedUserIds: [],
  // Scoped DM socket handlers to avoid removing global listeners
  _dmNewMessageHandler: null,
  _dmTypingHandler: null,
  _dmStopTypingHandler: null,
  _dmReactionHandler: null,

  getUsers: async () => {
    set({ isUsersLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ users: res.data });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isUsersLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}?limit=100`);
      const list = Array.isArray(res.data) ? res.data : [];
      set({ messages: list, hasMoreMessages: list.length >= 100 });
    } catch (error) {
      toast.error(error.response.data.message);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  getOlderMessages: async (userId) => {
    const { messages, isOlderLoading, hasMoreMessages } = get();
    if (isOlderLoading || !hasMoreMessages) return;
    const oldest = messages[0]?.createdAt ? new Date(messages[0].createdAt).getTime() : null;
    if (!oldest) return;
    set({ isOlderLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}?limit=100&beforeTs=${oldest}`);
      const older = Array.isArray(res.data) ? res.data : [];
      const seen = new Set((messages || []).map((m) => String(m._id)));
      const filtered = older.filter((m) => !seen.has(String(m._id)));
      set({ messages: [...filtered, ...messages], hasMoreMessages: older.length >= 100 });
    } catch (_) {
      // silent
    } finally {
      set({ isOlderLoading: false });
    }
  },

  // Mark DM last-seen locally and schedule a debounced server update
  markDmLastSeen: (userId) => {
    try {
      const me = useAuthStore.getState().authUser;
      if (!me?._id || !userId) return;
      const ts = Date.now();
      const key = `dm_last_seen_${me._id}_${userId}`;
      try { localStorage.setItem(key, String(ts)); } catch {}
      const { unreadCounts } = get();
      if (unreadCounts[userId]) {
        set({ unreadCounts: { ...unreadCounts, [userId]: 0 } });
      }
      const timers = get().dmLastSeenTimers || {};
      const pending = { ...(get().dmLastSeenPendingTs || {}) };
      pending[userId] = Math.max(Number(pending[userId]) || 0, ts);
      if (timers[userId]) clearTimeout(timers[userId]);
      const t = setTimeout(() => {
        const sendTs = (get().dmLastSeenPendingTs || {})[userId] || ts;
        axiosInstance.post(`/messages/last-seen`, { lastSeen: { [userId]: sendTs } }).catch(() => {});
        // clear timer reference
        const curTimers = get().dmLastSeenTimers || {};
        const { [userId]: _, ...rest } = curTimers;
        set({ dmLastSeenTimers: rest });
      }, 2500);
      set({ dmLastSeenTimers: { ...timers, [userId]: t }, dmLastSeenPendingTs: pending });
    } catch (_) {}
  },

  // Contacts / Requests
  sendContactRequest: async (username) => {
    try {
      await axiosInstance.post(`/contacts/request`, { username });
      toast.success("Request sent");
    } catch (error) {
      const msg = error.response?.data?.message || "Failed to send request";
      if (msg === "Already connected") {
        toast.success("Already connected — opening chat");
        // Refresh contacts and open DM with this user
        try {
          await get().getUsers();
          const users = get().users || [];
          const target = users.find((u) => (u.username || "") === username);
          if (target) {
            get().setSelectedUser(target);
          }
        } catch (_) {}
      } else {
        toast.error(msg);
      }
    }
  },
  fetchIncomingRequests: async () => {
    set({ isRequestsLoading: true });
    try {
      const res = await axiosInstance.get(`/contacts/incoming`);
      set({ incomingRequests: res.data });
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load requests");
    } finally {
      set({ isRequestsLoading: false });
    }
  },
  approveContactRequest: async (requesterId) => {
    try {
      await axiosInstance.post(`/contacts/approve`, { requesterId });
      toast.success("Request approved");
      // refresh requests and contacts list
      await get().fetchIncomingRequests();
      await get().getUsers();
      // auto-open the chat with the requester
      try {
        const users = get().users || [];
        const target = users.find((u) => String(u._id) === String(requesterId));
        if (target) get().setSelectedUser(target);
      } catch (_) {}
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to approve request");
    }
  },
  removeContact: async (userId) => {
    try {
      await axiosInstance.delete(`/contacts/${userId}`);
      toast.success("Contact removed");
      // Refresh contacts list
      await get().getUsers();
      // If currently viewing this chat, close it
      const sel = get().selectedUser;
      if (sel && String(sel._id) === String(userId)) {
        set({ selectedUser: null, messages: [], isPartnerTyping: false });
      }
      // Clear unread count for this user
      const { unreadCounts } = get();
      if (unreadCounts[userId]) {
        const copy = { ...unreadCounts };
        delete copy[userId];
        set({ unreadCounts: copy });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove contact");
    }
  },
  sendMessage: async (messageData, options = {}) => {
    const { selectedUser, messages } = get();
    try {
      const axiosConfig = {};
      if (typeof options.onUploadProgress === "function") {
        axiosConfig.onUploadProgress = options.onUploadProgress;
      }
      const res = await axiosInstance.post(`/messages/send/${selectedUser._id}`, messageData, axiosConfig);
      set({ messages: [...messages, res.data] });
    } catch (error) {
      toast.error(error.response.data.message);
    }
  },

  preUploadAttachment: async (payload, options = {}) => {
    try {
      const axiosConfig = {};
      if (typeof options.onUploadProgress === "function") {
        axiosConfig.onUploadProgress = options.onUploadProgress;
      }
      const res = await axiosInstance.post(`/messages/uploads`, payload, axiosConfig);
      return res.data;
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to upload attachment");
      throw error;
    }
  },

  // React to a message in the current DM
  reactToMessage: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.post(`/messages/${messageId}/react`, { emoji });
      const { _id, reactions } = res.data || {};
      const next = get().messages.map((m) => (String(m._id) === String(_id) ? { ...m, reactions } : m));
      set({ messages: next });
    } catch (error) {
      const msg = error?.response?.data?.message || "Failed to react";
      toast.error(msg);
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;

    const socket = useAuthStore.getState().socket;
    const dmNewMessageHandler = (newMessage) => {
      const isMessageSentFromSelectedUser = newMessage.senderId === selectedUser._id;
      if (!isMessageSentFromSelectedUser) return;
      set({ messages: [...get().messages, newMessage] });
    };
    const dmTypingHandler = ({ fromUserId }) => {
      if (fromUserId === selectedUser._id) {
        set({ isPartnerTyping: true });
      }
    };
    const dmStopTypingHandler = ({ fromUserId }) => {
      if (fromUserId === selectedUser._id) {
        set({ isPartnerTyping: false });
      }
    };
    socket.on("newMessage", dmNewMessageHandler);
    const dmReactionHandler = ({ messageId, reactions }) => {
      const exists = get().messages.find((m) => String(m._id) === String(messageId));
      if (!exists) return;
      const updated = get().messages.map((m) => (String(m._id) === String(messageId) ? { ...m, reactions } : m));
      set({ messages: updated });
    };
    socket.on("message:reaction", dmReactionHandler);
    socket.on("chat:typing", dmTypingHandler);
    socket.on("chat:stopTyping", dmStopTypingHandler);
    set({ _dmNewMessageHandler: dmNewMessageHandler, _dmTypingHandler: dmTypingHandler, _dmStopTypingHandler: dmStopTypingHandler, _dmReactionHandler: dmReactionHandler });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    const { _dmNewMessageHandler, _dmTypingHandler, _dmStopTypingHandler, _dmReactionHandler } = get();
    if (_dmNewMessageHandler) socket.off("newMessage", _dmNewMessageHandler);
    if (_dmTypingHandler) socket.off("chat:typing", _dmTypingHandler);
    if (_dmStopTypingHandler) socket.off("chat:stopTyping", _dmStopTypingHandler);
    if (_dmReactionHandler) socket.off("message:reaction", _dmReactionHandler);
    set({ _dmNewMessageHandler: null, _dmTypingHandler: null, _dmStopTypingHandler: null, _dmReactionHandler: null });
  },

  setSelectedUser: (selectedUser) => {
    // Clear unread count when selecting a user
    if (selectedUser) {
      const { unreadCounts } = get();
      const newUnreadCounts = { ...unreadCounts };
      delete newUnreadCounts[selectedUser._id];
      set({ selectedUser, unreadCounts: newUnreadCounts });
      // Persist last-seen with debounce
      try { get().markDmLastSeen(selectedUser._id); } catch {}
    } else {
      set({ selectedUser });
    }
  },

  // Global message listener for unread counts
  subscribeToGlobalMessages: () => {
    const socket = useAuthStore.getState().socket;
    
    socket.on("newMessage", (newMessage) => {
      const { selectedUser, unreadCounts, users } = get();
      const me = useAuthStore.getState().authUser;

      // If message is from currently selected user, don't count as unread
      if (selectedUser && newMessage.senderId === selectedUser._id) {
        return;
      }
      
      // If message is from another user, increment unread count
      if (newMessage.senderId !== useAuthStore.getState().authUser._id) {
        // Respect mute settings: do not increment unread for muted users
        if (get().isMuted(newMessage.senderId)) return;
        // Ignore messages at or before last-seen timestamp
        try {
          const key = `dm_last_seen_${me?._id}_${newMessage.senderId}`;
          const lastSeen = Number(localStorage.getItem(key) || 0);
          const created = new Date(newMessage.createdAt || 0).getTime();
          if (lastSeen && created <= lastSeen) return;
        } catch {}
        const currentCount = unreadCounts[newMessage.senderId] || 0;
        set({
          unreadCounts: {
            ...unreadCounts,
            [newMessage.senderId]: currentCount + 1
          }
        });

        // Ensure the sender appears in the sidebar, even if not a contact yet
        try {
          const exists = (users || []).some((u) => String(u._id) === String(newMessage.senderId));
          if (!exists) {
            axiosInstance.get(`/users/${newMessage.senderId}`).then((res) => {
              const info = res.data || {};
              const minimal = {
                _id: String(newMessage.senderId),
                username: info.username || "unknown",
                fullName: info.fullName || info.username || "Unknown",
                profilePic: info.profilePic || "/avatar.png",
                // mark ephemeral entries for potential future handling
                ephemeral: true,
              };
              const latest = get().users || [];
              set({ users: [...latest, minimal] });
            }).catch(() => {
              const minimal = {
                _id: String(newMessage.senderId),
                username: "unknown",
                fullName: "Unknown",
                profilePic: "/avatar.png",
                ephemeral: true,
              };
              const latest = get().users || [];
              set({ users: [...latest, minimal] });
            });
          }
        } catch {}
      }
    });
  },

  // Listen for contact profile updates and refresh users/selectedUser live
  subscribeToUserProfileUpdates: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;
    socket.on("user:profileUpdated", (updated) => {
      const nextUsers = get().users.map((u) => (String(u._id) === String(updated._id) ? { ...u, ...updated } : u));
      const isSelected = String(get().selectedUser?._id || "") === String(updated._id);
      set({ users: nextUsers, selectedUser: isSelected ? { ...get().selectedUser, ...updated } : get().selectedUser });
    });
  },

  unsubscribeFromGlobalMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("newMessage");
  },

  getUnreadCount: (userId) => {
    const { unreadCounts } = get();
    return unreadCounts[userId] || 0;
  },

  // Hydrate unread counts on startup based on last-seen timestamps
  hydrateUnreadCounts: async () => {
    try {
      const me = useAuthStore.getState().authUser;
      if (!me?._id) return;
      // Ensure users list is loaded
      if (!get().users || get().users.length === 0) {
        try { await get().getUsers(); } catch {}
      }
      const users = get().users || [];
      const payload = { lastSeen: {} };
      let serverMap = {};
      try {
        const sres = await axiosInstance.get(`/messages/last-seen`);
        serverMap = sres.data || {};
      } catch {}
      for (const u of users) {
        const key = `dm_last_seen_${me._id}_${u._id}`;
        let lastSeen = 0;
        try { lastSeen = Number(localStorage.getItem(key) || 0); } catch {}
        const serverTs = Number(serverMap[u._id]) || 0;
        payload.lastSeen[u._id] = Math.max(serverTs, lastSeen || 0);
      }
      try {
        const res = await axiosInstance.post(`/messages/unread-counts`, payload);
        const counts = res.data || {};
        set({ unreadCounts: counts });
      } catch (_) {
        // Best-effort hydration; leave unreadCounts as-is
      }
    } catch (_) { /* swallow */ }
  },

  // Emit typing events to the selected user
  emitTyping: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;
    const socket = useAuthStore.getState().socket;
    const me = useAuthStore.getState().authUser;
    socket.emit("chat:typing", { toUserId: selectedUser._id, fromUserId: me._id });
  },
  emitStopTyping: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;
    const socket = useAuthStore.getState().socket;
    const me = useAuthStore.getState().authUser;
    socket.emit("chat:stopTyping", { toUserId: selectedUser._id, fromUserId: me._id });
    // reset local indicator just in case
    set({ isPartnerTyping: false });
  },
  
  // Context menu actions
  togglePin: (userId) => {
    const { pinnedUserIds } = get();
    const exists = pinnedUserIds.includes(userId);
    set({ pinnedUserIds: exists ? pinnedUserIds.filter((id) => id !== userId) : [...pinnedUserIds, userId] });
  },
  toggleMute: (userId) => {
    const { mutedUserIds, mutedUntil } = get();
    const exists = mutedUserIds.includes(userId);
    if (exists) {
      // remove indefinite mute
      const nextIds = mutedUserIds.filter((id) => id !== userId);
      const { [userId]: _, ...rest } = mutedUntil;
      set({ mutedUserIds: nextIds, mutedUntil: rest });
    } else {
      set({ mutedUserIds: [...mutedUserIds, userId] });
    }
  },
  muteFor: (userId, ms) => {
    const { mutedUntil, mutedUserIds } = get();
    const deadline = Date.now() + ms;
    // Ensure not listed as indefinite mute if setting a timed mute
    const nextIds = mutedUserIds.filter((id) => id !== userId);
    set({ mutedUntil: { ...mutedUntil, [userId]: deadline }, mutedUserIds: nextIds });
  },
  isMuted: (userId) => {
    const { mutedUserIds, mutedUntil } = get();
    if (mutedUserIds.includes(userId)) return true;
    const until = mutedUntil[userId];
    return typeof until === "number" && until > Date.now();
  },
  markUnread: (userId) => {
    const { unreadCounts } = get();
    const current = unreadCounts[userId] || 0;
    set({ unreadCounts: { ...unreadCounts, [userId]: Math.max(1, current || 1) } });
  },
  archiveChat: (userId) => {
    const { archivedUserIds } = get();
    if (!archivedUserIds.includes(userId)) set({ archivedUserIds: [...archivedUserIds, userId] });
  },
  clearMessagesFor: (userId) => {
    const { selectedUser } = get();
    if (selectedUser && String(selectedUser._id) === String(userId)) {
      set({ messages: [] });
    }
  },
}));

// Initialize global message listeners for unread counts
export function initializeGlobalMessageListeners() {
  const socket = useAuthStore.getState().socket;
  if (!socket) return;
  if (socket._messageListenersInitialized) return; // prevent double registration
  socket._messageListenersInitialized = true;

  const { subscribeToGlobalMessages } = useChatStore.getState();
  subscribeToGlobalMessages();
  // Also wire live updates for contact avatars/names
  useChatStore.getState().subscribeToUserProfileUpdates();
}
