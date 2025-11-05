import { X, Phone, Video } from "lucide-react";
import toast from "react-hot-toast";
import { useGroupStore } from "../store/useGroupStore";
import { useAuthStore } from "../store/useAuthStore";
import { useGroupCallStore } from "../store/useGroupCallStore";
import { useEffect, useState } from "react";
import { axiosInstance } from "../lib/axios";

const GroupChatHeader = ({ onOpenInfo }) => {
  const { selectedGroup, setSelectedGroup, typingUserIds } = useGroupStore();
  const { onlineUsers, authUser } = useAuthStore();
  if (!selectedGroup) return null;

  // listeners are initialized at app-level

  const { startGroupCall, inGroupCall, joinActiveGroupCall } = useGroupCallStore();
  const [joinableType, setJoinableType] = useState(null); // 'audio' | 'video' | null

  // On mount or when switching group, check if there is an active call and expose Join button
  useEffect(() => {
    const run = async () => {
      try {
        setJoinableType(null);
        if (!selectedGroup?._id || inGroupCall) return;
        // Only members can join
        const isMember = (selectedGroup.members || [])
          .map((m) => String(m?._id || m))
          .includes(String(authUser?._id));
        if (!isMember) return;
        const res = await axiosInstance.get(`/group-calls/${selectedGroup._id}`);
        const list = res.data || [];
        const latest = list[0];
        if (latest && latest.status === "active" && !latest.endedAt) {
          setJoinableType(latest.type);
        }
      } catch (_) {
        // best-effort: ignore errors
      }
    };
    run();
  }, [selectedGroup?._id, selectedGroup?.members, authUser?._id, inGroupCall]);

  // Hide Join immediately when a group call ends and show a small toast
  useEffect(() => {
    const handler = (evt) => {
      const gid = evt?.detail?.groupId;
      if (!gid || !selectedGroup?._id) return;
      if (String(gid) !== String(selectedGroup._id)) return;
      if (joinableType) setJoinableType(null);
      try { toast("Call ended"); } catch (_) {}
    };
    window.addEventListener("group-call-ended", handler);
    return () => window.removeEventListener("group-call-ended", handler);
  }, [selectedGroup?._id, joinableType]);

  const onlineCount = (selectedGroup.members || []).filter((m) => {
    const id = m && (m._id || m);
    return id && onlineUsers.includes(id);
  }).length;

  const resolveMember = (uid) => {
    const m = (selectedGroup.members || []).find((mem) => {
      const id = mem && (mem._id || mem);
      return String(id) === String(uid);
    });
    if (!m) return null;
    if (typeof m === "object") return m;
    return { _id: uid, username: null, fullName: null };
  };

  const othersTyping = typingUserIds.filter((id) => String(id) !== String(authUser?._id));
  const typingNames = othersTyping
    .map((uid) => resolveMember(uid))
    .map((m) => m?.username || m?.fullName)
    .filter(Boolean);
  const typingCount = othersTyping.length;
  const typingLabel = (() => {
    if (typingCount === 0) return null;
    if (typingNames.length === 1) return `${typingNames[0]} typing...`;
    if (typingNames.length === 2) return `${typingNames[0]} and ${typingNames[1]} typing...`;
    // Fallbacks when names are unavailable
    if (typingNames.length === 0) return typingCount === 1 ? "Someone typing..." : `${typingCount} people typing...`;
    // 3+ with some names
    return `${typingCount} people typing...`;
  })();

  return (
    <div className="p-2.5 border-b border-base-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="avatar">
            <button className="size-10 rounded-full overflow-hidden border hover:ring-2 hover:ring-primary transition" onClick={onOpenInfo} title="Group info">
              <img src={selectedGroup.avatar || "/avatar.png"} alt={selectedGroup.name} />
            </button>
          </div>
          <div>
            <h3 className="font-medium">{selectedGroup.name}</h3>
            <p className="text-sm text-base-content/70">
              {typingLabel ? (
                <span className="text-primary/80">{typingLabel}</span>
              ) : (
                <span>
                  {onlineCount} online · {selectedGroup.members?.length || 0} members
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {inGroupCall && <span className="badge badge-primary">In call</span>}
          {!inGroupCall && joinableType && (
            <button
              className="btn btn-sm"
              onClick={() => joinActiveGroupCall({ group: selectedGroup, type: joinableType })}
              title={`Join ongoing ${joinableType} call`}
            >
              <span className="badge badge-warning mr-2">Call active</span>
              Join {joinableType === "video" ? "Video" : "Audio"} Call
            </button>
          )}
          <button
            className="btn btn-sm btn-ghost"
            disabled={!selectedGroup || inGroupCall}
            onClick={() => startGroupCall(selectedGroup, "audio")}
            title="Start group audio call"
          >
            <Phone className="size-5" />
          </button>
          <button
            className="btn btn-sm btn-ghost"
            disabled={!selectedGroup || inGroupCall}
            onClick={() => startGroupCall(selectedGroup, "video")}
            title="Start group video call"
          >
            <Video className="size-5" />
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => setSelectedGroup(null)}>
            <X className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupChatHeader;