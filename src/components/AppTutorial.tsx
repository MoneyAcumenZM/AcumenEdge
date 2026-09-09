import { useState } from 'react';
import { ArrowRight, BarChart2, ArrowLeftRight, Briefcase, Star, ClipboardList, LineChart, X, HelpCircle } from 'lucide-react';

const TUTORIAL_KEY = 'circle_tutorial_done';

interface Props {
  onComplete: () => void;
}

const steps = [
  {
    icon: BarChart2,
    title: 'Browse the Market',
    desc: 'The Market page shows all 21 LuSE-listed securities with live prices, bid/ask data, and trading volumes. Tap any stock to view detailed analysis.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Place a Trade',
    desc: 'Go to Trade, select a stock, choose BUY or SELL, enter volume, and pick Market or Limit order. The Main Board requires multiples of 100 shares; the Odd Lot board handles 1–99 shares.',
  },
  {
    icon: null,
    title: 'Equity vs Odd Lot',
    desc: 'Main Board (Equity): minimum 100 shares in multiples of 100. Odd Lot: 1–99 shares. If you enter 250, it auto-splits into 200 on Main Board + 50 on Odd Lot.',
  },
  {
    icon: null,
    title: 'Order Qualifiers',
    desc: 'Standard: fills partially as liquidity allows. FOK (Fill or Kill): entire order must fill instantly or is cancelled. FAK (Fill and Kill): fills what\'s available, cancels the rest.',
  },
  {
    icon: LineChart,
    title: 'Stock Screener & Charts',
    desc: 'Tap any stock to see price history, key metrics, radar analysis, and revenue trends. Use the Charts page for deeper technical analysis across all securities.',
  },
  {
    icon: Briefcase,
    title: 'Portfolio',
    desc: 'Track your holdings, wallet balance, and unrealised P&L. Your portfolio updates in real-time as trades execute.',
  },
  {
    icon: ClipboardList,
    title: 'My Orders',
    desc: 'View all pending, partially filled, and completed orders. Cancel or amend open orders before they execute.',
  },
  {
    icon: Star,
    title: 'Watchlist',
    desc: 'Tap the star icon on any stock in the Market to add it to your Watchlist. Monitor stocks you\'re interested in without placing a trade.',
  },
];

const AppTutorial = ({ onComplete }: Props) => {
  const [askMode, setAskMode] = useState(true);
  const [step, setStep] = useState(0);

  const handleSkip = () => {
    localStorage.setItem(TUTORIAL_KEY, '1');
    onComplete();
  };

  const handleStartTutorial = () => {
    setAskMode(false);
  };

  // Ask screen — shown first
  if (askMode) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998] flex items-center justify-center p-6">
        <div className="bg-card rounded-2xl border border-border p-6 max-w-sm w-full space-y-5 relative">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
              <HelpCircle className="w-8 h-8 text-primary" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h2 className="text-lg font-bold text-foreground">Welcome to AcumenEdge</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Would you like a quick walkthrough of the app? It only takes a minute.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={handleSkip} className="flex-1 py-3 bg-secondary text-foreground rounded-xl text-sm font-medium">
              Skip
            </button>
            <button onClick={handleStartTutorial} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-1.5">
              Yes, show me
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      localStorage.setItem(TUTORIAL_KEY, '1');
      onComplete();
    }
  };

  const current = steps[step];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9998] flex items-center justify-center p-6">
      <div className="bg-card rounded-2xl border border-border p-6 max-w-sm w-full space-y-5 relative">
        <button onClick={handleSkip} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>

        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center">
            {Icon ? <Icon className="w-8 h-8 text-primary" /> : <span className="text-2xl font-bold text-primary">📊</span>}
          </div>
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-lg font-bold text-foreground">{current.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{current.desc}</p>
        </div>

        <div className="flex justify-center gap-1.5">
          {steps.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-primary' : i < step ? 'bg-primary/40' : 'bg-secondary'}`} />
          ))}
        </div>

        <div className="flex gap-3">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)} className="flex-1 py-3 bg-secondary text-foreground rounded-xl text-sm font-medium">
              Back
            </button>
          )}
          <button onClick={handleNext} className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold flex items-center justify-center gap-1.5">
            {step === steps.length - 1 ? 'Get Started' : 'Next'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <button onClick={handleSkip} className="w-full text-center text-xs text-muted-foreground hover:text-foreground">
          Skip tutorial
        </button>
      </div>
    </div>
  );
};

export { TUTORIAL_KEY };
export default AppTutorial;
