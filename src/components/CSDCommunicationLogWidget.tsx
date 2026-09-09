import { useCSD } from "@/contexts/CSDContext";
import { ArrowUp, ArrowDown, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useClientRole } from "@/lib/display/roleGate";
import { friendlySWIFTType, maskCSDAccount } from "@/lib/display/formatters";

const statusColor = {
  SUCCESS: 'border-l-success',
  FAILED: 'border-l-destructive',
  PENDING: 'border-l-primary',
};

const CSDCommunicationLogWidget = () => {
  // TODO: wire to middleware when endpoint exists. No CSD communication log endpoint yet.
  const { communicationLog } = useCSD();
  const { isAdminOrDealer } = useClientRole();

  // RULE 8: Hidden from client users entirely
  if (!isAdminOrDealer) return null;

  const recent = [...communicationLog].reverse().slice(0, 20);

  if (recent.length === 0) {
    return (
      <div className="bg-card rounded-xl p-5">
        <h3 className="font-semibold text-foreground mb-3 text-sm">Communications</h3>
        <div className="flex flex-col items-center py-6 text-center">
          <Clock className="w-6 h-6 text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">No activity yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-foreground text-sm">Communications</h3>
        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">LIVE</span>
      </div>
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {recent.map((log) => (
          <div key={log.id} className={`border-l-2 ${statusColor[log.status]} bg-secondary/50 rounded-r-lg px-3 py-2`}>
            <div className="flex items-center gap-2 mb-0.5">
              {log.direction === 'OUTBOUND' ? (
                <ArrowUp className="w-3 h-3 text-primary" />
              ) : (
                <ArrowDown className="w-3 h-3 text-success" />
              )}
              <span className="text-[10px] font-medium text-muted-foreground">{friendlySWIFTType(log.messageType)}</span>
              <span className="text-[10px] text-muted-foreground">{maskCSDAccount(log.accountNumber)}</span>
              {log.status === 'SUCCESS' && <CheckCircle2 className="w-3 h-3 text-success ml-auto" />}
              {log.status === 'FAILED' && <XCircle className="w-3 h-3 text-destructive ml-auto" />}
              {log.status === 'PENDING' && <Clock className="w-3 h-3 text-warning ml-auto" />}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{log.summary}</p>
            <p className="text-[9px] text-muted-foreground/60 mt-0.5">{log.timestamp.toLocaleTimeString('en-ZM', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} CAT</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CSDCommunicationLogWidget;
