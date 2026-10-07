import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useAccountRestrictions } from "@/features/auth/hooks/useAccountRestrictions";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { MiddlewareProvider } from "@/contexts/MiddlewareContext";
import { WatchlistProvider } from "@/features/market/WatchlistContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UIProvider, useUI } from "@/contexts/UIContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initNetworkMonitoring } from "@/services/network";
import AppTutorial from "@/features/home/components/AppTutorial";
import AppSidebar from "@/components/layout/AppSidebar";
import PINLockScreen from "@/features/auth/components/PINLockScreen";
import { isPINEnabled, recordActivity, getLastActivity } from "@/features/auth/services/pinService";
import { testMiddlewareConnection, isTradingApiConfigured } from "@/services/middlewareClient";
import { isProductionMisconfigured } from "@/integrations/data/client";
import { TUTORIAL_KEY } from "@/lib/config";

// Home screen loaded eagerly for instant render
import Index from "@/features/home/pages/Index";

// Auth pages loaded eagerly (small, needed immediately)
import SignIn from "@/features/auth/pages/SignIn";
import SignUp from "@/features/auth/pages/SignUp";

// Everything else lazy loaded
const Market = lazy(() => import("@/features/market/pages/Market"));
const StockScreener = lazy(() => import("@/features/market/pages/StockScreener"));
const ATSTrade = lazy(() => import("@/features/trading/pages/ATSTrade"));
const ATSMyOrders = lazy(() => import("@/features/trading/pages/ATSMyOrders"));
const ATSPortfolio = lazy(() => import("@/features/portfolio/pages/ATSPortfolio"));
const Charts = lazy(() => import("@/features/charts/pages/Charts"));
const Watchlist = lazy(() => import("@/features/market/pages/Watchlist"));
const Profile = lazy(() => import("@/features/profile/pages/Profile"));
const ForgotPassword = lazy(() => import("@/features/auth/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/features/auth/pages/ResetPassword"));
const MarketNews = lazy(() => import("@/features/market/pages/MarketNews"));
const Sectors = lazy(() => import("@/features/market/pages/Sectors"));
const Securities = lazy(() => import("@/features/market/pages/Securities"));
const Announcements = lazy(() => import("@/features/market/pages/Announcements"));
const Dividends = lazy(() => import("@/features/market/pages/Dividends"));
const AnalysisPage = lazy(() => import("@/features/charts/pages/AnalysisPage"));
const Maintenance = lazy(() => import("@/pages/Maintenance"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const AccountPending = lazy(() => import("@/features/auth/pages/AccountPending"));
const AccountRejected = lazy(() => import("@/features/auth/pages/AccountRejected"));
const DepositComplete = lazy(() => import("@/features/wallet/pages/DepositComplete"));
const DepositCancelled = lazy(() => import("@/features/wallet/pages/DepositCancelled"));
const Bonds = lazy(() => import("@/features/market/pages/Bonds"));
const BondDetail = lazy(() => import("@/features/market/pages/BondDetail"));
const ATSTradeHistory = lazy(() => import("@/features/trading/pages/ATSTradeHistory"));
const AdminClients = lazy(() => import("@/features/admin/pages/AdminClients"));

// Minimal loading fallback
const LazyFallback = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// Long-lived cache with no refetch on focus/mount, to keep request volume
// down; hooks for balances, holdings, orders and prices set their own
// shorter intervals. One retry and a refetch on reconnect mean a dropped
// request on a flaky mobile connection doesn't leave a screen empty, and
// queries pause (rather than fail) while offline.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: true,
      refetchInterval: false,
      refetchIntervalInBackground: false,
      networkMode: 'online',
    },
  },
});

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const publicPaths = ['/signin', '/signup', '/maintenance', '/account-pending', '/account-rejected', '/forgot-password', '/reset-password'];
  const isPublic = publicPaths.includes(location.pathname);

  if (isLoading) return <LazyFallback />;

  if (!user && !isPublic) {
    return <Navigate to={`/signin?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }

  // Signed-in users don't need to linger on auth pages (except password reset flows).
  if (user && isPublic && !['/reset-password', '/forgot-password'].includes(location.pathname)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};


const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { isDepositOpen } = useUI();
  const { restrictionBanner, accountStatus } = useAccountRestrictions();
  const publicPaths = ['/signin', '/signup', '/maintenance', '/account-pending', '/account-rejected', '/forgot-password', '/reset-password'];
  const isPublic = publicPaths.includes(location.pathname);
  const isAnalysis = location.pathname.startsWith('/analysis/');

  if (isPublic || isAnalysis) {
    return <>{children}</>;
  }


  const bannerBg = accountStatus === 'banned' ? 'bg-destructive/10 border-destructive/20' : 'bg-warning/10 border-warning/20';
  const bannerText = accountStatus === 'banned' ? 'text-destructive' : 'text-warning';

  return (
    <div className="flex min-h-screen mobile-contain hide-scrollbar">
      {!isDepositOpen && <AppSidebar />}
      <main className="flex-1 p-4 md:p-6 lg:p-8 pt-2 md:pt-6 pb-24 md:pb-24 overflow-x-hidden">
        {/* The banner text and its colours were computed above but never
            rendered, so a suspended or restricted client was never told
            why trading or withdrawals had stopped working. */}
        {restrictionBanner && (
          <div role="alert" className={`mb-4 border rounded-xl px-4 py-3 ${bannerBg}`}>
            <p className={`text-xs font-medium ${bannerText}`}>{restrictionBanner}</p>
          </div>
        )}
        {children}
      </main>
    </div>
  );
};

const LOCK_AFTER_MS = 2 * 60 * 1000;

const AppLockLayer = () => {
  const { user, profile, signOut } = useAuth();
  const [locked, setLocked] = useState(false);
  const lockTimer = useRef<ReturnType<typeof setTimeout>>();
  const hasPin = user ? isPINEnabled(user.id) : false;

  useEffect(() => {
    if (!user || !hasPin) return;
    const last = getLastActivity();
    if (Date.now() - last > LOCK_AFTER_MS) {
      setLocked(true);
    }
  }, [user, hasPin]);

  useEffect(() => {
    if (!user || !hasPin) return;

    const resetTimer = () => {
      if (locked) return;
      recordActivity();
      clearTimeout(lockTimer.current);
      lockTimer.current = setTimeout(() => setLocked(true), LOCK_AFTER_MS);
    };

    resetTimer();
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'input'];
    events.forEach(e => document.addEventListener(e, resetTimer, { passive: true }));
    return () => {
      events.forEach(e => document.removeEventListener(e, resetTimer));
      clearTimeout(lockTimer.current);
    };
  }, [user, hasPin, locked]);

  const handleUnlock = useCallback(() => {
    setLocked(false);
    recordActivity();
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    setLocked(false);
  }, [signOut]);

  if (!locked || !user || !hasPin) return null;

  const firstName = profile?.full_name?.split(' ')[0] || 'User';
  return <PINLockScreen userId={user.id} firstName={firstName} onUnlock={handleUnlock} onSignOut={handleSignOut} />;
};

const TutorialPrompt = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (user && !localStorage.getItem(TUTORIAL_KEY)) {
      setShow(true);
    }
  }, [user]);

  if (!show) return null;
  return <AppTutorial onComplete={() => setShow(false)} />;
};

const App = () => {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // Production build with no backend configured is a misconfiguration, not
    // a valid running mode — the hard error screen below handles it, so skip
    // the network/middleware boot work that assumes a real backend.
    if (isProductionMisconfigured) return;

    async function boot() {
      initNetworkMonitoring(
        () => setIsOffline(true),
        () => setIsOffline(false)
      );
    }
    boot();
    // Only worth checking (and only worth an error) when a trading API is
    // actually configured; with none, every boot logged a failure.
    if (isTradingApiConfigured) {
      testMiddlewareConnection().then(r => {
        if (!r.ok) console.error('[MW] Connection test failed:', r.error);
      });
    }
  }, []);

  // Production build with no backend configured: this is a misconfiguration,
  // not a valid running mode for a live-money brokerage app. Fail closed with
  // a hard error screen instead of silently mounting the local demo client
  // (see src/integrations/data/client.ts for the rest of this guard).
  if (isProductionMisconfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-center">
        <div className="max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-foreground">Service unavailable</h1>
          <p className="text-sm text-muted-foreground">
            This app is not configured to reach its backend and cannot start safely.
            Please contact support or try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <UIProvider>
            <AuthProvider>
              <MiddlewareProvider>
                <WatchlistProvider>
                    <AuthGuard>
                      <AppLockLayer />
                      <TutorialPrompt />
                      <AppLayout>
                        {isOffline && (
                          <div className="mb-4 bg-warning/10 border border-warning/20 rounded-xl px-4 py-3">
                            <p className="text-xs text-warning text-center font-medium">You are offline — market data may be outdated</p>
                          </div>
                        )}
                        <Suspense fallback={<LazyFallback />}>
                        <Routes>
                          <Route path="/" element={<ErrorBoundary><Index /></ErrorBoundary>} />
                          <Route path="/market" element={<Market />} />
                          <Route path="/stock/:ticker" element={<StockScreener />} />
                          <Route path="/trade" element={<ErrorBoundary><ATSTrade /></ErrorBoundary>} />
                          <Route path="/my-orders" element={<ErrorBoundary><ATSMyOrders /></ErrorBoundary>} />
                          <Route path="/portfolio" element={<ErrorBoundary><ATSPortfolio /></ErrorBoundary>} />
                          <Route path="/charts" element={<Charts />} />
                          <Route path="/watchlist" element={<Watchlist />} />
                          <Route path="/profile" element={<Profile />} />
                          <Route path="/market-news" element={<MarketNews />} />
                          <Route path="/announcements" element={<Announcements />} />
                          <Route path="/securities" element={<Securities />} />
                          <Route path="/dividends" element={<Dividends />} />
                          <Route path="/sectors" element={<Sectors />} />
                          <Route path="/signin" element={<SignIn />} />
                          <Route path="/signup" element={<SignUp />} />
                          <Route path="/forgot-password" element={<ForgotPassword />} />
                          <Route path="/reset-password" element={<ResetPassword />} />
                          <Route path="/maintenance" element={<Maintenance />} />
                          <Route path="/analysis/:symbol" element={<AnalysisPage />} />
                          <Route path="/account-pending" element={<AccountPending />} />
                          <Route path="/account-rejected" element={<AccountRejected />} />
                          
                          <Route path="/bonds" element={<Bonds />} />
                          <Route path="/bonds/:symbol" element={<BondDetail />} />
                          <Route path="/trade-history" element={<ATSTradeHistory />} />
                          <Route path="/admin/clients" element={<ErrorBoundary><AdminClients /></ErrorBoundary>} />
                          <Route path="/wallet/deposit-complete" element={<DepositComplete />} />
                          <Route path="/wallet/deposit-cancelled" element={<DepositCancelled />} />
                          {/* Unauthenticated users never reach this — AuthGuard above already
                              redirects any non-public path to /signin before Routes matches. */}
                          <Route path="*" element={<NotFound />} />
                        </Routes>
                        </Suspense>
                      </AppLayout>
                    </AuthGuard>
                  </WatchlistProvider>
              </MiddlewareProvider>
            </AuthProvider>
            </UIProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
