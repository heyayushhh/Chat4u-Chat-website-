import { useState } from "react";
import { Pin, PinOff, Bell, BellOff, XCircle, Trash2, Image, EyeOff, CheckCircle } from "lucide-react";

// Simple context menu for chat items. Controlled by parent (Sidebar).
const ChatContextMenu = ({ x, y, visible, onClose, user, actions }) => {
  if (!visible || !user) return null;

  const {
    pinned,
    muted,
    onTogglePin,
    onToggleMute,
    onMarkUnread,
    onClearMessages,
    onAttachImage,
    onCloseChat,
    onArchive,
  } = actions || {};

  const [showMuteMenu, setShowMuteMenu] = useState(false);

  return (
    <>
      {/* Click-away backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        style={{ left: x, top: y }}
        className="fixed z-50 w-56 bg-base-200 border border-base-300 rounded-lg shadow-xl overflow-visible"
        onContextMenu={(e) => e.preventDefault()}
      >
      <div className="px-3 py-2 text-sm font-medium border-b border-base-300 truncate">
        @{user.username || user.fullName || "user"}
      </div>

      <ul className="py-1 text-sm">
        <li>
          <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-300" onClick={() => { onAttachImage?.(user); onClose(); }}>
            <Image className="size-4" /> Attach image
          </button>
        </li>
        <li>
          <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-300" onClick={() => { onTogglePin?.(user); onClose(); }}>
            {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />} {pinned ? "Unpin from top" : "Pin to top"}
          </button>
        </li>
        <li className="relative">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-300"
            onClick={() => {
              if (muted) {
                onToggleMute?.(user);
                onClose();
              } else {
                setShowMuteMenu((s) => !s);
              }
            }}
          >
            {muted ? <BellOff className="size-4" /> : <Bell className="size-4" />} {muted ? "Unmute" : "Mute"}
          </button>
          {!muted && showMuteMenu && (
            <div className="absolute left-full top-0 ml-1 min-w-[160px] bg-base-200 border border-base-300 rounded shadow-xl z-50">
              <button
                className="w-full text-left px-3 py-2 hover:bg-base-300"
                onClick={() => { actions?.onMuteFor?.(user, 8 * 60 * 60 * 1000); onClose(); }}
              >
                For 8 hours
              </button>
              <button
                className="w-full text-left px-3 py-2 hover:bg-base-300"
                onClick={() => { actions?.onMuteFor?.(user, 7 * 24 * 60 * 60 * 1000); onClose(); }}
              >
                For 1 week
              </button>
              <button
                className="w-full text-left px-3 py-2 hover:bg-base-300"
                onClick={() => { onToggleMute?.(user); onClose(); }}
              >
                Always
              </button>
            </div>
          )}
        </li>
        <li>
          <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-300" onClick={() => { onMarkUnread?.(user); onClose(); }}>
            <CheckCircle className="size-4" /> Mark as unread
          </button>
        </li>
        <li>
          <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-300" onClick={() => { onArchive?.(user); onClose(); }}>
            <EyeOff className="size-4" /> Archive chat
          </button>
        </li>
        <li>
          <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-300" onClick={() => { onClearMessages?.(user); onClose(); }}>
            <Trash2 className="size-4" /> Clear messages
          </button>
        </li>
        <li>
          <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-300" onClick={() => { onCloseChat?.(user); onClose(); }}>
            <XCircle className="size-4" /> Close chat
          </button>
        </li>
      </ul>
      </div>
    </>
  );
};

export default ChatContextMenu;