import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { shouldShowNotificationPrompt, requestWebNotificationPermission } from "@/services/notifications";

const NotificationPermissionBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small delay so it appears after splash/tutorial
    const t = setTimeout(() => {
      if (shouldShowNotificationPrompt()) setVisible(true);
    }, 1500);
    return () => clearTimeout(t);
  }, []);

  if (!visible) return null;

  const handleAllow = async () => {
    const granted = await requestWebNotificationPermission();
    if (granted) {
      window.dispatchEvent(new Event('circle_notif_granted'));
    }
    setVisible(false);
  };

  const handleDismiss = () => {
    sessionStorage.setItem('circle_notif_dismissed', '1');
    setVisible(false);
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-[92%] max-w-md animate-in slide-in-from-top-4 fade-in duration-300">
      <div className="bg-card border border-border rounded-2xl shadow-lg px-4 py-3 flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Enable Notifications</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get alerts for trade executions, price movements, and deposits.
          </p>
          <div className="flex gap-2 mt-2.5">
            <button
              onClick={handleAllow}
              className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              Allow
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-1.5 rounded-lg bg-secondary text-muted-foreground text-xs font-medium hover:bg-secondary/80 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default NotificationPermissionBanner;
