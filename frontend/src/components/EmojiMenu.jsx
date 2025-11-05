import React from "react";

// Simple emoji picker menu styled like AttachmentMenu.
// Props:
// - recent: array of emoji strings
// - onSelect(emoji)
// - onClose()
const EmojiMenu = ({ onSelect, onClose }) => {
  // Minimal Instagram-like set (no plus icon)
  const emojis = ["❤️", "😂", "😮", "😡", "👍"];

  return (
    <div
      className="rounded-full bg-base-200 border border-base-300 shadow-xl px-3 py-2 inline-flex items-center gap-2"
      role="dialog"
      aria-label="emoji menu"
    >
      {emojis.map((emoji, idx) => (
        <button
          key={`emoji-${idx}`}
          type="button"
          className="h-9 w-9 rounded-full hover:bg-base-300 flex items-center justify-center text-2xl"
          onClick={() => { onSelect?.(emoji); onClose?.(); }}
          aria-label={`emoji ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

export default EmojiMenu;