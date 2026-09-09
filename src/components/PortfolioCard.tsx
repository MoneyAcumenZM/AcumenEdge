import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useAccountRestrictions } from "@/hooks/useAccountRestrictions";
import { useUI } from "@/contexts/UIContext";
import { useMiddleware } from "@/contexts/MiddlewareContext";
import { useMarketStatus } from "@/hooks/useMarketStatus";
import { useWallet, useHoldings } from "@/hooks/useSupabaseQuery";
import { formatZMW } from "@/lib/tradingUtils";
import { ArrowDownLeft, ArrowUpRight, X } from "lucide-react";
import cardPattern from "@/assets/card-pattern.svg";
import moneyAcumenLogo from "@/assets/money-acumen-logo.webp";
import DepositScreen from "@/components/DepositScreen";
import WithdrawScreen from "@/components/WithdrawScreen";

let cardRevealedThisSession = false;

const PortfolioCard = () => {
  const { profile } = useAuth();
  const { setDepositOpen } = useUI();
  const { canDeposit, canWithdraw } = useAccountRestrictions();
  const { isOnline: middlewareOnline, status: mwStatus } = useMiddleware();
  const { isMarketOpen, isPreMarket, isClosed, getNextOpenText } = useMarketStatus();
  const { data: wallet } = useWallet();
  const { data: holdings = [], isLoading: holdingsLoading } = useHoldings();

  const walletBalance = Number(wallet?.balance ?? 0);
  const totalPortfolioValue = (holdings as any[]).reduce(
    (sum, h: any) => sum + Number(h.current_value ?? h.currentValue ?? 0),
    0,
  );
  const holderName = profile?.full_name || 'Account Holder';
  const balanceColor = 'text-foreground';

  const [isFlipped, setIsFlipped] = useState(false);
  const [backLogoReady, setBackLogoReady] = useState(false);
  const [showSheet, setShowSheet] = useState(false);
  const [sheetType, setSheetType] = useState<'deposit' | 'withdraw' | null>(null);

  const isGreyscale = false;

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
                  {`K${walletBalance.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
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

              <span className="bg-success-muted text-success px-3 py-1 rounded-full text-sm font-medium inline-flex items-center gap-1">
                <TrendIcon /> +K0.00 (0.00%)
              </span>

              <div className="mt-3 sm:mt-4 flex justify-end">
                <span className="text-[9px] tracking-wide sm:text-lg text-white font-medium">{holderName}</span>
              </div>

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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]" onClick={closeSheet} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 pointer-events-none">
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

const TrendIcon = () =>
<svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="inline">
    <path d="M2 10L6 6L8 8L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;


export default PortfolioCard;
