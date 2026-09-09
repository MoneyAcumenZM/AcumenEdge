import { Bell, AlertTriangle, TrendingUp, Info, XCircle, Filter } from "lucide-react";
import { useState } from "react";

type AnnouncementType = "halt" | "suspension" | "entitlement" | "info" | "cancellation" | "resumption";

type Announcement = {
  id: string;
  type: AnnouncementType;
  title: string;
  message: string;
  timestamp: string;
  date: string;
};

const allAnnouncements: Announcement[] = [
  { id: "1", type: "info", title: "Market Open", message: "LuSE ATS continuous trading session is now active. All boards operational.", timestamp: "11:00 CAT", date: "21 Feb 2026" },
  { id: "2", type: "entitlement", title: "ZSUG Dividend Declaration", message: "Zambia Sugar Plc declares interim dividend of K0.15 per share. Ex-date: 28 Feb 2026. Payment date: 15 Mar 2026.", timestamp: "09:30 CAT", date: "21 Feb 2026" },
  { id: "3", type: "suspension", title: "LAFARGE Suspended", message: "Trading in Lafarge Zambia suspended pending corporate announcement. Duration: up to 15 minutes.", timestamp: "12:15 CAT", date: "21 Feb 2026" },
  { id: "4", type: "resumption", title: "LAFARGE Resumed", message: "Trading in Lafarge Zambia has resumed following corporate announcement clearance.", timestamp: "12:30 CAT", date: "21 Feb 2026" },
  { id: "5", type: "cancellation", title: "Trade Cancellation Notice", message: "Trade TRD-003 (CEC, 300 units @ K15.60) cancellation request approved by both parties.", timestamp: "14:45 CAT", date: "20 Feb 2026" },
  { id: "6", type: "info", title: "End-of-Day Publication", message: "Market data, settlement reports, and index updates published for 20 Feb 2026.", timestamp: "15:00 CAT", date: "20 Feb 2026" },
  { id: "7", type: "halt", title: "Market Halt", message: "LuSE ATS trading halted due to LuSE Index dropping >5% intraday. Trading suspended across all boards.", timestamp: "13:22 CAT", date: "19 Feb 2026" },
  { id: "8", type: "resumption", title: "Market Resumed", message: "LuSE ATS trading resumed following circuit breaker cool-down period.", timestamp: "13:52 CAT", date: "19 Feb 2026" },
];

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
    </div>
  );
};

export default Announcements;
