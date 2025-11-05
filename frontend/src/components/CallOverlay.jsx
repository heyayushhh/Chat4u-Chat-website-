import { useEffect, useRef, useState } from "react";
import { PhoneOff, Mic, MicOff, Video, VideoOff, CameraOff } from "lucide-react";
import { useCallStore } from "../store/useCallStore";

const CallOverlay = () => {
  const { inCall, localStream, remoteStream, callType, endCall, toggleMute, toggleCamera, isMuted, isCameraOff, callStartAt, hasLocalVideo, hasRemoteVideo } = useCallStore();
  const localRef = useRef(null);
  const remoteRef = useRef(null);
  const [elapsed, setElapsed] = useState("00:00");

  useEffect(() => {
    if (localRef.current && localStream) {
      localRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteRef.current && remoteStream) {
      remoteRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

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

  if (!inCall) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-40">
      <div className="relative bg-base-100 rounded-xl shadow-2xl p-4 border border-base-300 w-[95%] max-w-3xl">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
              {!hasRemoteVideo && (
                <div className="absolute inset-0 flex items-center justify-center text-base-100/70">
                  <CameraOff size={56} />
                  <span className="ml-3">Camera unavailable</span>
                </div>
              )}
              <video ref={remoteRef} autoPlay playsInline className={`w-full h-full object-cover ${!hasRemoteVideo ? "opacity-0" : ""}`} />
            </div>
            <div className="bg-black rounded-lg overflow-hidden aspect-video relative">
              {(!hasLocalVideo || isCameraOff) && (
                <div className="absolute inset-0 flex items-center justify-center text-base-100/70">
                  <CameraOff size={56} />
                  <span className="ml-3">Your camera is off</span>
                </div>
              )}
              <video ref={localRef} autoPlay muted playsInline className={`w-full h-full object-cover ${(!hasLocalVideo || isCameraOff) ? "opacity-0" : ""}`} />
            </div>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="text-sm text-base-content/70">Call duration: {elapsed}</div>
            <div className="flex items-center gap-3">
              <button className="btn" onClick={toggleMute}>
                {isMuted ? <MicOff className="mr-2" /> : <Mic className="mr-2" />}
                {isMuted ? "Unmute" : "Mute"}
              </button>
              <button className="btn" onClick={toggleCamera} disabled={!hasLocalVideo}>
                {isCameraOff ? <VideoOff className="mr-2" /> : <Video className="mr-2" />}
                {hasLocalVideo ? (isCameraOff ? "Camera On" : "Camera Off") : "No Camera"}
              </button>
              <button className="btn btn-error" onClick={endCall}>
                <PhoneOff className="mr-2" /> End {callType === "video" ? "Video" : "Audio"} Call
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallOverlay;