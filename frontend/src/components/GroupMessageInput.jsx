import { useRef, useState, useEffect } from "react";
import { Paperclip, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import { useConfigStore } from "../store/useConfigStore";
import { useGroupStore } from "../store/useGroupStore";
import { logger } from "../lib/logger";
import { useAuthStore } from "../store/useAuthStore";
import AttachmentMenu from "./AttachmentMenu";
import EmojiPicker from "./EmojiPicker";

const GroupMessageInput = () => {
  const [text, setText] = useState("");
  // Multi-file attachments (up to 5)
  const [selectedFiles, setSelectedFiles] = useState([]); // [{ file, preview, type, name, size }]
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedAssets, setUploadedAssets] = useState([]); // [{ url, name, type, size, kind }]
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [recentEmojis, setRecentEmojis] = useState([]);
  const { selectedGroup, sendGroupMessage, preUploadAttachment, emitGroupTyping, emitGroupStopTyping } = useGroupStore();
  const { authUser } = useAuthStore();
  const isTypingRef = useRef(false);
  const typingTimerRef = useRef(null);
  const uploadCancelRef = useRef(false);

  const OLD_RECENT_EMOJI_KEY = "chatty:recentEmojis";
  const RECENT_EMOJI_KEY = "chat4u:recentEmojis";

  useEffect(() => {
    try {
      // Prefer new key; fallback to old key for migration
      const raw = localStorage.getItem(RECENT_EMOJI_KEY) || localStorage.getItem(OLD_RECENT_EMOJI_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setRecentEmojis(parsed);
      }
    } catch (_) {}
  }, []);

  const addRecentEmoji = (emoji) => {
    setRecentEmojis((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, 24);
      try {
        localStorage.setItem(RECENT_EMOJI_KEY, JSON.stringify(next));
        localStorage.removeItem(OLD_RECENT_EMOJI_KEY);
      } catch (_) {}
      return next;
    });
  };

  const insertEmojiAtCursor = (emoji) => {
    const inputEl = textInputRef.current;
    if (!inputEl) {
      setText((t) => `${t}${emoji}`);
      return;
    }
    const start = inputEl.selectionStart ?? text.length;
    const end = inputEl.selectionEnd ?? text.length;
    const newText = text.slice(0, start) + emoji + text.slice(end);
    setText(newText);
    requestAnimationFrame(() => {
      inputEl.focus();
      const pos = start + emoji.length;
      try { inputEl.setSelectionRange(pos, pos); } catch (_) {}
    });
  };

  const isMember = (() => {
    const members = selectedGroup?.members || [];
    const myId = String(authUser?._id || "");
    return members.map((m) => String(m?._id || m)).includes(myId);
  })();

  const validateFile = (file) => {
    const limits = useConfigStore.getState().limits;
    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isVideo = file.type.startsWith('video/') || /(\.mp4|\.mov|\.avi|\.flv|\.mkv|\.3gp)$/i.test(file.name || '');

    if (!isImage && !isPdf && !isVideo) {
      toast.error("Only images, videos, and PDF documents are supported.");
      return false;
    }
    const maxMB = isImage ? limits.imageMaxMB : isVideo ? limits.videoMaxMB : limits.pdfMaxMB;
    const maxBytes = maxMB * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(`File size must be ${maxMB}MB or less`);
      return false;
    }
    return true;
  };

  const handleFileChange = async (e) => {
    uploadCancelRef.current = false;
    if (!isMember) {
      toast.error("Join the group to send attachments");
      return;
    }
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const valid = files.filter((f) => validateFile(f));
    if (valid.length === 0) return;
    if (valid.length > 5) {
      toast.error("You can select up to 5 files at once.");
    }
    const chosen = valid.slice(0, 5);

    const prepare = async (file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        const preview = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
        return { file, preview, type: file.type, name: file.name, size: file.size };
      }
      return { file, preview: null, type: file.type, name: file.name, size: file.size };
    };

    const prepared = await Promise.all(chosen.map(prepare));
    setSelectedFiles(prepared);

    // Pre-upload for each file
    setIsUploading(true);
    setUploadProgress(0);
    const uploaded = [];
    for (let i = 0; i < prepared.length; i++) {
      const item = prepared[i];
      try {
        const result = await preUploadAttachment(
          item.type.startsWith('image/') ? { image: item.preview } : { file: item },
          {
            onUploadProgress: (evt) => {
              if (uploadCancelRef.current) return;
              const total = evt.total || item.size || 1;
              const percent = total ? Math.min(100, Math.round((evt.loaded / total) * 100)) : 0;
              const perFileShare = 100 / chosen.length;
              setUploadProgress(Math.min(100, Math.round(perFileShare * i + (perFileShare * percent) / 100)));
            },
          }
        );
        if (!uploadCancelRef.current) uploaded.push(result);
      } catch (err) {
        logger.error('Upload failed for', item.name, err);
        if (!uploadCancelRef.current) toast.error(`Upload failed for ${item.name}`);
      }
    }
    if (uploadCancelRef.current) {
      setIsUploading(false);
      return;
    }
    setUploadedAssets(uploaded);
    setIsUploading(false);
    setUploadProgress(100);
    toast.success(`${uploaded.length} file${uploaded.length !== 1 ? 's' : ''} uploaded. Press Enter to send.`);
  };

  const clearSelectedFiles = () => {
    uploadCancelRef.current = true;
    setSelectedFiles([]);
    setUploadedAssets([]);
    setUploadProgress(0);
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAttachmentSelect = (option) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = option.accept;
      fileInputRef.current.multiple = true;
      if (option.capture) {
        fileInputRef.current.capture = option.capture;
      } else {
        fileInputRef.current.removeAttribute('capture');
      }
      fileInputRef.current.click();
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && selectedFiles.length === 0) return;
    if (!selectedGroup?._id) return;
    if (!isMember) {
      toast.error("You are not a member of this group");
      return;
    }

    // Enforce message length limit client-side
    const limits = useConfigStore.getState().limits;
    const maxLen = limits.messageMaxLength;
    if (text && text.length > maxLen) {
      toast.error(`Message text must be ${maxLen} characters or fewer`);
      return;
    }

    // Prevent sending while attachments are still uploading
    if (selectedFiles.length > 0 && uploadedAssets.length < selectedFiles.length) {
      toast.error('Attachments are still uploading. Please wait.');
      return;
    }

    try {
      if (uploadedAssets.length === 0) {
        await sendGroupMessage(selectedGroup._id, { text: text.trim() });
      } else {
        for (let i = 0; i < uploadedAssets.length; i++) {
          const asset = uploadedAssets[i];
          const payload = {};
          if (i === 0 && text.trim()) payload.text = text.trim();
          if (asset.kind === 'image') {
            payload.imageUrl = asset.url;
          } else {
            payload.file = {
              url: asset.url,
              name: asset.name,
              type: asset.type,
              size: asset.size,
            };
          }
          await sendGroupMessage(selectedGroup._id, payload);
        }
      }

      setText("");
      clearSelectedFiles();
      // ensure typing indicator stops after sending
      if (isTypingRef.current) {
        isTypingRef.current = false;
        emitGroupStopTyping();
      }
    } catch (error) {
      logger.error("Failed to send group message:", error);
    }
  };

  const handleTextChange = (e) => {
    const value = e.target.value;
    setText(value);

    if (value.trim().length > 0) {
      if (!isTypingRef.current) {
        emitGroupTyping();
        isTypingRef.current = true;
      }
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        isTypingRef.current = false;
        emitGroupStopTyping();
      }, 1200);
    } else {
      clearTimeout(typingTimerRef.current);
      if (isTypingRef.current) {
        isTypingRef.current = false;
        emitGroupStopTyping();
      }
    }
  };

  // Multi-file upload handled in handleFileChange

  useEffect(() => {
    return () => {
      clearTimeout(typingTimerRef.current);
      if (isTypingRef.current) emitGroupStopTyping();
    };
  }, []);

  return (
    <div className="p-4 w-full">
      {selectedFiles.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex -space-x-1">
            {selectedFiles.slice(0, 5).map((f, idx) => (
              f.type.startsWith('image/') ? (
                <img key={idx} src={f.preview} alt="Preview" className="w-10 h-10 object-cover rounded-md border border-zinc-700" />
              ) : (
                <div key={idx} className="w-10 h-10 bg-zinc-700 rounded-md border border-zinc-600 flex items-center justify-center text-xs">
                  {f.type.startsWith('video/') ? '🎥' : '📄'}
                </div>
              )
            ))}
          </div>
          <div className="flex-1">
            <p className="text-sm text-zinc-300">{selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''} selected</p>
            <p className="text-xs text-zinc-400">{isUploading ? `Uploading… ${uploadProgress}%` : (uploadedAssets.length === selectedFiles.length ? 'Uploaded' : 'Pending upload')}</p>
          </div>
          <button onClick={clearSelectedFiles} className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white text-xs">
            <X size={12} />
          </button>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder={isMember ? "Type a message to the group..." : "Join the group to send messages"}
            value={text}
            onChange={handleTextChange}
    onKeyDown={(e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        // Send on Enter
        e.preventDefault();
        handleSendMessage(e);
      }
    }}
    onBlur={() => {
      clearTimeout(typingTimerRef.current);
      if (isTypingRef.current) {
        isTypingRef.current = false;
        emitGroupStopTyping();
      }
    }}
    disabled={!isMember}
    ref={textInputRef}
          />
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={!isMember}
            multiple
          />

          {/* Emoji button: full colorful picker only */}
          <div className="relative">
            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                className="btn btn-circle text-zinc-400"
                onClick={() => { setShowEmojiPicker((v) => !v); }}
                disabled={!isMember}
                title="All emojis"
              >
                <span className="text-xl">😀</span>
              </button>
            </div>
            {showEmojiPicker && (
              <>
                {/* Overlay to close picker on outside click */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowEmojiPicker(false)}
                />
                <EmojiPicker
                  onSelect={(emoji) => { insertEmojiAtCursor(emoji); addRecentEmoji(emoji); }}
                  onClose={() => setShowEmojiPicker(false)}
                  theme={document.documentElement.classList.contains('dark') ? 'dark' : 'light'}
                />
              </>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              className={`hidden sm:flex btn btn-circle ${selectedFiles.length > 0 ? "text-emerald-500" : "text-zinc-400"}`}
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              disabled={!isMember}
            >
              <Paperclip size={20} />
            </button>
            {showAttachmentMenu && (
              <AttachmentMenu
                onSelect={handleAttachmentSelect}
                onClose={() => setShowAttachmentMenu(false)}
              />
            )}
          </div>
        </div>
        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={
            !isMember ||
            isUploading ||
            (selectedFiles.length > 0 && uploadedAssets.length < selectedFiles.length) ||
            (!text.trim() && selectedFiles.length === 0)
          }
        >
          <Send size={22} />
        </button>
      </form>
    </div>
  );
};

export default GroupMessageInput;