import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import ATSMarketBanner from "@/components/ATSMarketBanner";
import { useDebounce } from "@/hooks/useSupabaseQuery";
import { middlewareClient } from "@/services/middlewareClient";

type Instrument = {
  symbol: string;
  securityId?: string;
  description?: string;
  isin?: string;
  securityType?: string;       // "CS" = equities, "CORP" = corporate bonds
  currency?: string;
  maturityDate?: string;
  couponRate?: number | string;
};

type TypeFilter = 'ALL' | 'CS' | 'CORP';

const Securities = () => {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['instruments'],
    queryFn: async () => {
      const r = await middlewareClient.instruments();
      const dict = r?.data || r || {};
      return Object.values(dict) as Instrument[];
    },
    staleTime: 5 * 60_000,
  });

  const instruments = data || [];
  const filtered = useMemo(() => {
    return instruments.filter(i => {
      if (typeFilter !== 'ALL' && i.securityType !== typeFilter) return false;
      const q = debouncedSearch.toLowerCase();
      if (!q) return true;
      return (i.symbol || '').toLowerCase().includes(q) ||
             (i.description || '').toLowerCase().includes(q) ||
             (i.isin || '').toLowerCase().includes(q);
    });
  }, [instruments, typeFilter, debouncedSearch]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Securities</h1>
      <ATSMarketBanner />

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search by symbol, name, ISIN..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
      </div>

      {/* Type filter */}
      <div className="flex gap-2">
        {([
          { k: 'ALL' as TypeFilter, label: 'All' },
          { k: 'CS' as TypeFilter, label: 'Equities' },
          { k: 'CORP' as TypeFilter, label: 'Bonds' },
        ]).map(t => (
          <button key={t.k} onClick={() => setTypeFilter(t.k)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${typeFilter === t.k ? 'bg-primary/15 text-primary border border-primary/30' : 'bg-secondary text-muted-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading instruments…</p>}
      {isError && <p className="text-sm text-destructive">Could not load instruments. Middleware unreachable.</p>}

      <div className="space-y-2">
        {filtered.map((i) => (
          <div key={i.symbol} className="bg-card rounded-xl px-4 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold text-foreground">{i.symbol}</p>
                {i.securityType && (
                  <span className="text-[10px] uppercase text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                    {i.securityType === 'CS' ? 'Equity' : i.securityType === 'CORP' ? 'Bond' : i.securityType}
                  </span>
                )}
                {i.currency && <span className="text-[10px] text-muted-foreground">{i.currency}</span>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{i.description || '—'}</p>
              {(i.isin || i.maturityDate || i.couponRate) && (
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  {i.isin}
                  {i.couponRate ? ` • ${i.couponRate}%` : ''}
                  {i.maturityDate ? ` • ${i.maturityDate}` : ''}
                </p>
              )}
            </div>
            <Link to={`/trade?ticker=${encodeURIComponent(i.symbol)}`}
              className="shrink-0 text-xs text-primary font-medium hover:opacity-80">
              Trade →
            </Link>
          </div>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No instruments match your filter.</p>
        )}
      </div>
    </div>
  );
};

export default Securities;
