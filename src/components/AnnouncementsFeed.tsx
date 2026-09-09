import { Bell, AlertTriangle, TrendingUp, Info, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const typeConfig: Record<string, { icon: typeof Info; color: string; bg: string }> = {
  halt: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  suspension: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10" },
  entitlement: { icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
  info: { icon: Info, color: "text-primary", bg: "bg-primary/10" },
  announcement: { icon: Info, color: "text-primary", bg: "bg-primary/10" },
  cancellation: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  dividend: { icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
  agm: { icon: Info, color: "text-primary", bg: "bg-primary/10" },
};

function useAnnouncements() {
  return useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data } = await supabase
        .from("market_news")
        .select("id, title, summary, category, source, published_at")
        .eq("is_active", true)
        .order("published_at", { ascending: false })
        .limit(10);
      return (data || []) as any[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

const AnnouncementsFeed = () => {
  const { data: announcements = [], isLoading } = useAnnouncements();

  return (
    <div className="bg-card rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Announcements</h3>
      </div>
      <div className="space-y-2">
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-muted rounded-lg px-3 py-2.5 animate-pulse h-14" />
            ))}
          </div>
        )}
        {!isLoading && announcements.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No announcements</p>
        )}
        {announcements.map((a: any) => {
          const config = typeConfig[a.category] || typeConfig.info;
          const Icon = config.icon;
          const time = new Date(a.published_at).toLocaleDateString("en-ZM", { day: "numeric", month: "short" });
          return (
            <div key={a.id} className={`${config.bg} rounded-lg px-3 py-2.5`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                <span className={`text-xs font-semibold ${config.color}`}>{a.title}</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{time}</span>
              </div>
              <p className="text-xs text-muted-foreground">{a.summary}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AnnouncementsFeed;
