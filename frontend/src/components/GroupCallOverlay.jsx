import { useEffect, useRef, useState } from "react";
import { PhoneOff, Mic, MicOff, Video, VideoOff, CameraOff } from "lucide-react";
import { useGroupCallStore } from "../store/useGroupCallStore";

const GroupCallOverlay = () => {
  const { inGroupCall, localStream, callType, endGroupCall, group, participants, callStartAt, hasLocalVideo, toggleMute, isMuted, remoteStreams } = useGroupCallStore();
  const localRef = useRef(null);
  const [elapsed, setElapsed] = useState("00:00");

  useEffect(() => {
    if (localRef.current && localStream) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (!callStartAt) return;
    const format = (ms) => {
      const total = Math.floor(ms / 1000);
      const m = String(Math.floor(total / 60)).padStart(2, "0");
      const s = String(total % 60).padStart(2, "0");
      return `${m}:${s}`;
    };
    const id = setInterval(() => setElapsed(format(Date.now() - callStartAt)), 1000);
    setElapsed(format(Date.now() - callStartAt));
    return () => clearInterval(id);
  }, [callStartAt]);

  if (!inGroupCall) return null;

  const totalTiles = 1 + (participants?.length || 0); // local tile + participant tiles

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40">
      <div className="relative bg-base-100 rounded-xl shadow-2xl p-4 border border-base-300 w-[95%] max-w-5xl">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {/* Local tile */}
            <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
              {(!hasLocalVideo || callType !== "video") && (
                <div className="absolute inset-0 flex items-center justify-center text-base-100/70">
                  <CameraOff size={56} />
                  <span className="ml-3">Your camera is off</span>
                </div>
              )}
              <video ref={localRef} autoPlay muted playsInline className={`w-full h-full object-cover ${(!hasLocalVideo || callType !== "video") ? "opacity-0" : ""}`} />
            </div>
            {/* Participant tiles (avatars placeholders) */}
            {participants.map((p) => (
              <div key={p._id} className="bg-black rounded-lg overflow-hidden aspect-video relative flex items-center justify-center">
                <div className="avatar">
                  <div className="w-16 h-16 rounded-full border">
                    <img src={p.profilePic || "/avatar.png"} alt={p.fullName || p.username || "member"} />
                  </div>
                </div>
                {/* Remote audio playback for this participant, if available */}
                <audio
                  autoPlay
                  playsInline
                  ref={(el) => {
                    if (!el) return;
                    const s = remoteStreams?.[p._id];
                    if (s && el.srcObject !== s) el.srcObject = s;
                  }}
                  className="hidden"
                />
                <div className="absolute bottom-2 left-2 text-xs text-base-100/80 bg-black/50 px-2 py-1 rounded">
                  {p.fullName || p.username || "Member"}
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="text-sm text-base-content/70">Group call · {elapsed} · {totalTiles} participants</div>
          <div className="flex items-center gap-3">
              <button className="btn" onClick={toggleMute}>
                {isMuted ? <MicOff className="mr-2" /> : <Mic className="mr-2" />}
                {isMuted ? "Unmute" : "Mute"}
              </button>
              {/* Camera toggle can be added later if needed */}
              <button className="btn btn-error" onClick={endGroupCall}>
                <PhoneOff className="mr-2" /> End {callType === "video" ? "Video" : "Audio"} Call
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupCallOverlay;