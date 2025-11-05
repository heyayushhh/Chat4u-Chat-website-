import { useEffect } from "react";
import { PhoneIncoming, PhoneOff, Video } from "lucide-react";
import { useCallStore } from "../store/useCallStore";

const IncomingCallModal = () => {
  const { showIncomingModal, caller, callType, acceptCall, declineCall } = useCallStore();

  useEffect(() => {
    // optionally play a sound here
  }, [showIncomingModal]);

  if (!showIncomingModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-xl shadow-lg p-6 w-[90%] max-w-sm border border-base-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="avatar">
            <div className="w-12 h-12 rounded-full border">
              <img src={caller?.profilePic || "/avatar.png"} alt="caller avatar" />
            </div>
          </div>
          <div>
            <p className="font-semibold">Incoming {callType === "video" ? "Video" : "Audio"} Call</p>
            <p className="text-sm text-base-content/70">{caller?.fullName} @{caller?.username}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-success flex-1" onClick={acceptCall}>
            <PhoneIncoming className="mr-2" /> Accept
          </button>
          <button className="btn btn-error flex-1" onClick={declineCall}>
            <PhoneOff className="mr-2" /> Decline
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;