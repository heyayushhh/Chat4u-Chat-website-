import { useEffect, useRef, useState, Fragment } from "react";
import { useGroupStore } from "../store/useGroupStore";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import GroupChatHeader from "./GroupChatHeader";
import GroupMessageInput from "./GroupMessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import FileAttachment from "./FileAttachment";
import { formatMessageTime, downloadImage, formatDayLabel, isSameDay, downloadFileWithProgress } from "../lib/utils";
import { Download, PhoneOff, Smile } from "lucide-react";
import toast from "react-hot-toast";
import GroupInfo from "./GroupInfo";
import { axiosInstance } from "../lib/axios";
import EmojiMenu from "./EmojiMenu";

const GroupChatContainer = () => {
  const {
    selectedGroup,
    messages,
    getGroupMessages,
    isMessagesLoading,
    subscribeToGroupMessages,
    unsubscribeFromGroupMessages,
    subscribeToGroupTyping,
    unsubscribeFromGroupTyping,
    getOlderGroupMessages,
    isOlderGroupLoading,
    hasMoreGroupMessages,
  } = useGroupStore();
  const { authUser } = useAuthStore();
  const { users } = useChatStore();
  const messageEndRef = useRef(null);
  const [downloadingFiles, setDownloadingFiles] = useState(new Set());
  const [downloadProgress, setDownloadProgress] = useState({});
  const [showInfo, setShowInfo] = useState(false);
  const [resolvedUsers, setResolvedUsers] = useState({}); // { userId: { username, profilePic } }
  const [showEndedBanner, setShowEndedBanner] = useState(false);
  const [openEmojiForMessageId, setOpenEmojiForMessageId] = useState(null);
  const [emojiMenuPos, setEmojiMenuPos] = useState(null);
  const [openReactionInfo, setOpenReactionInfo] = useState(null); // { messageId, emoji }
  const [reactionInfoPos, setReactionInfoPos] = useState(null); // { top, left, side }

  const openEmojiMenuFor = (msgId, isMe, e) => {
    if (openEmojiForMessageId === msgId) {
      setOpenEmojiForMessageId(null);
      setEmojiMenuPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const sideRight = !isMe;
    // Position just above the icon, clamped within viewport
    const approxMenuHeight = 56;
    const approxMenuWidth = 240;
    const margin = 8;
    const maxTop = window.innerHeight - approxMenuHeight - margin;
    let top = rect.top - approxMenuHeight - margin;
    top = Math.max(margin, Math.min(top, maxTop));
    let left;
    if (sideRight) {
      left = Math.min(rect.right + margin, window.innerWidth - approxMenuWidth - margin);
    } else {
      const rightEdge = rect.left - margin;
      left = Math.max(rightEdge, approxMenuWidth + margin);
    }
    setEmojiMenuPos({ top, left, side: sideRight ? "right" : "left" });
    setOpenEmojiForMessageId(msgId);
  };

  const openReactionInfoFor = (msgId, emoji, isMe, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sideRight = !isMe;
    const approxBoxHeight = 140;
    const approxBoxWidth = 220;
    const margin = 8;
    let top = rect.bottom + margin;
    const maxTop = window.innerHeight - approxBoxHeight - margin;
    top = Math.max(margin, Math.min(top, maxTop));
    let left;
    if (sideRight) {
      left = Math.min(rect.right + margin, window.innerWidth - approxBoxWidth - margin);
    } else {
      const rightEdge = rect.left - margin;
      left = Math.max(rightEdge, approxBoxWidth + margin);
    }
    setReactionInfoPos({ top, left, side: sideRight ? "right" : "left" });
    setOpenReactionInfo({ messageId: msgId, emoji });
  };

  useEffect(() => {
    if (!selectedGroup?._id) return;
    const isMember = (selectedGroup.members || [])
      .map((m) => String(m?._id || m))
      .includes(String(authUser?._id));
    if (!isMember) {
      // Skip fetching to avoid repeated 403 toast loops when viewing non-member groups
      return;
    }
    getGroupMessages(selectedGroup._id);
    subscribeToGroupMessages();
    subscribeToGroupTyping();
    return () => {
      unsubscribeFromGroupMessages();
      unsubscribeFromGroupTyping();
    };
  }, [selectedGroup?._id, getGroupMessages, subscribeToGroupMessages, unsubscribeFromGroupMessages, subscribeToGroupTyping, unsubscribeFromGroupTyping]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Show a small banner when the selected group's active call ends
  useEffect(() => {
    const handler = (evt) => {
      const gid = String(evt?.detail?.groupId || "");
      if (!gid || !selectedGroup?._id) return;
      if (String(selectedGroup._id) !== gid) return;
      setShowEndedBanner(true);
      const t = setTimeout(() => setShowEndedBanner(false), 6000);
      return () => clearTimeout(t);
    };
    window.addEventListener("group-call-ended", handler);
    return () => window.removeEventListener("group-call-ended", handler);
  }, [selectedGroup?._id]);

  // Resolve usernames for group members that may be bare IDs
  useEffect(() => {
    const members = selectedGroup?.members || [];
    const contactIdSet = new Set((users || []).map((u) => String(u._id)));
    const toResolve = members
      .map((m) => (m ? m._id || m : null))
      .filter(Boolean)
      .filter((id) => {
        const mem = members.find((mm) => {
          const mid = mm ? mm._id || mm : null;
          return String(mid || "") === String(id);
        });
        const hasUsernameInline = typeof mem === "object" && !!mem.username;
        const alreadyResolved = !!resolvedUsers[String(id)];
        const isContact = contactIdSet.has(String(id));
        return !hasUsernameInline && !alreadyResolved && !isContact;
      });

    const run = async () => {
      for (const id of toResolve) {
        try {
          const res = await axiosInstance.get(`/users/${id}`);
          const { username, profilePic } = res.data || {};
          setResolvedUsers((prev) => ({ ...prev, [String(id)]: { username, profilePic } }));
        } catch (_) {
          // ignore best-effort failures
        }
      }
    };

    if (selectedGroup?._id) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup?._id, selectedGroup?.members, users]);

  // When window gains focus, mark last-seen for current group (debounced)
  useEffect(() => {
    const handler = () => {
      if (selectedGroup?._id) {
        try { useGroupStore.getState().markGroupLastSeen(selectedGroup._id); } catch {}
      }
    };
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [selectedGroup?._id]);

  const resolveSender = (senderId) => {
    if (String(senderId) === String(authUser?._id)) {
      return { username: authUser?.username, profilePic: authUser?.profilePic };
    }
    const m = (selectedGroup?.members || []).find((mem) => String(mem._id || mem) === String(senderId));
    // Try contacts if not in group members or missing username
    const contact = (users || []).find((u) => String(u._id) === String(senderId));
    const cached = resolvedUsers[String(senderId)] || {};
    return {
      username: m?.username || contact?.username || cached.username || "unknown",
      profilePic: m?.profilePic || contact?.profilePic || cached.profilePic || "/avatar.png",
    };
  };

  const handleFileDownload = async (fileUrl, fileName, messageId) => {
    try {
      setDownloadingFiles((prev) => new Set(prev).add(messageId));
      setDownloadProgress((prev) => ({ ...prev, [messageId]: 0 }));
      await downloadFileWithProgress(fileUrl, fileName || `file-${messageId}`,(p)=>{
        setDownloadProgress((prev) => ({ ...prev, [messageId]: p }));
      });
      toast.success("File downloaded successfully!");
    } catch (e) {
      toast.error("Failed to download file");
    } finally {
      setDownloadingFiles((prev) => {
        const copy = new Set(prev);
        copy.delete(messageId);
        return copy;
      });
      setDownloadProgress((prev) => {
        const copy = { ...prev };
        delete copy[messageId];
        return copy;
      });
    }
  };

  if (showInfo) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <GroupChatHeader onOpenInfo={() => setShowInfo(true)} />
        <GroupInfo onBack={() => setShowInfo(false)} />
      </div>
    );
  }

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <GroupChatHeader onOpenInfo={() => setShowInfo(true)} />
        <MessageSkeleton />
        <GroupMessageInput />
      </div>
    );
  }

  const handleScroll = (e) => {
    const el = e.currentTarget;
    const top = el.scrollTop;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (top <= 50 && selectedGroup?._id) {
      getOlderGroupMessages(selectedGroup._id);
    }
    if (distanceToBottom <= 40 && selectedGroup?._id) {
      try { useGroupStore.getState().markGroupLastSeen(selectedGroup._id); } catch {}
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <GroupChatHeader onOpenInfo={() => setShowInfo(true)} />

      <div className="flex-1 overflow-y-auto p-4 space-y-4" onScroll={handleScroll}>
        {isOlderGroupLoading && (
          <div className="flex justify-center">
            <div className="px-3 py-1 rounded-lg text-xs bg-base-300 text-base-content/80 shadow-sm">Loading older messages…</div>
          </div>
        )}
        {!hasMoreGroupMessages && (
          <div className="flex justify-center">
            <div className="px-3 py-1 rounded-lg text-[11px] bg-base-300 text-base-content/60">No more messages</div>
          </div>
        )}
        {showEndedBanner && (
          <div className="flex justify-center">
            <div className="px-3 py-1 rounded-lg text-xs bg-base-300 text-base-content/80 inline-flex items-center gap-2 shadow-sm">
              <PhoneOff className="size-3 text-error" />
              Active call ended
            </div>
          </div>
        )}
        {(() => {
          const sortedMessages = [...messages].sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
          );

          let lastDate = null;

          return sortedMessages.map((message) => {
            const showSeparator = !lastDate || !isSameDay(message.createdAt, lastDate);
            if (showSeparator) lastDate = message.createdAt;

            const sender = resolveSender(message.senderId);
            const isMe = String(message.senderId) === String(authUser?._id);

            const counts = {};
            for (const r of message.reactions || []) {
              counts[r.emoji] = (counts[r.emoji] || 0) + 1;
            }
            const entries = Object.entries(counts);

            return (
              <Fragment key={message._id}>
                {showSeparator && (
                  <div className="flex justify-center">
                    <div className="px-3 py-1 rounded-lg text-xs bg-base-300 text-base-content/80 shadow-sm">
                      {formatDayLabel(message.createdAt)}
                    </div>
                  </div>
                )}
                <div
                  className={`chat ${isMe ? "chat-end" : "chat-start"} ${entries.length > 0 ? "pb-8" : ""}`}
                  ref={messageEndRef}
                >
                  <div className=" chat-image avatar">
                    <div className="size-10 rounded-full border">
                      <img
                        src={isMe ? authUser?.profilePic || "/avatar.png" : sender.profilePic || "/avatar.png"}
                        alt="profile pic"
                      />
                    </div>
                  </div>
                  <div className="chat-header mb-1">
                    <span className="text-xs opacity-80">@{isMe ? authUser?.username : sender.username}</span>
                    <time className="text-xs opacity-50 ml-1">
                      {formatMessageTime(message.createdAt)}
                    </time>
                  </div>
                  <div className="chat-bubble flex flex-col relative group max-w-[75%] sm:max-w-[70%] md:max-w-[60%] whitespace-pre-wrap break-words">
                    {message.image && (
                      <FileAttachment
                        file={{
                          url: message.image,
                          name: `image-${message._id}`,
                          type: 'image/jpeg',
                          size: 0,
                        }}
                        onDownload={(url, name) => handleFileDownload(url, name, message._id)}
                        isDownloading={downloadingFiles.has(message._id)}
                        progress={downloadProgress[message._id]}
                      />
                    )}
                    {message.file && (
                      <FileAttachment
                        file={message.file}
                        onDownload={(url, name) => handleFileDownload(url, name, message._id)}
                        isDownloading={downloadingFiles.has(message._id)}
                        progress={downloadProgress[message._id]}
                      />
                    )}
                    {message.text && (
                      <p className="whitespace-pre-wrap break-words" style={{ overflowWrap: "anywhere" }}>
                        {message.text}
                      </p>
                    )}
                    <button
                      className={`absolute ${isMe ? "-left-8" : "-right-8"} top-1/2 -translate-y-1/2 text-base-content/70 hover:text-base-content transition z-10 opacity-100`}
                      title="React"
                      onClick={(e) => openEmojiMenuFor(message._id, isMe, e)}
                    >
                      <Smile className="size-4" />
                    </button>
                    {openEmojiForMessageId === message._id && (
                      <div className="fixed inset-0 z-10" onClick={() => setOpenEmojiForMessageId(null)} />
                    )}
                    {openEmojiForMessageId === message._id && emojiMenuPos && (
                      <div
                        className="fixed z-50"
                        style={{
                          top: emojiMenuPos.top,
                          left: emojiMenuPos.left,
                          transform: `translate(${emojiMenuPos.side === "left" ? "-100%" : "0"}, 0)`
                        }}
                      >
                        <EmojiMenu
                          recent={[]}
                          onSelect={(emoji) => {
                            useGroupStore.getState().reactToGroupMessage(message._id, emoji);
                            setOpenEmojiForMessageId(null);
                            setEmojiMenuPos(null);
                          }}
                          onClose={() => { setOpenEmojiForMessageId(null); setEmojiMenuPos(null); }}
                        />
                      </div>
                    )}
                    {entries.length > 0 && (
                      <div className={`absolute top-full mt-2 ${isMe ? "right-0" : "left-0"} inline-flex gap-1 items-center` }>
                        {entries.map(([emoji, count]) => (
                          <button
                            key={emoji}
                            className="px-2 py-0.5 rounded-full bg-base-200 text-sm shadow-sm inline-flex items-center gap-1 hover:bg-base-300"
                            onClick={(e) => openReactionInfoFor(message._id, emoji, isMe, e)}
                            title="View who reacted"
                          >
                            <span>{emoji}</span>
                            {count > 1 && <span className="text-xs text-base-content/70">{count}</span>}
                          </button>
                        ))}
                      </div>
                    )}

                    {openReactionInfo && openReactionInfo.messageId === message._id && reactionInfoPos && (
                      <div
                        className="fixed z-40"
                        style={{
                          top: reactionInfoPos.top,
                          left: reactionInfoPos.left,
                          transform: `translate(${reactionInfoPos.side === "left" ? "-100%" : "0"}, 0)`
                        }}
                      >
                        <div className="bg-base-200 rounded-lg shadow-lg p-2 w-[220px] text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm">{openReactionInfo.emoji}</span>
                            <span className="text-[11px] text-base-content/70">Reacted by</span>
                          </div>
                          <div className="max-h-40 overflow-auto space-y-1">
                            {(() => {
                              const selected = (message.reactions || []).filter((r) => r.emoji === openReactionInfo.emoji);
                              if (selected.length === 0) {
                                return <div className="text-base-content/60">No reactions</div>;
                              }
                              return selected.map((r, idx) => {
                                const u = resolveSender(r.userId);
                                return (
                                  <div key={`${String(r.userId)}-${idx}`} className="flex items-center gap-2">
                                    <img src={u.profilePic || "/avatar.png"} alt="avatar" className="size-4 rounded-full border" />
                                    <span className="text-[12px]">@{u.username || "unknown"}</span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      </div>
                    )}
                    {openReactionInfo && (
                      <div className="fixed inset-0 z-30" onClick={() => { setOpenReactionInfo(null); setReactionInfoPos(null); }} />
                    )}
                  </div>
                </div>
              </Fragment>
            );
          });
        })()}
      </div>

      <GroupMessageInput />
    </div>
  );
};

export default GroupChatContainer;