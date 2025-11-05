import React from "react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

// Full emoji picker for composing messages.
// Props:
// - onSelect(emojiString)
// - onClose()
// - theme: "light" | "dark" (optional)
const EmojiPicker = ({ onSelect, onClose, theme = "dark" }) => {
  return (
    <div
      className="absolute z-50 bottom-12 right-0 bg-base-200 border border-base-300 rounded-xl shadow-2xl"
      role="dialog"
      aria-label="emoji picker"
    >
      <Picker
        data={data}
        theme={theme}
        navPosition="bottom"
        previewPosition="none"
        searchPosition="top"
        skinTonePosition="none"
        emojiVersion="14"
        onEmojiSelect={(emoji) => {
          const value = emoji?.native || emoji?.shortcodes || "";
          if (value) onSelect?.(value);
          // Do not auto-close; allow multiple selections while picker stays open
        }}
      />
    </div>
  );
};

export default EmojiPicker;