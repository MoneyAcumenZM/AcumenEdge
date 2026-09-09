import { Activity, BarChart3, Landmark, Building2 } from "lucide-react";

const MarketIndex = () => {
  return;



























};

const StatItem = ({ icon, label, value }: {icon: React.ReactNode;label: string;value: string;}) =>
<div className="text-center">
    <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
      {icon}
      <span className="text-[10px] uppercase tracking-wider text-warning">{label}</span>
    </div>
    <p className="text-lg font-bold text-foreground">{value}</p>
  </div>;

const TrendDownIcon = () =>
<svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="inline">
    <path d="M2 4L6 8L8 6L12 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;

export default MarketIndex;