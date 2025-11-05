import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState, Fragment } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import FileAttachment from "./FileAttachment";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime, downloadImage, formatDayLabel, isSameDay, downloadFileWithProgress } from "../lib/utils";
import { Download, PhoneOff, Smile } from "lucide-react";
import toast from "react-hot-toast";
import EmojiMenu from "./EmojiMenu";

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
    getOlderMessages,
    isOlderLoading,
    hasMoreMessages,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const [downloadingFiles, setDownloadingFiles] = useState(new Set());
  const [downloadProgress, setDownloadProgress] = useState({});
  const [showEndedBanner, setShowEndedBanner] = useState(false);
  const [openEmojiForMessageId, setOpenEmojiForMessageId] = useState(null);
  const [emojiMenuPos, setEmojiMenuPos] = useState(null);

  const openEmojiMenuFor = (msgId, isMine, e) => {
    if (openEmojiForMessageId === msgId) {
      setOpenEmojiForMessageId(null);
      setEmojiMenuPos(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const sideRight = !isMine;
    // Position just above the icon, clamped within viewport
    const approxMenuHeight = 56; // compact pill height
    const approxMenuWidth = 240; // compact pill width
    const margin = 8; // small gap above icon
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

  const handleFileDownload = async (fileUrl, fileName, messageId) => {
    try {
      setDownloadingFiles(prev => new Set(prev).add(messageId));
      setDownloadProgress(prev => ({ ...prev, [messageId]: 0 }));
      await downloadFileWithProgress(fileUrl, fileName || `file-${messageId}`,(p)=>{
        setDownloadProgress(prev => ({ ...prev, [messageId]: p }));
      });
      toast.success("File downloaded successfully!");
    } catch (error) {
      toast.error("Failed to download file");
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(messageId);
        return newSet;
      });
      setDownloadProgress(prev => {
        const copy = { ...prev };
        delete copy[messageId];
        return copy;
      });
    }
  };

  useEffect(() => {
    if (!selectedUser?._id) return;
    getMessages(selectedUser._id);
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [selectedUser?._id, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Show a small banner when a DM call with this user ends
  useEffect(() => {
    const handler = (evt) => {
      const uid = String(evt?.detail?.userId || "");
      if (!uid || !selectedUser?._id) return;
      if (String(selectedUser._id) !== uid) return;
      setShowEndedBanner(true);
      const t = setTimeout(() => setShowEndedBanner(false), 6000);
      // Clean up timer when new events arrive before timeout
      return () => clearTimeout(t);
    };
    window.addEventListener("dm-call-ended", handler);
    return () => window.removeEventListener("dm-call-ended", handler);
  }, [selectedUser?._id]);

  // When window gains focus, mark last-seen for current DM (debounced)
  useEffect(() => {
    const handler = () => {
      if (selectedUser?._id) {
        try { useChatStore.getState().markDmLastSeen(selectedUser._id); } catch {}
      }
    };
    window.addEventListener("focus", handler);
    return () => window.removeEventListener("focus", handler);
  }, [selectedUser?._id]);

  // If no chat is selected, render a neutral state after hooks
  if (!selectedUser?._id) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex justify-center">
            <div className="px-3 py-1 rounded-lg text-[12px] bg-base-300 text-base-content/60">Select a chat to start messaging</div>
          </div>
        </div>
        <MessageInput />
      </div>
    );
  }

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  const handleScroll = (e) => {
    const top = e.currentTarget.scrollTop;
    if (top <= 50 && selectedUser?._id) {
      getOlderMessages(selectedUser._id);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4" onScroll={handleScroll}>
        {isOlderLoading && (
          <div className="flex justify-center">
            <div className="px-3 py-1 rounded-lg text-xs bg-base-300 text-base-content/80 shadow-sm">Loading older messages…</div>
          </div>
        )}
        {!hasMoreMessages && (
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
          // Ensure messages are sorted by time
          const sortedMessages = [...messages].sort(
            (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
          );

          let lastDate = null;

          return sortedMessages.map((message, idx) => {
            const showSeparator = !lastDate || !isSameDay(message.createdAt, lastDate);
            if (showSeparator) lastDate = message.createdAt;

            const isMine = message.senderId === authUser._id;
            const isReceived = !isMine;
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
                  className={`chat ${
                    isMine ? "chat-end" : "chat-start"
                  } ${entries.length > 0 ? "pb-8" : ""}`}
                  ref={messageEndRef}
                >
              <div className=" chat-image avatar">
                <div className="size-10 rounded-full border">
                  <img
                    src={
                      message.senderId === authUser._id
                      ? authUser.profilePic || "/avatar.png"
                      : selectedUser?.profilePic || "/avatar.png"
                    }
                    alt="profile pic"
                  />
                </div>
              </div>
              <div className="chat-header mb-1">
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
                      size: 0
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
                  className={`absolute ${isMine ? "-left-8" : "-right-8"} top-1/2 -translate-y-1/2 text-base-content/70 hover:text-base-content transition z-10 opacity-100`}
                  title="React"
                  onClick={(e) => openEmojiMenuFor(message._id, isMine, e)}
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
                        useChatStore.getState().reactToMessage(message._id, emoji);
                        setOpenEmojiForMessageId(null);
                        setEmojiMenuPos(null);
                      }}
                      onClose={() => { setOpenEmojiForMessageId(null); setEmojiMenuPos(null); }}
                    />
                  </div>
                )}
                {entries.length > 0 && (
                  <div className={`absolute top-full mt-2 ${isMine ? "right-0" : "left-0"} inline-flex gap-1 items-center` }>
                    {entries.map(([emoji, count]) => (
                      <span key={emoji} className="px-2 py-0.5 rounded-full bg-base-200 text-sm shadow-sm inline-flex items-center gap-1">
                        <span>{emoji}</span>
                        {count > 1 && <span className="text-xs text-base-content/70">{count}</span>}
                      </span>
                    ))}
                  </div>
                )}
              </div>
                </div>
              </Fragment>
            );
          });
        })()}
      </div>

      <MessageInput />
    </div>
  );
};
export default ChatContainer;
