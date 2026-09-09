import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, FileText, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function fmtPrice(val: number | null, currency: string | null) {
  if (val == null) return "—";
  const prefix = currency === "USD" ? "USD " : "ZMW ";
  return prefix + val.toFixed(2);
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}/${dt.getFullYear()}`;
}

function relTime(d: string | null) {
  if (!d) return "—";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function useBondDetail(symbol: string) {
  return useQuery({
    queryKey: ["bond", symbol],
    queryFn: async () => {
      const { data } = await supabase
        .from("bonds")
        .select("*")
        .eq("symbol", symbol)
        .eq("is_active", true)
        .limit(1)
        .single();
      return data;
    },
    enabled: !!symbol,
    staleTime: 60_000,
  });
}

const BondDetail = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { data: bond, isLoading } = useBondDetail(symbol || "");

  if (isLoading) {
    return (
      <div className="space-y-4 mobile-contain">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-60 w-full rounded-xl" />
      </div>
    );
  }

  if (!bond) {
    return (
      <div className="space-y-4 mobile-contain">
        <button onClick={() => navigate("/bonds")} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> Back to Bonds
        </button>
        <div className="bg-card rounded-xl p-8 text-center">
          <p className="text-muted-foreground">Bond not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mobile-contain">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
        <ArrowLeft className="w-4 h-4" /> Back to Bonds
      </button>

      {/* Header */}
      <div className="bg-card rounded-2xl p-5 border border-border/50 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 100%)" }}>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{bond.symbol}</h1>
            <p className="text-sm text-primary mt-0.5">{bond.name}</p>
            <p className="text-[10px] text-muted-foreground font-mono mt-1">{bond.isin}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="text-[9px] px-2 py-0.5 rounded-full font-semibold bg-primary/15 text-primary uppercase tracking-wider">
              Corporate Bond
            </span>
            <span className="text-[8px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              Display Only — Not Tradable
            </span>
          </div>
        </div>
      </div>

      {/* Price Card */}
      <div className="bg-card rounded-xl p-4 border border-border/50">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Price Information</h3>
        <div className="grid grid-cols-3 gap-4">
          <PriceCell label="Last Price" value={fmtPrice(bond.last_price, bond.currency)} />
          <PriceCell label="Bid Price" value={fmtPrice(bond.bid_price, bond.currency)} color="text-success" />
          <PriceCell label="Ask Price" value={fmtPrice(bond.ask_price, bond.currency)} color="text-destructive" />
        </div>
      </div>

      {/* Specifications */}
      <div className="bg-card rounded-xl p-4 border border-border/50">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Bond Specifications</h3>
        <div className="space-y-2.5">
          <SpecRow label="Coupon Rate" value={bond.coupon_rate != null ? `${Number(bond.coupon_rate).toFixed(2)}% per annum` : "—"} />
          <SpecRow label="Maturity Date" value={fmtDate(bond.maturity_date)} />
          <SpecRow label="Face Value" value={bond.face_value != null ? fmtPrice(bond.face_value, bond.currency) : "—"} />
          <SpecRow label="Currency" value={bond.currency || "ZMW"} />
          <SpecRow label="Settlement" value="T+3" />
          <SpecRow label="Instrument Type" value="Corporate Bond" />
          <SpecRow label="Issuer" value={bond.issuer || "—"} />
          <SpecRow label="Sector" value={bond.sector || "—"} />
          <SpecRow label="ISIN" value={bond.isin} mono />
          <SpecRow label="Symbol" value={bond.symbol} mono />
        </div>
      </div>

      {/* Market Activity */}
      <div className="bg-card rounded-xl p-4 border border-border/50">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">Market Activity</h3>
        <div className="space-y-2.5">
          <SpecRow label="Volume Traded" value={bond.volume != null ? bond.volume.toLocaleString("en") : "—"} />
          <SpecRow label="Last Updated" value={relTime(bond.price_updated_at)} />
        </div>
      </div>

      {/* About */}
      <div className="bg-card rounded-xl p-4 border border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-primary" />
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">About Corporate Bonds</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          A corporate bond is a debt instrument issued by a company to raise capital. When you invest in a bond, you are
          essentially lending money to the issuer in exchange for regular interest payments (known as coupon payments)
          and the return of the face value at maturity. The coupon rate shown above represents the annual interest rate
          paid on the bond's face value. Bonds are generally considered lower-risk than equities, though they carry
          credit risk depending on the issuer's financial strength.
        </p>
      </div>
    </div>
  );
};

const PriceCell = ({ label, value, color = "text-foreground" }: { label: string; value: string; color?: string }) => (
  <div className="text-center">
    <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{label}</p>
    <p className={`text-sm font-bold ${color}`}>{value}</p>
  </div>
);

const SpecRow = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-center justify-between py-1 border-b border-border/20 last:border-0">
    <span className="text-[11px] text-muted-foreground">{label}</span>
    <span className={`text-[11px] font-semibold text-foreground ${mono ? "font-mono" : ""}`}>{value}</span>
  </div>
);

export default BondDetail;
