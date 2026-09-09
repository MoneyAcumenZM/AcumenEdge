import { TrendingUp, Building2, Percent, Briefcase, DollarSign } from "lucide-react";

const Dividends = () => {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Percent className="w-6 h-6 text-white" />
          <h1 className="text-2xl font-bold text-foreground">Dividend & Coupon Payments</h1>
        </div>
        <p className="text-muted-foreground text-sm mt-1">Track income from stocks, bonds & treasury bills</p>
      </div>

      {/* Total Annual Income */}
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-5 h-5 text-primary" />
          <span className="text-sm text-muted-foreground">Total Annual Income</span>
        </div>
        <p className="text-3xl font-bold text-primary mb-4">K0.00</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-secondary rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">Monthly</p>
            <p className="font-bold text-foreground">K0.00</p>
          </div>
          <div className="bg-secondary rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">Quarterly</p>
            <p className="font-bold text-foreground">K0.00</p>
          </div>
          <div className="bg-secondary rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">Portfolio Yield</p>
            <p className="font-bold text-primary">0.00%</p>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Dividends</span>
          </div>
          <p className="font-bold text-foreground">K0.00</p>
          <p className="text-xs text-muted-foreground">0 stocks</p>
        </div>
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Building2 className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Coupons</span>
          </div>
          <p className="font-bold text-foreground">K0.00</p>
          <p className="text-xs text-muted-foreground">0 securities</p>
        </div>
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Percent className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Avg Yield</span>
          </div>
          <p className="font-bold text-foreground">0.00%</p>
        </div>
        <div className="bg-card rounded-xl p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Briefcase className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Assets</span>
          </div>
          <p className="font-bold text-foreground">0</p>
          <p className="text-xs text-muted-foreground">income-paying</p>
        </div>
      </div>

      {/* Income Sources */}
      <div className="bg-card rounded-xl p-6">
        <div className="flex items-center gap-2 mb-6">
          <DollarSign className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Income Sources</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center mb-4">
            <DollarSign className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">No Income Sources</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            Add dividend-paying stocks or interest-bearing securities to track your passive income.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dividends;
