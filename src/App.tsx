import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useAccountRestrictions } from "@/hooks/useAccountRestrictions";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { CSDProvider } from "@/contexts/CSDContext";
import { MiddlewareProvider } from "@/contexts/MiddlewareContext";
import { WatchlistProvider } from "@/contexts/WatchlistContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UIProvider, useUI } from "@/contexts/UIContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Capacitor } from "@capacitor/core";
import { initNotifications } from "@/services/notifications";
import { initNetworkMonitoring } from "@/services/network";
import AppTutorial, { TUTORIAL_KEY } from "@/components/AppTutorial";
import AppSidebar from "@/components/AppSidebar";
import FirstLoginSetup from "@/components/FirstLoginSetup";
import PINLockScreen from "@/components/PINLockScreen";
import { isPINEnabled, recordActivity, getLastActivity } from "@/services/pinService";
import SessionWarningBanner from "@/components/SessionWarningBanner";
import { testMiddlewareConnection } from "@/services/middlewareClient";
import { toast } from "sonner";

// Home screen loaded eagerly for instant render
import Index from "./pages/Index";

// Auth pages loaded eagerly (small, needed immediately)
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";

// Everything else lazy loaded
const Market = lazy(() => import("./pages/Market"));
const StockScreener = lazy(() => import("./pages/StockScreener"));
const ATSTrade = lazy(() => import("./pages/ATSTrade"));
const ATSMyOrders = lazy(() => import("./pages/ATSMyOrders"));
const ATSPortfolio = lazy(() => import("./pages/ATSPortfolio"));
const Charts = lazy(() => import("./pages/Charts"));
const Watchlist = lazy(() => import("./pages/Watchlist"));
const Profile = lazy(() => import("./pages/Profile"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const DemoSetup = lazy(() => import("./pages/DemoSetup"));
const MarketNews = lazy(() => import("./pages/MarketNews"));
const Sectors = lazy(() => import("./pages/Sectors"));
const AnalysisPage = lazy(() => import("./pages/AnalysisPage"));
const Maintenance = lazy(() => import("./pages/Maintenance"));
const NotFound = lazy(() => import("./pages/NotFound"));
const AccountPending = lazy(() => import("./pages/AccountPending"));
const AccountRejected = lazy(() => import("./pages/AccountRejected"));
const DepositComplete = lazy(() => import("./pages/DepositComplete"));
const DepositCancelled = lazy(() => import("./pages/DepositCancelled"));
const Bonds = lazy(() => import("./pages/Bonds"));
const BondDetail = lazy(() => import("./pages/BondDetail"));
const ATSTradeHistory = lazy(() => import("./pages/ATSTradeHistory"));
const AdminClients = lazy(() => import("./pages/AdminClients"));

// Minimal loading fallback
const LazyFallback = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

// PART 2 — Maximum cache, zero automatic refetch
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      retry: 0,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      refetchInterval: false,
      refetchIntervalInBackground: false,
      networkMode: 'offlineFirst',
    },
  },
});

export { queryClient };

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const { user, isLoading } = useAuth();
  const publicPaths = ['/signin', '/signup', '/demo', '/maintenance', '/account-pending', '/account-rejected', '/forgot-password', '/reset-password', '/.lovable/oauth/consent'];
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
  const publicPaths = ['/signin', '/signup', '/demo', '/maintenance', '/account-pending', '/account-rejected', '/forgot-password', '/reset-password', '/.lovable/oauth/consent'];
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

const PinSetupPrompt = () => {
  const { user } = useAuth();
  const userId = user?.id;
  const shouldShow = userId && !isPINEnabled(userId) && (() => {
    const dismissed = localStorage.getItem(`maa_pin_dismissed_${userId}`);
    return !dismissed || Date.now() - parseInt(dismissed) >= 7 * 24 * 60 * 60 * 1000;
  })();

  useEffect(() => {
    if (!shouldShow || !userId) return;
    const timer = setTimeout(() => {
      toast('Set up a PIN for faster app access', {
        action: {
          label: 'Set Up',
          onClick: () => { window.location.href = '/profile'; },
        },
        duration: 8000,
      });
      localStorage.setItem(`maa_pin_dismissed_${userId}`, Date.now().toString());
    }, 5000);
    return () => clearTimeout(timer);
  }, [shouldShow, userId]);

  return null;
};

const App = () => {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    async function boot() {
      if (Capacitor.isNativePlatform()) {
        try {
          const { SplashScreen: CapSplash } = await import('@capacitor/splash-screen');
          await CapSplash.hide();
          const { StatusBar, Style } = await import('@capacitor/status-bar');
          await StatusBar.setStyle({ style: Style.Dark });
          await StatusBar.setBackgroundColor({ color: '#031a05' });
          const { Keyboard } = await import('@capacitor/keyboard');
          Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
          const { App: CapApp } = await import('@capacitor/app');
          CapApp.addListener('backButton', ({ canGoBack }) => {
            if (!canGoBack) CapApp.exitApp();
            else window.history.back();
          });
        } catch {}
      }
      await initNotifications();
      initNetworkMonitoring(
        () => setIsOffline(true),
        () => setIsOffline(false)
      );
    }
    boot();
    testMiddlewareConnection().then(r => {
      if (!r.ok) console.error('[MW] Connection test failed:', r.error);
      else console.log('[MW] Connection test passed');
    });
  }, []);

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
              <CSDProvider>
                <WatchlistProvider>
                    <AuthGuard>
                      <FirstLoginSetup />
                      <AppLockLayer />
                      <TutorialPrompt />
                      <PinSetupPrompt />
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
                          <Route path="/sectors" element={<Sectors />} />
                          <Route path="/signin" element={<SignIn />} />
                          <Route path="/signup" element={<SignUp />} />
                          <Route path="/forgot-password" element={<ForgotPassword />} />
                          <Route path="/reset-password" element={<ResetPassword />} />
                          <Route path="/demo" element={<DemoSetup />} />
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
                          <Route path="*" element={<Navigate to="/signin" replace />} />
                        </Routes>
                        </Suspense>
                      </AppLayout>
                    </AuthGuard>
                  </WatchlistProvider>
              </CSDProvider>
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
