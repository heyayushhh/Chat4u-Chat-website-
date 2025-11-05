import { useState } from "react";
import { Pin, PinOff, Bell, BellOff, EyeOff, Trash2, CheckCircle, Star, StarOff, LogOut, ExternalLink } from "lucide-react";

// Context menu for group items. Controlled by parent (Sidebar).
const GroupContextMenu = ({ x, y, visible, onClose, group, actions }) => {
  if (!visible || !group) return null;

  const {
    pinned,
    favorited,
    muted,
    onTogglePin,
    onToggleFavorite,
    onToggleMute,
    onMuteFor,
    onMarkUnread,
    onArchive,
    onClearMessages,
    onExitGroup,
    onPopout,
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
          {group.name || "Group"}
        </div>

        <ul className="py-1 text-sm">
          <li>
            <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-300" onClick={() => { onMarkUnread?.(group); onClose(); }}>
              <CheckCircle className="size-4" /> Mark as unread
            </button>
          </li>
          <li>
            <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-300" onClick={() => { onTogglePin?.(group); onClose(); }}>
              {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />} {pinned ? "Unpin from top" : "Pin to top"}
            </button>
          </li>
          <li>
            <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-300" onClick={() => { onToggleFavorite?.(group); onClose(); }}>
              {favorited ? <StarOff className="size-4" /> : <Star className="size-4" />} {favorited ? "Remove from favorites" : "Add to favorites"}
            </button>
          </li>
          <li className="relative">
            <button
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-300"
              onClick={() => {
                if (muted) {
                  onToggleMute?.(group);
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
                  onClick={() => { onMuteFor?.(group, 8 * 60 * 60 * 1000); onClose(); }}
                >
                  For 8 hours
                </button>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-base-300"
                  onClick={() => { onMuteFor?.(group, 7 * 24 * 60 * 60 * 1000); onClose(); }}
                >
                  For 1 week
                </button>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-base-300"
                  onClick={() => { onToggleMute?.(group); onClose(); }}
                >
                  Always
                </button>
              </div>
            )}
          </li>
          <li>
            <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-300" onClick={() => { onArchive?.(group); onClose(); }}>
              <EyeOff className="size-4" /> Archive chat
            </button>
          </li>
          <li>
            <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-300" onClick={() => { onClearMessages?.(group); onClose(); }}>
              <Trash2 className="size-4" /> Clear messages
            </button>
          </li>
          <li>
            <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-300" onClick={() => { onExitGroup?.(group); onClose(); }}>
              <LogOut className="size-4" /> Exit group
            </button>
          </li>
          <li>
            <button className="w-full flex items-center gap-2 px-3 py-2 hover:bg-base-300" onClick={() => { onPopout?.(group); onClose(); }}>
              <ExternalLink className="size-4" /> Pop-out chat
            </button>
          </li>
        </ul>
      </div>
    </>
  );
};

export default GroupContextMenu;