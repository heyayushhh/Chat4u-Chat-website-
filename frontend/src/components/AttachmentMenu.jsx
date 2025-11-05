import React from "react";
import { FileText, User, BarChart3, PenTool, Image, Video } from "lucide-react";

// This menu is controlled by parent via conditional rendering.
// Props: onSelect(option), onClose()
const AttachmentMenu = ({ onClose, onSelect }) => {

  const attachmentOptions = [
    { id: "photos", label: "Photos", icon: Image, accept: "image/*" },
    {
      id: "video",
      label: "Video",
      icon: Video,
      // Allow common container formats and MIME types
      accept: [
        "video/*",
        "video/mp4",
        "video/quicktime",
        "video/x-msvideo",
        "video/x-flv",
        "video/x-matroska",
        "video/3gpp",
        ".mp4,.mov,.avi,.flv,.mkv,.3gp"
      ].join(",")
    },
    { id: "document", label: "PDF Document", icon: FileText, accept: "application/pdf,.pdf" },
    { id: "contact", label: "Contact", icon: User, disabled: true },
    { id: "poll", label: "Poll", icon: BarChart3, disabled: true },
    { id: "drawing", label: "Drawing", icon: PenTool, disabled: true },
  ];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      
      {/* Menu - anchored to the button container, stays within box */}
      <div className="absolute bottom-full right-0 mb-2 z-50 w-52 sm:w-56 bg-base-200 border border-base-300 rounded-lg shadow-xl overflow-hidden">
        <div className="py-2">
          {attachmentOptions.map((option) => (
            <button
              key={option.id}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-base-300 transition-colors ${
                option.disabled ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => {
                if (!option.disabled) {
                  onSelect(option);
                  onClose();
                }
              }}
              disabled={option.disabled}
            >
              <option.icon className="size-5 text-primary" />
              <span className="text-sm font-medium">{option.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};

export default AttachmentMenu;