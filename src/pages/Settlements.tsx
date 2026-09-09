import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import { middlewareClient } from "@/services/middlewareClient";
import { useAuth } from "@/contexts/AuthContext";
import { formatZMW } from "@/lib/display/formatters";

const statusBadge: Record<string, string> = {
  pending:   "bg-primary/10 text-primary",
  due_today: "bg-warning/10 text-warning",
  settled:   "bg-success/10 text-success",
};

const Settlements = () => {
  const { user } = useAuth();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['market-settlement', user?.id],
    queryFn: () => middlewareClient.getMarketSettlement(user!.id, 100),
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const rows = data?.rows || [];
  const summary = data?.summary;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Receipt className="w-6 h-6 text-white" />
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settlements</h1>
          <p className="text-muted-foreground text-sm">T+3 settlements from the middleware</p>
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <SummaryTile label="Total" value={summary.total} />
          <SummaryTile label="Pending" value={summary.pending} accent="text-primary" />
          <SummaryTile label="Due Today" value={summary.dueToday} accent="text-warning" />
          <SummaryTile label="Settled" value={summary.settled} accent="text-success" />
          <SummaryTile label="Pending Value" value={formatZMW(summary.pendingValue || 0)} />
        </div>
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Loading settlements…</p>}
      {isError && <p className="text-sm text-destructive">Could not load settlements. Middleware unreachable.</p>}

      {!isLoading && rows.length === 0 ? (
        <div className="bg-card rounded-xl p-10 text-center">
          <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="font-semibold text-foreground text-lg">No settlements</p>
          <p className="text-sm text-muted-foreground mt-1">Settlements appear here after trade execution</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((s: any, idx: number) => {
            const id = s.orderId || `s-${idx}`;
            const status: string = s.status || 'pending';
            return (
              <div key={id} className="bg-card rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground font-mono">{id}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusBadge[status] || 'bg-secondary text-muted-foreground'}`}>
                    {status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Field label="Security" value={s.symbol || '—'} bold />
                  <Field label="Side" value={(s.side || '').toUpperCase()} />
                  <Field label="Shares" value={Number(s.quantity ?? 0).toLocaleString()} />
                  <Field label="Price" value={formatZMW(Number(s.price ?? 0))} />
                  <Field label="Gross" value={formatZMW(Number(s.grossValue ?? 0))} />
                  <Field label="Fees" value={formatZMW(Number(s.totalFees ?? 0))} />
                  <Field label="Net" value={formatZMW(Number(s.netValue ?? 0))} bold />
                  <Field label="Settles" value={s.settleDate ? `${s.settleDate}${typeof s.daysLeft === 'number' ? ` · ${s.daysLeft}d` : ''}` : '—'} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const SummaryTile = ({ label, value, accent }: { label: string; value: number | string; accent?: string }) => (
  <div className="bg-card rounded-xl p-3">
    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className={`text-sm font-bold ${accent || 'text-foreground'}`}>{value}</p>
  </div>
);

const Field = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
  <div>
    <p className="text-muted-foreground">{label}</p>
    <p className={bold ? 'font-bold text-foreground' : 'font-medium text-foreground'}>{value}</p>
  </div>
);

export default Settlements;
