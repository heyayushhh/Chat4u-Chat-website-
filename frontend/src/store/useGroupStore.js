import { create } from "zustand";
import { axiosInstance } from "../lib/axios";
import { logger } from "../lib/logger";
import toast from "react-hot-toast";
import { useAuthStore } from "./useAuthStore";

export const useGroupStore = create((set, get) => ({
  groups: [],
  selectedGroup: null,
  isGroupsLoading: false,
  isCreatingGroup: false,
  isGroupInfoLoading: false,
  isUpdatingGroup: false,
  messages: [],
  isMessagesLoading: false,
  isOlderGroupLoading: false,
  hasMoreGroupMessages: true,
  groupLastSeenTimers: {}, // { groupId: timeoutId }
  groupLastSeenPendingTs: {}, // { groupId: timestamp }
  groupUnreadCounts: {}, // { groupId: count }
  pinnedGroupIds: [],
  favoriteGroupIds: [],
  mutedGroupIds: [],
  mutedUntilGroup: {}, // { groupId: timestamp }
  archivedGroupIds: [],
  typingUserIds: [], // userIds currently typing in the selected group
  // Scoped group socket handlers to avoid removing global listeners
  _groupNewMessageHandler: null,
  _groupTypingHandler: null,
  _groupStopTypingHandler: null,
  _groupReactionHandler: null,

  getGroups: async () => {
    set({ isGroupsLoading: true });
    try {
      const res = await axiosInstance.get("/groups");
      const incoming = Array.isArray(res.data) ? res.data : [];
      const curSelected = get().selectedGroup;
      const stillExists = curSelected && incoming.some((g) => String(g._id) === String(curSelected._id));
      // Update groups and clear stale selectedGroup/messages if it no longer exists (e.g., admin deleted or user left)
      if (!stillExists && curSelected) {
        set({ groups: incoming, selectedGroup: null, messages: [] });
      } else {
        set({ groups: incoming });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load groups");
    } finally {
      set({ isGroupsLoading: false });
    }
  },

  createGroup: async (name, memberIds) => {
    set({ isCreatingGroup: true });
    try {
      const res = await axiosInstance.post("/groups", { name, memberIds });
      set({ groups: [...get().groups, res.data], selectedGroup: res.data });
      toast.success("Group created");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to create group");
    } finally {
      set({ isCreatingGroup: false });
    }
  },

  getGroupInfo: async (groupId) => {
    set({ isGroupInfoLoading: true });
    try {
      const res = await axiosInstance.get(`/groups/${groupId}`);
      // update group in list and selected
      const updated = get().groups.map((g) => (g._id === groupId ? res.data : g));
      set({ groups: updated, selectedGroup: res.data });
    } catch (error) {
      if (error.response?.status === 403) {
        // Not a member: keep existing selectedGroup without spamming toasts
        // Do not overwrite state; allow UI to render with minimal info
      } else {
        toast.error(error.response?.data?.message || "Failed to load group info");
      }
    } finally {
      set({ isGroupInfoLoading: false });
    }
  },

  updateGroupProfile: async (groupId, payload) => {
    set({ isUpdatingGroup: true });
    try {
      const res = await axiosInstance.put(`/groups/${groupId}`, payload);
      const updated = get().groups.map((g) => (g._id === groupId ? res.data : g));
      set({ groups: updated, selectedGroup: res.data });
      toast.success("Group updated");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update group");
    } finally {
      set({ isUpdatingGroup: false });
    }
  },

  addMembers: async (groupId, memberIds) => {
    try {
      // Sanitize payload: only valid 24-char ObjectIds, deduped
      const isValidId = (id) => /^[0-9a-fA-F]{24}$/.test(String(id || ""));
      const unique = Array.from(new Set((memberIds || []).map(String))).filter(isValidId);
      if (!unique.length) {
        toast.error("Please select valid contacts to add");
        return;
      }
      const res = await axiosInstance.post(`/groups/${groupId}/add-members`, { memberIds: unique });
      const updated = get().groups.map((g) => (g._id === groupId ? res.data : g));
      set({ groups: updated, selectedGroup: res.data });
      toast.success("Members added");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to add members");
    }
  },

  removeMember: async (groupId, memberId) => {
    try {
      const res = await axiosInstance.delete(`/groups/${groupId}/members/${memberId}`);
      const updated = get().groups.map((g) => (g._id === groupId ? res.data : g));
      set({ groups: updated, selectedGroup: res.data });
      toast.success("Member removed");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove member");
    }
  },

  leaveGroup: async (groupId) => {
    try {
      await axiosInstance.post(`/groups/${groupId}/leave`);
      set({
        groups: get().groups.filter((g) => g._id !== groupId),
        selectedGroup: null,
      });
      toast.success("Left group");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to leave group");
    }
  },

  deleteGroup: async (groupId) => {
    try {
      await axiosInstance.delete(`/groups/${groupId}`);
      set({
        groups: get().groups.filter((g) => g._id !== groupId),
        selectedGroup: null,
      });
      toast.success("Group deleted");
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete group");
    }
  },

  setSelectedGroup: (group) => {
    if (group) {
      const { groupUnreadCounts } = get();
      const { [String(group._id)]: _, ...rest } = groupUnreadCounts || {};
      set({ selectedGroup: group, groupUnreadCounts: rest });
      try { get().markGroupLastSeen(group._id); } catch {}
    } else {
      set({ selectedGroup: group });
    }
  },

  // Group chat APIs
  getGroupMessages: async (groupId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/group-messages/${groupId}/messages?limit=100`);
      const list = Array.isArray(res.data) ? res.data : [];
      set({ messages: list, hasMoreGroupMessages: list.length >= 100 });
    } catch (error) {
      if (error.response?.status === 403) {
        // Not a member: keep UI calm and avoid repeating toasts
        set({ messages: [] });
      } else {
        toast.error(error.response?.data?.message || "Failed to load messages");
      }
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  getOlderGroupMessages: async (groupId) => {
    const { messages, isOlderGroupLoading, hasMoreGroupMessages } = get();
    if (isOlderGroupLoading || !hasMoreGroupMessages) return;
    const oldest = messages[0]?.createdAt ? new Date(messages[0].createdAt).getTime() : null;
    if (!oldest) return;
    set({ isOlderGroupLoading: true });
    try {
      const res = await axiosInstance.get(`/group-messages/${groupId}/messages?limit=100&beforeTs=${oldest}`);
      const older = Array.isArray(res.data) ? res.data : [];
      const seen = new Set((messages || []).map((m) => String(m._id)));
      const filtered = older.filter((m) => !seen.has(String(m._id)));
      set({ messages: [...filtered, ...messages], hasMoreGroupMessages: older.length >= 100 });
    } catch (_) {
      // silent
    } finally {
      set({ isOlderGroupLoading: false });
    }
  },

  // Mark group last-seen locally and schedule a debounced server update
  markGroupLastSeen: (groupId) => {
    try {
      const me = useAuthStore.getState().authUser;
      if (!me?._id || !groupId) return;
      const ts = Date.now();
      const key = `group_last_seen_${me._id}_${groupId}`;
      try { localStorage.setItem(key, String(ts)); } catch {}
      const { groupUnreadCounts } = get();
      if (groupUnreadCounts?.[groupId] > 0) {
        const { [String(groupId)]: _, ...rest } = groupUnreadCounts;
        set({ groupUnreadCounts: rest });
      }
      const timers = get().groupLastSeenTimers || {};
      const pending = { ...(get().groupLastSeenPendingTs || {}) };
      pending[groupId] = Math.max(Number(pending[groupId]) || 0, ts);
      if (timers[groupId]) clearTimeout(timers[groupId]);
      const t = setTimeout(() => {
        const sendTs = (get().groupLastSeenPendingTs || {})[groupId] || ts;
        axiosInstance.post(`/group-messages/last-seen`, { lastSeen: { [groupId]: sendTs } }).catch(() => {});
        const curTimers = get().groupLastSeenTimers || {};
        const { [groupId]: __, ...restTimers } = curTimers;
        set({ groupLastSeenTimers: restTimers });
      }, 2500);
      set({ groupLastSeenTimers: { ...timers, [groupId]: t }, groupLastSeenPendingTs: pending });
    } catch (_) {}
  },
  sendGroupMessage: async (groupId, messageData, options = {}) => {
    const { messages } = get();
    try {
      const axiosConfig = {};
      if (typeof options.onUploadProgress === "function") {
        axiosConfig.onUploadProgress = options.onUploadProgress;
      }
      const res = await axiosInstance.post(`/group-messages/${groupId}/messages`, messageData, axiosConfig);
      set({ messages: [...messages, res.data] });
    } catch (error) {
      // Improve error surfacing
      const status = error?.response?.status;
      const msg = error?.response?.data?.message;
      if (status === 403) {
        toast.error(msg || "You are not a member of this group");
      } else if (status === 404) {
        toast.error(msg || "Group not found");
      } else if (status === 413) {
        toast.error("Attachment too large");
      } else if (status >= 500) {
        toast.error(msg || "Server error while sending message");
      } else if (msg) {
        toast.error(msg);
      } else {
        toast.error("Failed to send message (network or unknown error)");
      }
      // Log full error for debugging
      logger.error("sendGroupMessage error:", error);
    }
  },
  // Pre-upload attachments using the same endpoint as individual chats
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
  subscribeToGroupMessages: () => {
    const socket = useAuthStore.getState().socket;
    const { selectedGroup } = get();
    if (!socket) return;
    const handler = (newMessage) => {
      if (selectedGroup && newMessage.groupId === selectedGroup._id) {
        set({ messages: [...get().messages, newMessage] });
      }
    };
    socket.on("group:newMessage", handler);
    const reactionHandler = ({ messageId, groupId, reactions }) => {
      const { selectedGroup } = get();
      if (!selectedGroup || String(groupId) !== String(selectedGroup._id)) return;
      const exists = get().messages.find((m) => String(m._id) === String(messageId));
      if (!exists) return;
      const updated = get().messages.map((m) => (String(m._id) === String(messageId) ? { ...m, reactions } : m));
      set({ messages: updated });
    };
    socket.on("group:reaction", reactionHandler);
    set({ _groupNewMessageHandler: handler, _groupReactionHandler: reactionHandler });
  },
  unsubscribeFromGroupMessages: () => {
    const socket = useAuthStore.getState().socket;
    const { _groupNewMessageHandler, _groupReactionHandler } = get();
    if (_groupNewMessageHandler) socket?.off("group:newMessage", _groupNewMessageHandler);
    if (_groupReactionHandler) socket?.off("group:reaction", _groupReactionHandler);
    set({ _groupNewMessageHandler: null, _groupReactionHandler: null });
  },

  // React to a group message
  reactToGroupMessage: async (messageId, emoji) => {
    try {
      const res = await axiosInstance.post(`/group-messages/${messageId}/react`, { emoji });
      const { _id, reactions } = res.data || {};
      const next = get().messages.map((m) => (String(m._id) === String(_id) ? { ...m, reactions } : m));
      set({ messages: next });
    } catch (error) {
      const msg = error?.response?.data?.message || "Failed to react";
      toast.error(msg);
    }
  },
  // Group typing indicators
  subscribeToGroupTyping: () => {
    const socket = useAuthStore.getState().socket;
    const { selectedGroup } = get();
    if (!socket) return;
    const typingHandler = ({ groupId, fromUserId }) => {
      if (!selectedGroup || groupId !== selectedGroup._id) return;
      const current = new Set(get().typingUserIds.map(String));
      current.add(String(fromUserId));
      set({ typingUserIds: Array.from(current) });
    };
    const stopTypingHandler = ({ groupId, fromUserId }) => {
      if (!selectedGroup || groupId !== selectedGroup._id) return;
      const next = get().typingUserIds.filter((id) => String(id) !== String(fromUserId));
      set({ typingUserIds: next });
    };
    socket.on("group:typing", typingHandler);
    socket.on("group:stopTyping", stopTypingHandler);
    set({ _groupTypingHandler: typingHandler, _groupStopTypingHandler: stopTypingHandler });
  },
  unsubscribeFromGroupTyping: () => {
    const socket = useAuthStore.getState().socket;
    const { _groupTypingHandler, _groupStopTypingHandler } = get();
    if (_groupTypingHandler) socket?.off("group:typing", _groupTypingHandler);
    if (_groupStopTypingHandler) socket?.off("group:stopTyping", _groupStopTypingHandler);
    set({ _groupTypingHandler: null, _groupStopTypingHandler: null });
    set({ typingUserIds: [] });
  },
  emitGroupTyping: () => {
    const socket = useAuthStore.getState().socket;
    const me = useAuthStore.getState().authUser;
    const { selectedGroup } = get();
    if (!socket || !selectedGroup || !me) return;
    socket.emit("group:typing", { groupId: selectedGroup._id, fromUserId: me._id });
  },
  emitGroupStopTyping: () => {
    const socket = useAuthStore.getState().socket;
    const me = useAuthStore.getState().authUser;
    const { selectedGroup } = get();
    if (!socket || !selectedGroup || !me) return;
    socket.emit("group:stopTyping", { groupId: selectedGroup._id, fromUserId: me._id });
  },
  // Global group message listener for unread counts
  subscribeToGlobalGroupMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.on("group:newMessage", (newMessage) => {
      const { selectedGroup, groupUnreadCounts } = get();
      const me = useAuthStore.getState().authUser;
      if (selectedGroup && newMessage.groupId === selectedGroup._id) return;
      // Respect mute settings: do not increment unread for muted groups
      if (get().isGroupMuted(newMessage.groupId)) return;
      // Ignore messages at or before last-seen timestamp for this group
      try {
        const key = `group_last_seen_${me?._id}_${newMessage.groupId}`;
        const lastSeen = Number(localStorage.getItem(key) || 0);
        const created = new Date(newMessage.createdAt || 0).getTime();
        if (lastSeen && created <= lastSeen) return;
      } catch {}
      const current = groupUnreadCounts[newMessage.groupId] || 0;
      set({ groupUnreadCounts: { ...groupUnreadCounts, [newMessage.groupId]: current + 1 } });
    });
  },
  // Listen for group profile/meta updates (e.g., avatar/description) and update local store
  subscribeToGroupUpdates: () => {
    const socket = useAuthStore.getState().socket;
    socket.on("group:updated", (updatedGroup) => {
      const updatedList = get().groups.map((g) => (g._id === updatedGroup._id ? updatedGroup : g));
      const isSelected = get().selectedGroup?._id === updatedGroup._id;
      set({ groups: updatedList, selectedGroup: isSelected ? updatedGroup : get().selectedGroup });
    });
  },
  unsubscribeFromGlobalGroupMessages: () => {
    const socket = useAuthStore.getState().socket;
    socket.off("group:newMessage");
  },
  getGroupUnreadCount: (groupId) => {
    const { groupUnreadCounts } = get();
    return groupUnreadCounts[groupId] || 0;
  },
  // Clear unread when selecting a group
  setSelectedGroup: (group) => {
    if (group) {
      const { groupUnreadCounts } = get();
      const copy = { ...groupUnreadCounts };
      delete copy[group._id];
      set({ selectedGroup: group, groupUnreadCounts: copy });
      // Persist last-seen timestamp for this group
      try {
        const me = useAuthStore.getState().authUser;
        const key = `group_last_seen_${me?._id}_${group._id}`;
        localStorage.setItem(key, String(Date.now()));
        axiosInstance.post(`/group-messages/last-seen`, { lastSeen: { [group._id]: Date.now() } }).catch(() => {});
      } catch {}
    } else {
      set({ selectedGroup: group });
    }
  },
  // Hydrate group unread counts on startup based on last-seen timestamps
  hydrateGroupUnreadCounts: async () => {
    try {
      const me = useAuthStore.getState().authUser;
      if (!me?._id) return;
      // Ensure groups list is loaded
      if (!get().groups || get().groups.length === 0) {
        try { await get().getGroups(); } catch {}
      }
      const groups = get().groups || [];
      const payload = { lastSeen: {} };
      let serverMap = {};
      try {
        const sres = await axiosInstance.get(`/group-messages/last-seen`);
        serverMap = sres.data || {};
      } catch {}
      for (const g of groups) {
        const key = `group_last_seen_${me._id}_${g._id}`;
        let lastSeen = 0;
        try { lastSeen = Number(localStorage.getItem(key) || 0); } catch {}
        const serverTs = Number(serverMap[g._id]) || 0;
        payload.lastSeen[g._id] = Math.max(serverTs, lastSeen || 0);
      }
      try {
        const res = await axiosInstance.post(`/group-messages/unread-counts`, payload);
        const counts = res.data || {};
        set({ groupUnreadCounts: counts });
      } catch (_) {
        // Best-effort hydration
      }
    } catch (_) { /* swallow */ }
  },

  // Group context menu actions
  toggleGroupPin: (groupId) => {
    const { pinnedGroupIds } = get();
    const exists = pinnedGroupIds.includes(groupId);
    set({ pinnedGroupIds: exists ? pinnedGroupIds.filter((id) => id !== groupId) : [...pinnedGroupIds, groupId] });
  },
  toggleGroupFavorite: (groupId) => {
    const { favoriteGroupIds } = get();
    const exists = favoriteGroupIds.includes(groupId);
    set({ favoriteGroupIds: exists ? favoriteGroupIds.filter((id) => id !== groupId) : [...favoriteGroupIds, groupId] });
  },
  toggleGroupMute: (groupId) => {
    const { mutedGroupIds, mutedUntilGroup } = get();
    const exists = mutedGroupIds.includes(groupId);
    if (exists) {
      const nextIds = mutedGroupIds.filter((id) => id !== groupId);
      const { [groupId]: _, ...rest } = mutedUntilGroup;
      set({ mutedGroupIds: nextIds, mutedUntilGroup: rest });
    } else {
      set({ mutedGroupIds: [...mutedGroupIds, groupId] });
    }
  },
  muteGroupFor: (groupId, ms) => {
    const { mutedUntilGroup, mutedGroupIds } = get();
    const deadline = Date.now() + ms;
    const nextIds = mutedGroupIds.filter((id) => id !== groupId);
    set({ mutedUntilGroup: { ...mutedUntilGroup, [groupId]: deadline }, mutedGroupIds: nextIds });
  },
  isGroupMuted: (groupId) => {
    const { mutedGroupIds, mutedUntilGroup } = get();
    if (mutedGroupIds.includes(groupId)) return true;
    const until = mutedUntilGroup[groupId];
    return typeof until === "number" && until > Date.now();
  },
  markGroupUnread: (groupId) => {
    const { groupUnreadCounts } = get();
    const current = groupUnreadCounts[groupId] || 0;
    set({ groupUnreadCounts: { ...groupUnreadCounts, [groupId]: Math.max(1, current || 1) } });
  },
  archiveGroup: (groupId) => {
    const { archivedGroupIds } = get();
    if (!archivedGroupIds.includes(groupId)) set({ archivedGroupIds: [...archivedGroupIds, groupId] });
  },
  clearGroupMessagesFor: (groupId) => {
    const { selectedGroup } = get();
    if (selectedGroup && String(selectedGroup._id) === String(groupId)) {
      set({ messages: [] });
    }
  },
}));

// Initialize global group listeners once socket connected
export function initializeGroupMessageListeners() {
  const socket = useAuthStore.getState().socket;
  if (!socket) return;
  if (socket._groupMessageListenersInitialized) return;
  socket._groupMessageListenersInitialized = true;
  const { subscribeToGlobalGroupMessages, subscribeToGroupUpdates } = useGroupStore.getState();
  subscribeToGlobalGroupMessages();
  subscribeToGroupUpdates();
}