import { useMarketStatus } from "@/hooks/useMarketStatus";
import { AlertTriangle } from "lucide-react";

/**
 * Renders an exchange-wide halt banner when the middleware reports halted
 * symbols via /api/fix/halts (or when the session phase itself is HALTED).
 * Hidden when no halts are active.
 */
const ATSMarketBanner = () => {
  const { status, isHalted } = useMarketStatus();
  const halted = status?.halted_symbols || [];

  if (!isHalted && halted.length === 0) return null;

  return (
    <div className="bg-destructive-muted rounded-xl px-4 py-2.5 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="w-4 h-4 text-destructive" />
        <span className="text-sm font-semibold text-destructive">
          {isHalted ? 'Market Halted' : `Trading halted: ${halted.slice(0, 4).join(', ')}${halted.length > 4 ? '…' : ''}`}
        </span>
      </div>
      <span className="text-xs text-muted-foreground">Please check back shortly.</span>
    </div>
  );
};

export default ATSMarketBanner;
