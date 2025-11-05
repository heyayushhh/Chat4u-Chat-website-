import { X, Phone, Video, PhoneOff } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { useCallStore, initializeCallSocketListeners } from "../store/useCallStore";
import { useState } from "react";
import UserProfileModal from "./UserProfileModal";

const ChatHeader = () => {
  const { selectedUser, setSelectedUser, isPartnerTyping } = useChatStore();
  const { onlineUsers } = useAuthStore();
  const { startCall, endCall, inCall } = useCallStore();
  const [showProfile, setShowProfile] = useState(false);

  // bind socket listeners when header mounts (once)
  initializeCallSocketListeners();

  // When no user is selected, render nothing to avoid null property access
  if (!selectedUser) return null;

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="avatar">
            <button
              className="size-10 rounded-full relative overflow-hidden border hover:ring-2 hover:ring-primary transition"
              onClick={() => setShowProfile(true)}
              title="View profile"
            >
              <img src={selectedUser?.profilePic || "/avatar.png"} alt={selectedUser?.username || "user"} />
            </button>
          </div>

          {/* User info */}
          <div>
            <button className="font-medium hover:underline" onClick={() => setShowProfile(true)} title="View profile">
              @{selectedUser?.username || "unknown"}
            </button>
            <p className="text-sm text-base-content/70">
              {selectedUser.isDeleted
                ? "Dead user"
                : isPartnerTyping
                ? "Typing…"
                : onlineUsers.includes(selectedUser?._id)
                ? "Online"
                : "Offline"}
            </p>
          </div>
        </div>

        {/* Call controls + Close */}
        <div className="flex items-center gap-2">
          {inCall && <span className="badge badge-primary">In call</span>}
          <button
            className="btn btn-sm btn-ghost"
            disabled={!selectedUser || inCall}
            onClick={() => selectedUser && startCall(selectedUser, "audio")}
            title="Start audio call"
          >
            <Phone size={18} />
          </button>
          <button
            className="btn btn-sm btn-ghost"
            disabled={!selectedUser || inCall}
            onClick={() => selectedUser && startCall(selectedUser, "video")}
            title="Start video call"
          >
            <Video size={18} />
          </button>
          {inCall && (
            <button className="btn btn-sm btn-error" onClick={endCall} title="End call">
              <PhoneOff size={18} />
            </button>
          )}
          <button className="btn btn-sm btn-ghost" onClick={() => setSelectedUser(null)} title="Close">
            <X />
          </button>
        </div>
      </div>
      <UserProfileModal userId={selectedUser?._id} isOpen={showProfile} onClose={() => setShowProfile(false)} />
    </div>
  );
};
export default ChatHeader;
