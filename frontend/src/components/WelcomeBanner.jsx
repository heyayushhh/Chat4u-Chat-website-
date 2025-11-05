import { useEffect, useState } from "react";
import { useAuthStore } from "../store/useAuthStore";

// Shows a one-time welcome message for newly logged-in users on this device.
// Persists dismissal per user via localStorage.
const WelcomeBanner = () => {
  const { authUser } = useAuthStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!authUser?._id) return;
    const key = `welcome_shown_${authUser._id}`;
    const shown = localStorage.getItem(key);
    if (!shown) {
      setVisible(true);
      // Mark as shown immediately to avoid repeat on refreshes
      localStorage.setItem(key, "1");
    }
  }, [authUser?._id]);

  if (!visible) return null;

  const username = authUser?.username || authUser?.fullName || "user";

  const handleDismiss = () => {
    setVisible(false);
    try {
      const key = `welcome_shown_${authUser._id}`;
      localStorage.setItem(key, "1");
      // Record dismissal so the message appears in the bell for 30 days
      const annDismissedKey = `announcement_dismissed_${authUser._id}`;
      const annFirstSeenKey = `announcement_first_seen_${authUser._id}`;
      localStorage.setItem(annDismissedKey, "1");
      if (!localStorage.getItem(annFirstSeenKey)) {
        localStorage.setItem(annFirstSeenKey, String(Date.now()));
      }
    } catch {}
  };

  return (
    <div className="px-3 py-2 bg-primary/10 border border-primary text-primary rounded-t-lg flex items-start justify-between">
      <div className="text-sm">
        <div className="font-semibold mb-1">Hi @{username}, welcome to Chat4U!</div>
        <div>
          Thank you for choosing Chat4U. This website is currently in beta testing — enjoy chatting with your friends and family. We’d love your feedback on what more we can add: <span className="font-medium">@ayushkrsna01@gmail.com</span>.
        </div>
      </div>
      <button className="btn btn-ghost btn-xs" onClick={handleDismiss} title="Dismiss">Dismiss</button>
    </div>
  );
};

export default WelcomeBanner;