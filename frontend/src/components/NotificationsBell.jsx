import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export default function NotificationsBell() {
  const { authUser } = useAuthStore();

  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // Announcement visibility logic: shows inside bell for up to 30 days after banner dismissal
  const annKeySeen = authUser ? `announcement_first_seen_${authUser._id}` : null;
  const annKeyDismissed = authUser ? `announcement_dismissed_${authUser._id}` : null;
  const annKeyViewed = authUser ? `announcement_viewed_${authUser._id}` : null;

  const now = Date.now();
  const firstSeen = annKeySeen ? Number(localStorage.getItem(annKeySeen) || 0) : 0;
  const dismissed = annKeyDismissed ? Boolean(localStorage.getItem(annKeyDismissed)) : false;
  const announcementActive = dismissed && firstSeen > 0 && (now - firstSeen) < THIRTY_DAYS_MS;
  const announcementViewed = annKeyViewed ? Boolean(localStorage.getItem(annKeyViewed)) : false;
  const showRedDot = (announcementActive && !announcementViewed);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (open && menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleToggle = () => {
    const newOpen = !open;
    setOpen(newOpen);
    if (!authUser) return;
    if (newOpen) {
      // Mark notifications as "seen" for the red dot logic
      try {
        if (announcementActive) localStorage.setItem(annKeyViewed, "1");
      } catch {}
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="btn btn-sm relative"
        title="Notifications"
        onClick={handleToggle}
      >
        <Bell className="w-4 h-4" />
        {showRedDot && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full border border-white" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-base-200 border border-base-300 z-50">
          <div className="p-2 text-sm">
            <div className="p-2 rounded bg-base-100 border border-base-300">
              <div className="font-semibold mb-1">Announcement</div>
              <div>
                {authUser ? (
                  <>
                    Hi @{authUser.username}, welcome to Chat4U! Thank you for choosing Chat4U.
                    This website is currently in beta — enjoy chatting with your friends and family.
                    We’d love your feedback: ayushkrsna01@gmail.com
                  </>
                ) : (
                  <>
                    Welcome to Chat4U! This website is currently in beta — enjoy chatting.
                    We’d love your feedback: ayushkrsna01@gmail.com
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}