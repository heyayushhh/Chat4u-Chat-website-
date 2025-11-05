import { useEffect, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { useAuthStore } from "../store/useAuthStore";
import { useGroupStore } from "../store/useGroupStore";
import SidebarSkeleton from "./skeletons/SidebarSkeleton";
import { Users, Plus, Inbox, Pin, BellOff, Star, ChevronRight, ChevronLeft } from "lucide-react";
import ChatContextMenu from "./ChatContextMenu";
import GroupContextMenu from "./GroupContextMenu";

const Sidebar = () => {
  const {
    getUsers,
    users,
    selectedUser,
    setSelectedUser,
    isUsersLoading,
    sendContactRequest,
    fetchIncomingRequests,
    approveContactRequest,
    incomingRequests,
    isRequestsLoading,
    getUnreadCount,
    pinnedUserIds,
    mutedUserIds,
    archivedUserIds,
    togglePin,
    toggleMute,
    muteFor,
    markUnread,
    archiveChat,
    clearMessagesFor,
    isMuted,
  } = useChatStore();

  const {
    groups,
    getGroups,
    createGroup,
    setSelectedGroup,
    selectedGroup,
    getGroupUnreadCount,
    groupUnreadCounts,
    pinnedGroupIds,
    favoriteGroupIds,
    archivedGroupIds,
    isGroupMuted,
    toggleGroupPin,
    toggleGroupFavorite,
    toggleGroupMute,
    muteGroupFor,
    markGroupUnread,
    archiveGroup,
    clearGroupMessagesFor,
    leaveGroup,
  } = useGroupStore();

  const { onlineUsers } = useAuthStore();
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestUsername, setRequestUsername] = useState("");
  const [showRequests, setShowRequests] = useState(false);
  const [showGroups, setShowGroups] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, user: null });
  const [groupMenu, setGroupMenu] = useState({ visible: false, x: 0, y: 0, group: null });
  // Hide context menu whenever selection changes
  useEffect(() => {
    setMenu((m) => ({ ...m, visible: false }));
  }, [selectedUser?._id]);

  // On small screens, default to expanded so buttons/labels are accessible
  useEffect(() => {
    try {
      const isSmall = window.matchMedia && window.matchMedia("(max-width: 1024px)").matches;
      if (isSmall) setExpanded(true);
    } catch {}
  }, []);

  // Fetch incoming requests initially to show count badge
  useEffect(() => {
    fetchIncomingRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchIncomingRequests]);

  useEffect(() => {
    getUsers();
  }, [getUsers]);

  useEffect(() => {
    if (showRequests) fetchIncomingRequests();
  }, [showRequests, fetchIncomingRequests]);

  useEffect(() => {
    if (showGroups) getGroups();
  }, [showGroups, getGroups]);

  // Hide group context menu whenever group selection changes
  useEffect(() => {
    setGroupMenu((m) => ({ ...m, visible: false }));
  }, [selectedGroup?._id]);

  const filteredUsers = showOnlineOnly
    ? users.filter((user) => onlineUsers.includes(user._id))
    : users;

  // Apply archive filter and pin sorting
  const displayUsers = (() => {
    const unarchived = filteredUsers.filter((u) => !archivedUserIds.includes(u._id));
    return unarchived.sort((a, b) => {
      const ap = pinnedUserIds.includes(a._id) ? 1 : 0;
      const bp = pinnedUserIds.includes(b._id) ? 1 : 0;
      if (ap !== bp) return bp - ap; // pinned first
      return (a.username || "").localeCompare(b.username || "");
    });
  })();

  if (isUsersLoading) return <SidebarSkeleton />;

  const incomingCount = incomingRequests?.length || 0;
  const groupTotalUnread = Object.values(groupUnreadCounts || {}).reduce((sum, n) => sum + (Number(n) || 0), 0);
  return (
    <aside className={`h-full ${expanded ? "w-72" : "w-20 lg:w-80 xl:w-96"} border-r border-base-300 mr-4 flex flex-col transition-all duration-200 overflow-x-hidden`}>
      <div className="border-b border-base-300 w-full p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Users className="size-6" />
            <span className={`font-medium ${expanded ? "" : "hidden lg:block"}`}>Contacts</span>
            <button className="btn btn-ghost btn-xs lg:hidden" title={expanded ? "Collapse" : "Expand"} onClick={() => setExpanded((e) => !e)}>
              {expanded ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button className={`btn btn-xs ${showRequestForm ? "btn-primary" : ""} hover:bg-primary/20 transition-colors`} title="Send request" onClick={() => setShowRequestForm((s) => !s)}>
              <Plus className="size-4" />
              <span className={`${expanded ? "inline" : "hidden lg:inline"}`}>Request</span>
            </button>
            <button className={`btn btn-xs relative ${showRequests ? "btn-primary" : ""} hover:bg-primary/20 transition-colors`} title="Incoming requests" onClick={() => setShowRequests((s) => !s)}>
              <Inbox className="size-4" />
              <span className={`${expanded ? "inline" : "hidden lg:inline"}`}>Incoming</span>
              {incomingCount > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-500 rounded-full min-w-[18px] h-[18px] shadow-lg">
                  {incomingCount > 99 ? "99+" : incomingCount}
                </span>
              )}
            </button>
            <button className={`btn btn-xs relative ${showGroups ? "btn-primary" : ""}`} title="Groups" onClick={() => setShowGroups((s) => !s)}>
              <Users className="size-4" />
              <span className={`${expanded ? "inline" : "hidden lg:inline"}`}>Groups</span>
              {groupTotalUnread > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-500 rounded-full min-w-[18px] h-[18px] shadow-lg">
                  {groupTotalUnread > 9 ? "9+" : groupTotalUnread}
                </span>
              )}
            </button>
          </div>
        </div>
        {/* TODO: Online filter toggle */}
        <div className="mt-3 hidden lg:flex items-center gap-2">
          <label className="cursor-pointer flex items-center gap-2">
            <input
              type="checkbox"
              checked={showOnlineOnly}
              onChange={(e) => setShowOnlineOnly(e.target.checked)}
              className="checkbox checkbox-sm"
            />
            <span className="text-sm">Show online only</span>
          </label>
          <span className="text-xs text-zinc-500">({onlineUsers.length - 1} online)</span>
        </div>

        {showRequestForm && (
          <div className="mt-3 space-y-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Enter username"
                value={requestUsername}
                onChange={(e) => setRequestUsername(e.target.value)}
                className="input input-bordered w-full"
              />
            </div>
            <button
              className="btn btn-primary btn-sm w-full"
              onClick={async () => {
                if (!requestUsername.trim()) return;
                await sendContactRequest(requestUsername.trim());
                setRequestUsername("");
                setShowRequestForm(false);
              }}
            >
              Send Request
            </button>
          </div>
        )}

        {showRequests && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Incoming Requests</span>
              {isRequestsLoading && <span className="text-xs">Loading...</span>}
            </div>
            <div className="space-y-2">
              {incomingRequests.length === 0 && (
                <div className="text-xs text-zinc-500">No incoming requests</div>
              )}
              {incomingRequests.map((u) => (
                <div key={u._id} className="flex items-center justify-between p-2 rounded hover:bg-base-300 transition-colors">
                  <div className="flex items-center gap-2">
                    <img src={u.profilePic || "/avatar.png"} alt={u.username} className="size-6 rounded-full" />
                    <span className="text-sm">@{u.username}</span>
                  </div>
                  <button
                    className="btn btn-xs btn-primary"
                    onClick={() => approveContactRequest(u._id)}
                  >
                    Approve
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {showGroups && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Create Group</span>
            </div>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Group name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="input input-bordered w-full"
              />
              <div className="text-xs text-zinc-400">Select at least 2 members (max 11)</div>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {filteredUsers.map((u) => (
                  <label key={u._id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-xs"
                      checked={selectedMemberIds.includes(u._id)}
                      disabled={!selectedMemberIds.includes(u._id) && selectedMemberIds.length >= 11}
                      onChange={(e) => {
                        setSelectedMemberIds((prev) => {
                          if (e.target.checked) return [...prev, u._id];
                          return prev.filter((id) => id !== u._id);
                        });
                      }}
                    />
                    <img src={u.profilePic || "/avatar.png"} className="size-5 rounded-full" />
                    <span className="truncate">@{u.username}</span>
                  </label>
                ))}
              </div>
              <button
                className="btn btn-primary btn-sm w-full"
                disabled={selectedMemberIds.length < 2 || !groupName.trim()}
                onClick={async () => {
                  await createGroup(groupName.trim(), selectedMemberIds);
                  setGroupName("");
                  setSelectedMemberIds([]);
                }}
              >
                Create Group ({selectedMemberIds.length + 1}/12)
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-y-auto w-full py-3">
        {!showGroups && displayUsers.map((user) => {
          const unreadCount = getUnreadCount(user._id);
          
          return (
            <button
              key={user._id}
              onClick={() => { setSelectedUser(user); setMenu((m) => ({ ...m, visible: false })); }}
              onContextMenu={(e) => {
                e.preventDefault();
                setMenu({ visible: true, x: e.clientX, y: e.clientY, user });
              }}
              className={`
                w-full p-3 flex items-center gap-3
                hover:bg-base-300 transition-colors
                ${selectedUser?._id === user._id ? "bg-base-300 ring-1 ring-base-300" : ""}
              `}
            >
              <div className="relative mx-auto lg:mx-0">
                <img
                  src={user.profilePic || "/avatar.png"}
                  alt={user.name}
                  className="size-12 object-cover rounded-full"
                />
                {onlineUsers.includes(user._id) && (
                  <span
                    className="absolute bottom-0 right-0 size-3 bg-green-500 
                    rounded-full ring-2 ring-zinc-900"
                  />
                )}
                {/* Mobile notification badge */}
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 lg:hidden inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[18px] h-[18px] shadow-lg">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
                {pinnedUserIds.includes(user._id) && (
                  <span className="absolute -top-1 -left-1 hidden lg:inline-flex items-center justify-center bg-primary text-white rounded px-1 py-0.5 text-[10px] gap-1">
                    <Pin className="size-3" />
                  </span>
                )}
                {isMuted(user._id) && (
                  <span className="absolute -top-1 -right-1 hidden lg:inline-flex items-center justify-center bg-base-700 text-white rounded px-1 py-0.5 text-[10px] gap-1">
                    <BellOff className="size-3" />
                  </span>
                )}
              </div>

              {/* User info - only visible on larger screens */}
              <div className={`${expanded ? "block" : "hidden lg:block"} text-left min-w-0 flex-1`}>
                <div className="font-medium truncate">@{user.username}</div>
                <div className="text-sm text-zinc-400">
                  {user.isDeleted
                    ? "Dead user"
                    : onlineUsers.includes(user._id)
                    ? "Online"
                    : "Offline"}
                </div>
              </div>

              {/* Notification badge */}
              {unreadCount > 0 && (
                <div className="flex-shrink-0 lg:mr-2">
                  <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[20px] h-5 shadow-lg">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                </div>
              )}
            </button>
          );
        })}

        {!showGroups && filteredUsers.length === 0 && (
          <div className="text-center text-zinc-500 py-4">No online users</div>
        )}

        {showGroups && (() => {
          const unarchived = groups.filter((g) => !archivedGroupIds.includes(g._id));
          const sorted = unarchived.sort((a, b) => {
            const ap = pinnedGroupIds.includes(a._id) ? 1 : 0;
            const bp = pinnedGroupIds.includes(b._id) ? 1 : 0;
            if (ap !== bp) return bp - ap; // pinned first
            return (a.name || "").localeCompare(b.name || "");
          });
          return sorted;
        })().map((g) => (
          <button
            key={g._id}
            onClick={() => { setSelectedGroup(g); setSelectedUser(null); setGroupMenu((m) => ({ ...m, visible: false })); }}
            onContextMenu={(e) => {
              e.preventDefault();
              setGroupMenu({ visible: true, x: e.clientX, y: e.clientY, group: g });
            }}
            className={`
              w-full p-3 flex items-center gap-3
              hover:bg-base-300 transition-colors
              ${selectedGroup?._id === g._id ? "bg-base-300 ring-1 ring-base-300" : ""}
            `}
          >
            <div className="relative mx-auto lg:mx-0">
              <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="size-6 text-primary" />
              </div>
              {/* Mobile notification badge for groups */}
              {getGroupUnreadCount(g._id) > 0 && (
                <span className="absolute -top-1 -right-1 lg:hidden inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[18px] h-[18px] shadow-lg">
                  {getGroupUnreadCount(g._id) > 9 ? "9+" : getGroupUnreadCount(g._id)}
                </span>
              )}
              {pinnedGroupIds.includes(g._id) && (
                <span className="absolute -top-1 -left-1 hidden lg:inline-flex items-center justify-center bg-primary text-white rounded px-1 py-0.5 text-[10px] gap-1">
                  <Pin className="size-3" />
                </span>
              )}
              {favoriteGroupIds.includes(g._id) && (
                <span className="absolute -top-1 -left-6 hidden lg:inline-flex items-center justify-center bg-amber-500 text-white rounded px-1 py-0.5 text-[10px] gap-1">
                  <Star className="size-3" />
                </span>
              )}
              {isGroupMuted(g._id) && (
                <span className="absolute -top-1 -right-1 hidden lg:inline-flex items-center justify-center bg-base-700 text-white rounded px-1 py-0.5 text-[10px] gap-1">
                  <BellOff className="size-3" />
                </span>
              )}
            </div>
            <div className={`${expanded ? "block" : "hidden lg:block"} text-left min-w-0 flex-1`}>
              <div className="font-medium truncate">{g.name}</div>
              <div className="text-xs text-zinc-400 truncate">Members: {g.members?.length || 0}</div>
            </div>
            {/* Desktop notification badge for groups */}
            {getGroupUnreadCount(g._id) > 0 && (
              <div className="flex-shrink-0 lg:mr-2">
                <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full min-w-[20px] h-5 shadow-lg">
                  {getGroupUnreadCount(g._id) > 9 ? "9+" : getGroupUnreadCount(g._id)}
                </span>
              </div>
            )}
          </button>
        ))}

        {showGroups && groups.length === 0 && (
          <div className="text-center text-zinc-500 py-4">No groups yet</div>
        )}
      </div>
      {/* Context menu overlay */}
      <ChatContextMenu
        x={menu.x}
        y={menu.y}
        visible={menu.visible}
        user={menu.user}
        onClose={() => setMenu((m) => ({ ...m, visible: false }))}
        actions={{
          pinned: pinnedUserIds.includes(menu.user?._id || ""),
          muted: isMuted(menu.user?._id || ""),
          onTogglePin: (u) => togglePin(u._id),
          onToggleMute: (u) => toggleMute(u._id),
          onMuteFor: (u, ms) => muteFor(u._id, ms),
          onMarkUnread: (u) => markUnread(u._id),
          onArchive: (u) => archiveChat(u._id),
          onClearMessages: (u) => clearMessagesFor(u._id),
          onCloseChat: () => setSelectedUser(null),
          onAttachImage: (u) => {
            setSelectedUser(u);
            // Guide user to use the image button in the message input
            window.dispatchEvent(new CustomEvent("chat:hint-attach-image"));
          },
        }}
      />
      <GroupContextMenu
        x={groupMenu.x}
        y={groupMenu.y}
        visible={groupMenu.visible}
        group={groupMenu.group}
        onClose={() => setGroupMenu((m) => ({ ...m, visible: false }))}
        actions={{
          pinned: pinnedGroupIds.includes(groupMenu.group?._id || ""),
          favorited: favoriteGroupIds.includes(groupMenu.group?._id || ""),
          muted: isGroupMuted(groupMenu.group?._id || ""),
          onTogglePin: (g) => toggleGroupPin(g._id),
          onToggleFavorite: (g) => toggleGroupFavorite(g._id),
          onToggleMute: (g) => toggleGroupMute(g._id),
          onMuteFor: (g, ms) => muteGroupFor(g._id, ms),
          onMarkUnread: (g) => markGroupUnread(g._id),
          onArchive: (g) => archiveGroup(g._id),
          onClearMessages: (g) => clearGroupMessagesFor(g._id),
          onExitGroup: (g) => leaveGroup(g._id),
          onPopout: (g) => {
            try {
              const url = `${window.location.origin}?groupId=${g._id}&popout=1`;
              window.open(url, "_blank", "noopener,noreferrer");
            } catch {}
          },
        }}
      />
    </aside>
  );
};
export default Sidebar;
