import { useEffect, useRef, useState } from "react";
import { axiosInstance } from "../lib/axios";
import { useGroupStore } from "../store/useGroupStore";
import { useGroupCallStore } from "../store/useGroupCallStore";

// Shows a global banner with Join buttons for any active group calls
// the current user is eligible to join. Useful after declining or refreshing.
const ActiveCallBanner = () => {
  const { groups } = useGroupStore();
  const { inGroupCall, joinActiveGroupCall } = useGroupCallStore();
  const [activeCalls, setActiveCalls] = useState([]); // [{ groupId, type }]
  const [loading, setLoading] = useState(false);
  const timerRef = useRef(null);
  const stoppedRef = useRef(false);

  const pollOnce = async () => {
    if (stoppedRef.current) return;
    if (inGroupCall) {
      setActiveCalls([]);
      return;
    }
    if (loading) return; // avoid overlapping polls
    try {
      setLoading(true);
      const res = await axiosInstance.get("/group-calls/active/me");
      const list = Array.isArray(res.data) ? res.data : [];
      if (!stoppedRef.current) {
        setActiveCalls(
          list.map((c) => ({ groupId: c.groupId, type: c.type, startedAt: c.startedAt }))
        );
      }
    } catch (err) {
      // Treat errors as empty state, but avoid state updates after unmount
      const msg = String(err?.message || "").toLowerCase();
      const code = String(err?.code || "").toUpperCase();
      const isCanceled = code === "ERR_CANCELED" || msg.includes("aborted") || msg.includes("cancel");
      if (!isCanceled && !stoppedRef.current) {
        setActiveCalls([]);
      }
    } finally {
      setLoading(false);
      if (!stoppedRef.current && !inGroupCall) {
        try { clearTimeout(timerRef.current); } catch (_) {}
        timerRef.current = setTimeout(pollOnce, 5000);
      }
    }
  };

  useEffect(() => {
    stoppedRef.current = false;
    pollOnce();
    return () => {
      stoppedRef.current = true;
      try { clearTimeout(timerRef.current); } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inGroupCall]);

  if (loading) return null;
  if (inGroupCall) return null;
  if (!activeCalls.length) return null;

  // Render first active call for simplicity; could list multiple.
  const call = activeCalls[0];
  const group = groups.find((g) => String(g._id) === String(call.groupId));
  const label = group ? group.name : "Active group call";

  return (
    <div className="px-3 py-2 bg-warning/20 border border-warning text-warning flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="badge badge-warning">Call active</span>
        <span className="font-medium">{label}</span>
        <span className="text-sm">· {call.type === "video" ? "Video" : "Audio"}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="btn btn-xs btn-primary"
          onClick={() => joinActiveGroupCall({ group: group || { _id: call.groupId }, type: call.type })}
        >
          Join
        </button>
      </div>
    </div>
  );
};

export default ActiveCallBanner;