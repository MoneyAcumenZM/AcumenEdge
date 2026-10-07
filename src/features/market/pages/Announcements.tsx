import { Bell, AlertTriangle, TrendingUp, Info, XCircle } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/integrations/data/client";
import type { Tables } from "@/integrations/data/schema";

type AnnouncementType = "halt" | "suspension" | "entitlement" | "info" | "cancellation" | "resumption";

type Announcement = {
  id: string;
  type: AnnouncementType;
  title: string;
  message: string;
  timestamp: string;
  date: string;
};

// Backed by the `market_news` table (the same one MarketNews.tsx reads),
// mapped into this page's announcement types on a best-effort basis. An
// empty result shows "no announcements".
const CATEGORY_TO_TYPE: Record<string, AnnouncementType> = {
  dividend: "entitlement",
  entitlement: "entitlement",
  halt: "halt",
  suspension: "suspension",
  resumption: "resumption",
  cancellation: "cancellation",
};

type NewsRow = Pick<Tables<'market_news'>, 'id' | 'title' | 'summary' | 'body' | 'category' | 'published_at'>;

function mapNewsRowToAnnouncement(row: NewsRow): Announcement {
  const published = row.published_at ? new Date(row.published_at) : null;
  return {
    id: row.id,
    type: CATEGORY_TO_TYPE[row.category] || "info",
    title: row.title,
    message: row.summary || row.body || "",
    timestamp: published ? published.toLocaleTimeString("en-ZM", { hour: "2-digit", minute: "2-digit" }) : "",
    date: published ? published.toLocaleDateString("en-ZM", { day: "numeric", month: "short", year: "numeric" }) : "",
  };
}

const typeConfig: Record<AnnouncementType, { icon: typeof Info; color: string; bg: string; label: string }> = {
  halt: { icon: XCircle, color: "text-destructive", bg: "bg-destructive-muted", label: "Halt" },
  suspension: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning-muted", label: "Suspension" },
  entitlement: { icon: TrendingUp, color: "text-success", bg: "bg-success-muted", label: "Entitlement" },
  info: { icon: Info, color: "text-primary", bg: "bg-primary/10", label: "Info" },
  cancellation: { icon: XCircle, color: "text-destructive", bg: "bg-destructive-muted", label: "Cancellation" },
  resumption: { icon: Info, color: "text-success", bg: "bg-success-muted", label: "Resumption" },
};

const filterTypes: AnnouncementType[] = ["halt", "suspension", "entitlement", "info", "cancellation", "resumption"];

const Announcements = () => {
  const [activeFilter, setActiveFilter] = useState<AnnouncementType | "all">("all");

  const { data: allAnnouncements = [], isLoading, isError } = useQuery({
    queryKey: ["announcements"],
    queryFn: async () => {
      const { data, error } = await db
        .from("market_news")
        .select("id, title, summary, body, category, published_at")
        .eq("is_active", true)
        .order("published_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []).map(mapNewsRowToAnnouncement);
    },
    staleTime: 5 * 60 * 1000,
  });

  const filtered = activeFilter === "all" ? allAnnouncements : allAnnouncements.filter((a) => a.type === activeFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="w-6 h-6 text-white" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
          <p className="text-muted-foreground text-sm">ATS notifications & corporate actions</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setActiveFilter("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            activeFilter === "all" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"
          }`}
        >
          All
        </button>
        {filterTypes.map((type) => (
          <button
            key={type}
            onClick={() => setActiveFilter(type)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors capitalize ${
              activeFilter === type ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground border border-border"
            }`}
          >
            {typeConfig[type].label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-12">Loading announcements…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{isError ? "Announcements couldn't be loaded. Please try again shortly." : "No announcements right now"}</p>
        </div>
      ) : (
      <div className="space-y-3">
        {filtered.map((a) => {
          const config = typeConfig[a.type];
          const Icon = config.icon;
          return (
            <div key={a.id} className={`${config.bg} rounded-xl px-4 py-3.5 flex gap-3`}>
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${config.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className={`text-sm font-semibold ${config.color}`}>{a.title}</p>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground">{a.timestamp}</p>
                    <p className="text-[10px] text-muted-foreground">{a.date}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{a.message}</p>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};

export default Announcements;
