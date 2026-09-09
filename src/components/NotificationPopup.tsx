import { useState, useMemo } from 'react';
import { Bell, X, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { HapticFeedback } from '@/services/haptics';
import { useNotifications, queryKeys } from '@/hooks/useSupabaseQuery';
import { useQueryClient } from '@tanstack/react-query';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

const NotificationPopup = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: notificationsRaw = [] } = useNotifications();
  const notifications = notificationsRaw as Notification[];

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications]);

  // NO realtime listener here — it's handled once in AuthContext

  const markRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true } as any).eq('id', id);
    queryClient.setQueryData(queryKeys.notifications(user!.id), (old: any[]) =>
      (old || []).map((n: any) => n.id === id ? { ...n, is_read: true } : n)
    );
  };

  const deleteNotification = async (id: string) => {
    await HapticFeedback.light();
    queryClient.setQueryData(queryKeys.notifications(user!.id), (old: any[]) =>
      (old || []).filter((n: any) => n.id !== id)
    );
    await supabase.from('notifications').delete().eq('id', id);
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      const n = notifications.find(n => n.id === id);
      if (n && !n.is_read) markRead(id);
    }
  };

  const timeAgo = (date: string) => {
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div className="relative">
      <button onClick={() => { setOpen(!open); HapticFeedback.light(); }} className="relative text-accent transition-colors">
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-[9px] text-white font-bold flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60 md:bg-transparent" onClick={() => setOpen(false)} />
          <div className="fixed inset-x-0 bottom-0 md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 w-full md:w-80 max-h-[70vh] md:max-h-96 overflow-y-auto bg-card md:border md:border-border rounded-t-2xl md:rounded-xl shadow-2xl z-50">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30 md:hidden mx-auto absolute left-1/2 -translate-x-1/2 top-2" />
                <h3 className="text-sm font-bold text-foreground">Notifications</h3>
              </div>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                <p className="text-xs text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map(n => (
                  <div key={n.id} className={`px-4 py-3 transition-colors ${!n.is_read ? 'bg-primary/5' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => toggleExpand(n.id)} className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          {!n.is_read && <span className="w-2 h-2 rounded-full bg-primary shrink-0" />}
                          <p className="text-xs font-semibold text-foreground line-clamp-1">{n.title}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(n.created_at)}</p>
                      </button>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => toggleExpand(n.id)} className="text-muted-foreground hover:text-foreground p-1">
                          {expandedId === n.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        <button onClick={() => deleteNotification(n.id)} className="text-muted-foreground hover:text-destructive p-1">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {expandedId === n.id && (
                      <div className="mt-2 bg-secondary/50 rounded-lg px-3 py-2">
                        <p className="text-xs text-foreground">{n.body}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationPopup;
