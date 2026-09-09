import { useState } from "react";
import { useCSD } from "@/contexts/CSDContext";
import { Mail, ChevronDown, ChevronUp } from "lucide-react";
import { useClientRole } from "@/lib/display/roleGate";
import { friendlySWIFTType, maskCSDAccount } from "@/lib/display/formatters";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { toast } from "@/hooks/use-toast";

const statusBadge: Record<string, string> = {
  QUEUED: "bg-secondary text-muted-foreground",
  SENT: "bg-primary/10 text-primary",
  ACKNOWLEDGED: "bg-success-muted text-success",
  REJECTED: "bg-destructive-muted text-destructive",
  FAILED: "bg-destructive-muted text-destructive",
};

const SWIFTMonitor = () => {
  // TODO: wire to middleware when endpoint exists. No SWIFT message log endpoint exposed yet.
  const { swiftMessages } = useCSD();
  const { isAdminOrDealer } = useClientRole();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // RULE 2: Redirect non-admin users
  useEffect(() => {
    if (!isAdminOrDealer) {
      toast({ title: "Access Denied", description: "You do not have permission to view this page", variant: "destructive" });
      navigate("/", { replace: true });
    }
  }, [isAdminOrDealer, navigate]);

  if (!isAdminOrDealer) return null;

  const messages = [...swiftMessages].reverse();
  const filtered = messages.filter(m => {
    if (filterType !== "ALL" && m.messageType !== filterType) return false;
    if (filterStatus !== "ALL" && m.status !== filterStatus) return false;
    return true;
  });

  const messageTypes = ["ALL", ...Array.from(new Set(messages.map(m => m.messageType)))];
  const statuses = ["ALL", "QUEUED", "SENT", "ACKNOWLEDGED", "REJECTED", "FAILED"];
  const friendlyStatusLabels: Record<string, string> = { QUEUED: 'Queued', SENT: 'Sent', ACKNOWLEDGED: 'Confirmed', REJECTED: 'Rejected', FAILED: 'Failed' };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="w-6 h-6 text-white" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">SWIFT Monitor</h1>
          <p className="text-muted-foreground text-sm">Message activity feed</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none">
          {messageTypes.map(t => <option key={t} value={t}>{t === 'ALL' ? 'All Types' : friendlySWIFTType(t)}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bg-card border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none">
          {statuses.map(s => <option key={s} value={s}>{s === 'ALL' ? 'All Status' : friendlyStatusLabels[s] || s}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl p-10 text-center">
          <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-semibold text-foreground text-lg">No messages</p>
          <p className="text-sm text-muted-foreground mt-1">Messages will appear when orders are submitted</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(msg => {
            const isExpanded = expandedId === msg.messageId;
            return (
              <div key={msg.messageId} className="bg-card rounded-xl overflow-hidden">
                <button onClick={() => setExpandedId(isExpanded ? null : msg.messageId)} className="w-full px-4 py-3 flex items-center justify-between text-left">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-medium text-primary">{friendlySWIFTType(msg.messageType)}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {msg.payload.securityDescription || ''}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusBadge[msg.status]}`}>{friendlyStatusLabels[msg.status] || msg.status}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{msg.timestamp.toLocaleTimeString('en-ZM', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border">
                    <div className="grid grid-cols-2 gap-2 text-xs mt-3">
                      <div><p className="text-muted-foreground">Type</p><p className="text-foreground">{friendlySWIFTType(msg.messageType)}</p></div>
                      <div><p className="text-muted-foreground">Direction</p><p className="text-foreground">{msg.sender.includes('BROKER') ? 'Outbound' : 'Inbound'}</p></div>
                      <div><p className="text-muted-foreground">Status</p><p className="text-foreground">{friendlyStatusLabels[msg.status] || msg.status}</p></div>
                      <div><p className="text-muted-foreground">Time</p><p className="text-foreground">{msg.timestamp.toLocaleString('en-ZM')}</p></div>
                      {msg.payload.buyerAccount && <div><p className="text-muted-foreground">Account</p><p className="text-foreground font-mono">{maskCSDAccount(msg.payload.buyerAccount)}</p></div>}
                      {msg.payload.sellerAccount && <div><p className="text-muted-foreground">Account</p><p className="text-foreground font-mono">{maskCSDAccount(msg.payload.sellerAccount)}</p></div>}
                      {msg.payload.securityDescription && <div className="col-span-2"><p className="text-muted-foreground">Security</p><p className="text-foreground">{msg.payload.securityDescription}</p></div>}
                    </div>
                    {/* RULE 2: rawMessage is NEVER shown */}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SWIFTMonitor;
