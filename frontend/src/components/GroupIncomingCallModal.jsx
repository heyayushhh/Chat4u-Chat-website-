import { PhoneIncoming, PhoneOff } from "lucide-react";
import { useEffect } from "react";
import { useGroupCallStore } from "../store/useGroupCallStore";

const GroupIncomingCallModal = () => {
  const { showIncomingModal, initiator, callType, acceptGroupCall, declineGroupCall } = useGroupCallStore();

  // Hooks must be called unconditionally and in consistent order.
  // Play alert only when the modal becomes visible.
  useEffect(() => {
    if (!showIncomingModal) return;
    try {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(880, ctx.currentTime);
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.7);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.7);
    } catch (_) {}
  }, [showIncomingModal]);

  if (!showIncomingModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-base-100 rounded-xl shadow-lg p-6 w-[90%] max-w-sm border border-base-300">
        <div className="flex items-center gap-3 mb-4">
          <div className="avatar">
            <div className="w-12 h-12 rounded-full border">
              <img src={initiator?.profilePic || "/avatar.png"} alt="caller avatar" />
            </div>
          </div>
          <div>
            <p className="font-semibold">Incoming Group {callType === "video" ? "Video" : "Audio"} Call</p>
            <p className="text-sm text-base-content/70">From {initiator?.fullName} @{initiator?.username}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-success flex-1" onClick={acceptGroupCall}>
            <PhoneIncoming className="mr-2" /> Join
          </button>
          <button className="btn btn-error flex-1" onClick={declineGroupCall}>
            <PhoneOff className="mr-2" /> Decline
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupIncomingCallModal;