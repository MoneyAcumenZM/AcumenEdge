import { useState } from "react";
import { useAccountRestrictions } from "@/features/auth/hooks/useAccountRestrictions";
import { useUI } from "@/contexts/UIContext";
import { useMiddleware } from "@/contexts/MiddlewareContext";
import { useMarketStatus } from "@/features/market/hooks/useMarketStatus";
import { useWallet, useHoldings } from "@/hooks/useDataQuery";
import { formatZMW } from "@/lib/tradingUtils";
import { ArrowDownLeft, ArrowUpRight, X } from "lucide-react";
import cardPattern from "@/assets/card-pattern.svg";
import moneyAcumenLogo from "@/assets/money-acumen-logo.webp";
import DepositScreen from "@/features/wallet/components/DepositScreen";
import WithdrawScreen from "@/features/wallet/components/WithdrawScreen";

const PortfolioCard = () => {
  const { setDepositOpen } = useUI();
  const { canDeposit, canWithdraw } = useAccountRestrictions();
  const { isOnline: middlewareOnline } = useMiddleware();
  const { isMarketOpen, isPreMarket } = useMarketStatus();
  const { data: wallet } = useWallet();
  const { data: holdings = [], isLoading: holdingsPending, isFetched: holdingsFetched } = useHoldings();
  // Only before the first answer, so the badge doesn't blink on retries.
  const holdingsLoading = holdingsPending && !holdingsFetched;

  // Shows K0.00 until the wallet API returns a balance. Display only: buys
  // are still checked against the real balance and refused while it's
  // unknown (see features/trading/lib/orderLimits.ts).
  const walletText = `K${Number(wallet?.balance ?? 0).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const totalPortfolioValue = holdings.reduce((sum, h) => sum + Number(h.current_value ?? 0), 0);
  // Gain/loss computed from the real holdings.
  const totalGainLoss = holdings.reduce((sum, h) => sum + Number(h.gain_loss ?? 0), 0);
  const totalCost = holdings.reduce((sum, h) => sum + Number(h.total_cost ?? 0), 0);
  const totalGainLossPct = totalCost > 0 ? (totalGainLoss / totalCost) * 100 : 0;
  const gainLossPositive = totalGainLoss >= 0;

  // The card-flip and back-logo reveal have no trigger wired up yet.
  const [isFlipped] = useState(false);
  const [backLogoReady] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [sheetType, setSheetType] = useState<'deposit' | 'withdraw' | null>(null);

  const openSheet = (type: 'deposit' | 'withdraw') => {
    setSheetType(type);
    setShowSheet(true);
    setDepositOpen(true);
  };
  const closeSheet = () => {
    setShowSheet(false);
    setSheetType(null);
    setDepositOpen(false);
  };

  const statusMsg: string | null = null;

  const renderStatusBadge = () => {
    if (isPreMarket) {
      return (
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-warning" style={{ animation: 'pulse 2s infinite' }} />
          <span className="text-[8px] font-medium" style={{ color: '#f59e0b' }}>Pre-Market</span>
        </div>
      );
    }
    return null;
  };

  return (
    <>
      {/* Card with flip */}
      <div className="perspective-1000" style={{ perspective: '1000px' }}>
        <div
          className="relative w-full transition-transform duration-700"
          style={{
            transformStyle: 'preserve-3d',
            transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
          }}>

          {/* Front */}
          <div
            onClick={() => setShowSheet(true)}
            className="rounded-2xl p-4 sm:p-5 md:p-6 relative overflow-hidden cursor-pointer border border-white/15"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              background: 'linear-gradient(135deg, hsl(140, 88%, 7%) 0%, hsl(135, 90%, 5%) 35%, hsl(150, 70%, 8%) 65%, hsl(145, 80%, 6%) 100%)',
              boxShadow: '0 8px 32px -8px rgba(2,30,5,0.7), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.3)',
              filter: 'none',
              transition: 'filter 0.8s ease, background 0.8s ease, box-shadow 0.8s ease'
            }}>

            
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -right-2 top-1/2 -translate-y-1/2 h-[105%] w-[70%]">
                <img src={cardPattern} alt="" loading="eager" decoding="sync" className="w-full h-full object-contain" style={{ filter: 'brightness(0) invert(1)', opacity: 0.12 }} />
              </div>
            </div>

            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'linear-gradient(125deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 25%, transparent 45%, transparent 55%, rgba(34,197,94,0.06) 80%, rgba(255,255,255,0.08) 100%)'
            }} />

            {isMarketOpen && middlewareOnline &&
            <div className="absolute pointer-events-none wallet-shimmer-streak" style={{
              top: '-60%', left: '-30%', width: '70%', height: '220%',
              background: 'linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.1) 43%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 57%, transparent 62%)'
            }} />
            }
            {isPreMarket && middlewareOnline &&
            <div className="absolute pointer-events-none wallet-shimmer-streak-slow" style={{
              top: '-60%', left: '-30%', width: '70%', height: '220%',
              background: 'linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.06) 43%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 57%, transparent 62%)'
            }} />
            }

            <div className="relative z-10">
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <img src={moneyAcumenLogo} alt="Money Acumen" width={40} height={40} loading="eager" fetchPriority="high"
                  className="w-8 h-8 sm:w-10 sm:h-10 object-contain"
                  style={{ filter: 'none', transition: 'filter 0.8s ease' }} />
                  
                  
                </div>
                <div className="flex items-center gap-2">
                  {renderStatusBadge()}
                </div>
              </div>

              <div className="space-y-0.5 mb-2">
                <p className="text-[10px] uppercase tracking-wider sm:text-base text-white/70">Wallet Balance</p>
                <span className="text-base font-semibold sm:text-3xl text-white">
                  {walletText}
                </span>
              </div>

              <div className="space-y-0.5 mb-2 sm:mb-3">
                <p className="text-[10px] sm:text-xs uppercase tracking-wider text-white/70">Portfolio Balance</p>
                <span className="text-xl sm:text-2xl font-bold md:text-lg text-white">
                  {holdingsLoading ? '---' : formatZMW(totalPortfolioValue)}
                </span>
              </div>

              {statusMsg &&
              <p className="text-[9px] mb-1" style={{ color: '#999' }}>{statusMsg}</p>
              }

              {!holdingsLoading && (
                <span className={`px-3 py-1 rounded-full text-sm font-medium inline-flex items-center gap-1 ${gainLossPositive ? 'bg-success-muted text-success' : 'bg-destructive-muted text-destructive'}`}>
                  <TrendIcon flipped={!gainLossPositive} /> {gainLossPositive ? '+' : ''}{formatZMW(totalGainLoss)} ({gainLossPositive ? '+' : ''}{totalGainLossPct.toFixed(2)}%)
                </span>
              )}


            </div>
          </div>

          {/* Back */}
          <div
            className="absolute inset-0 rounded-2xl overflow-hidden gradient-portfolio card-glow"
            style={{
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}>
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <div className="absolute -right-2 top-1/2 -translate-y-1/2 h-[105%] w-[70%]">
                <img src={cardPattern} alt="" loading="eager" decoding="sync" className="w-full h-full object-contain" style={{ filter: 'brightness(0) invert(1)', opacity: 0.12 }} />
              </div>
            </div>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 25%, transparent 45%)' }} />
            <div className="absolute pointer-events-none wallet-shimmer-streak" style={{ top: '-60%', left: '-30%', width: '70%', height: '220%', background: 'linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.1) 43%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 57%, transparent 62%)' }} />
            <div className="w-full h-full flex items-center justify-center p-6 relative z-10">
              <img
                src={moneyAcumenLogo} alt="Money Acumen" width={160} height={160} loading="eager" decoding="sync" fetchPriority="high"
                className={`w-32 h-32 sm:w-40 sm:h-40 object-contain drop-shadow-2xl transition-opacity duration-300 ${backLogoReady ? 'opacity-100' : 'opacity-0'}`} />
              
            </div>
          </div>
        </div>
      </div>

      {/* Wallet sheet — centered popup with blur */}
      {showSheet &&
      <>
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-60" onClick={closeSheet} />
          <div className="fixed inset-0 z-70 flex items-center justify-center p-4 pointer-events-none">
            <div className="liquid-gloss pointer-events-auto px-5 pt-5 pb-6 w-full max-w-md max-h-[80vh] overflow-y-auto relative">
              <div className="relative z-10">
                <button onClick={closeSheet} className="absolute top-0 right-0 p-1 rounded-full hover:bg-white/10 transition-colors">
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
                {!sheetType ?
              <div>
                    <h3 className="text-center font-semibold text-foreground text-lg mb-6">Wallet Actions</h3>
                    <div className="flex justify-center gap-10">
                      <button onClick={() => openSheet('deposit')} disabled={!canDeposit} className="flex flex-col items-center gap-2 disabled:opacity-40">
                        <div className="w-16 h-16 ring-tile flex items-center justify-center">
                          <ArrowDownLeft className="w-7 h-7 text-white" />
                        </div>
                        <span className="text-sm font-medium text-foreground">{canDeposit ? 'Deposit' : 'Unavailable'}</span>
                      </button>
                      <button onClick={() => openSheet('withdraw')} disabled={!canWithdraw} className="flex flex-col items-center gap-2 disabled:opacity-40">
                        <div className="w-16 h-16 ring-tile flex items-center justify-center">
                          <ArrowUpRight className="w-7 h-7 text-white" />
                        </div>
                        <span className="text-sm font-medium text-foreground">{canWithdraw ? 'Withdraw' : 'Unavailable'}</span>
                      </button>
                    </div>
                  </div> :

              sheetType === 'deposit' ?
              <DepositScreen onClose={closeSheet} /> :

              <WithdrawScreen onClose={closeSheet} />
              }
              </div>
            </div>
          </div>
        </>
      }
    </>);

};

const TrendIcon = ({ flipped }: { flipped?: boolean }) =>
<svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="inline" style={flipped ? { transform: 'scaleY(-1)' } : undefined}>
    <path d="M2 10L6 6L8 8L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;


export default PortfolioCard;
