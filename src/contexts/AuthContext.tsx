import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SECURITY_CONFIG, enforceNoIframe } from '@/lib/security';
import { logAudit } from '@/lib/audit';
import { format } from 'date-fns';
import { queryKeys } from '@/hooks/useSupabaseQuery';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Profile } from '@/lib/tradingUtils';
import KYCApprovalModal from '@/components/KYCApprovalModal';
import { getCachedProfile, setCachedProfile, clearCachedProfile, getCachedRole, setCachedRole } from '@/lib/profileCache';
import { canFetchNotifications } from '@/lib/notificationCooldown';
import { setMarketStatusCache } from '@/lib/marketStatusCache';
import { initOneSignal, linkUserToOneSignal, unlinkUserFromOneSignal, setUserTags, setupNotificationClickHandler, setupForegroundHandler, requestNotificationPermission } from '@/services/oneSignalService';
import { isMedianApp, saveBiometricSecret } from '@/services/biometricService';
import { middlewareClient, setApiAccessToken } from '@/services/middlewareClient';
import { setPaymentsAccessToken } from '@/services/dpoService';

interface AuthUser {
  id: string;
  email: string | undefined;
}

interface AuthContextValue {
  user: AuthUser | null;
  profile: Profile | null;
  role: string;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

type AccountStatus = 'active' | 'suspended' | 'banned' | 'trading_restricted' | 'withdrawal_restricted' | null;

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  role: 'RETAIL_USER',
  isLoading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

const SESSION_SYNC_KEY = 'circle_session_sync';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<string>('RETAIL_USER');
  const [isLoading, setIsLoading] = useState(true);
  const [warningLevel, setWarningLevel] = useState<'none' | 'warning' | 'critical'>('none');
  const [countdownSeconds, setCountdownSeconds] = useState(120);
  const [showKYCApproval, setShowKYCApproval] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout>>();
  const warningTimer = useRef<ReturnType<typeof setTimeout>>();
  const criticalTimer = useRef<ReturnType<typeof setTimeout>>();
  const countdownInterval = useRef<ReturnType<typeof setInterval>>();
  // FIX J: CSD register retry state — escalating 5 → 15 → 30min schedule.
  const csdRetryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const csdRetryAttempt = useRef(0);

  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    queryClient = useQueryClient();
  } catch {
    // QueryClient not available yet during initial render
  }

  useEffect(() => { enforceNoIframe(); }, []);

  // PART 3 — Fetch profile + role with localStorage cache
  const fetchProfile = useCallback(async (userId: string) => {
    // Try cache first
    const cachedProf = getCachedProfile(userId);
    const cachedR = getCachedRole(userId);

    if (cachedProf && cachedR) {
      setProfile(cachedProf as Profile);
      setRole(cachedR);
      // Still enforce banned from cache
      if (cachedProf.account_status === 'banned') {
        await supabase.auth.signOut();
        sessionStorage.removeItem('circle_authenticated');
        setUser(null);
        setProfile(cachedProf as Profile);
        setRole('RETAIL_USER');
        return;
      }
      return;
    }

    const [profileRes, roleRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, phone, nrc_passport, tpin, physical_address, province, bank_name, bank_account_number, date_of_birth, next_of_kin_name, next_of_kin_phone, next_of_kin_relation, sor_account, broker_bpid, member_bank_sca, platform_code, csd_registered, csd_registered_at, csd_bpid, csd_registration_status, kyc_status, kyc_rejection_reason, account_status, restriction_reason, restriction_until, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (profileRes.data) {
      const profileData = profileRes.data as unknown as Profile;
      setProfile(profileData);
      setCachedProfile(userId, profileData);

      if (profileData.account_status === 'banned') {
        await supabase.auth.signOut();
        sessionStorage.removeItem('circle_authenticated');
        setUser(null);
        setProfile(profileData);
        setRole('RETAIL_USER');
        return;
      }
    }
    const fetchedRole = roleRes.data?.role || 'RETAIL_USER';
    setRole(fetchedRole);
    setCachedRole(userId, fetchedRole);
  }, []);

  // FIX J: CSD registration with graceful retry. Schedule: 5min → 15min → 30min → 30min ...
  // Never blocks the session. Banner is surfaced via useAccountRestrictions while this runs.
  const tryCsdRegister = useCallback((userId: string) => {
    if (csdRetryTimer.current) { clearTimeout(csdRetryTimer.current); csdRetryTimer.current = null; }

    const persistBpid = async (bpid: string) => {
      try {
        await supabase
          .from('profiles')
          .update({ csd_bpid: bpid, csd_registered: true, csd_registration_status: 'approved' } as any)
          .eq('id', userId);
      } catch {}
      toast.success(`Investment account ready! CSD ref: ${bpid}`);
      clearCachedProfile(userId);
      csdRetryAttempt.current = 0;
    };

    const scheduleRetry = () => {
      const delays = [5 * 60_000, 15 * 60_000, 30 * 60_000];
      const delay = delays[Math.min(csdRetryAttempt.current, delays.length - 1)];
      csdRetryAttempt.current += 1;
      csdRetryTimer.current = setTimeout(() => tryCsdRegister(userId), delay);
    };

    middlewareClient.csdRegister(userId).then(async (res: any) => {
      const bpid = res?.bpid;
      if ((res?.success || res?.statusCode === '409' || res?.status === 409) && bpid) {
        await persistBpid(bpid);
      } else {
        // Soft failure — schedule retry, do not block session.
        scheduleRetry();
      }
    }).catch((err: any) => {
      const body = err?.body;
      const bpid = body?.bpid;
      if (err?.status === 409 && bpid) {
        persistBpid(bpid);
      } else {
        // Server offline / network error — retry quietly.
        scheduleRetry();
      }
    });
  }, []);

  const handleSignOut = useCallback(async () => {
    clearTimeout(inactivityTimer.current);
    clearTimeout(warningTimer.current);
    clearTimeout(criticalTimer.current);
    clearInterval(countdownInterval.current);
    if (csdRetryTimer.current) { clearTimeout(csdRetryTimer.current); csdRetryTimer.current = null; }
    csdRetryAttempt.current = 0;
    if (user) {
      await logAudit(supabase, user.id, 'SIGN_OUT');
      clearCachedProfile(user.id);
      await unlinkUserFromOneSignal();
    }
    setUser(null);
    setProfile(null);
    setRole('RETAIL_USER');
    setWarningLevel('none');
    await supabase.auth.signOut();
    sessionStorage.clear();
    localStorage.removeItem('circle_authenticated');
    localStorage.removeItem('maa_access_token');
    localStorage.setItem(SESSION_SYNC_KEY, JSON.stringify({ action: 'signout', ts: Date.now() }));
  }, [user]);

  const resetInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current);
    clearTimeout(warningTimer.current);
    clearTimeout(criticalTimer.current);
    clearInterval(countdownInterval.current);
    setWarningLevel('none');

    warningTimer.current = setTimeout(() => {
      setWarningLevel('warning');
    }, SECURITY_CONFIG.SESSION_WARNING_MS);

    criticalTimer.current = setTimeout(() => {
      setWarningLevel('critical');
      setCountdownSeconds(120);
      countdownInterval.current = setInterval(() => {
        setCountdownSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, SECURITY_CONFIG.SESSION_CRITICAL_MS);

    inactivityTimer.current = setTimeout(async () => {
      if (user) await logAudit(supabase, user.id, 'SESSION_TIMEOUT');
      await handleSignOut();
      window.location.href = '/signin?reason=timeout';
    }, SECURITY_CONFIG.SESSION_TIMEOUT_MS);
  }, [handleSignOut, user]);

  // Auth state listener + initial session
  useEffect(() => {
    // Force isLoading to false after 2 seconds max
    const forceTimeout = setTimeout(() => setIsLoading(false), 2000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      // Keep the API clients authenticated with the current session token.
      setApiAccessToken(session?.access_token ?? null);
      setPaymentsAccessToken(session?.access_token ?? null);
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
        setTimeout(() => fetchProfile(session.user.id), 0);
        resetInactivityTimer();
        // OneSignal: init + link user
        initOneSignal().then(() => {
          linkUserToOneSignal(session.user.id, session.user.email || '');
          requestNotificationPermission();
        });

        // Auto-create profile if missing (safety net)
        if (_event === 'SIGNED_IN') {
          // Fire-and-forget profile safety net — don't block UI
          Promise.resolve(supabase.from('profiles').select('id').eq('id', session.user.id).maybeSingle()).then(({ data: existingProfile }) => {
            if (!existingProfile) {
              Promise.resolve(supabase.from('profiles').upsert({
                id: session.user.id,
                full_name: session.user.user_metadata?.full_name || '',
                email: session.user.email || '',
                phone: session.user.user_metadata?.phone || '',
                broker_id: 'MAAL',
                dealer_id: 'MAA',
                kyc_status: 'pending',
                csd_registration_status: 'pending',
                csd_registered: false,
                account_status: 'active',
                wallet_balance: 0.00,
                updated_at: new Date().toISOString(),
              } as any, { onConflict: 'id', ignoreDuplicates: true })).then(() => {
                fetchProfile(session.user.id);
              }).catch(() => {});
            }
          }).catch(() => {});
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      // Auto-update biometric secret on token refresh
      if (_event === 'TOKEN_REFRESHED' && session?.refresh_token && session?.user) {
        const bioEnabled = localStorage.getItem(`bio_enabled_${session.user.id}`);
        if (bioEnabled === 'true' && isMedianApp()) {
          saveBiometricSecret(session.refresh_token);
        }
      }
      setIsLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setApiAccessToken(session?.access_token ?? null);
      setPaymentsAccessToken(session?.access_token ?? null);
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
        fetchProfile(session.user.id);
        resetInactivityTimer();
        // OneSignal: init + link user
        initOneSignal().then(() => {
          linkUserToOneSignal(session.user.id, session.user.email || '');
          requestNotificationPermission();
        });
      }
      setIsLoading(false);
    });

    const events = ['mousemove', 'keypress', 'click', 'touchstart', 'scroll'];
    const handler = () => resetInactivityTimer();
    events.forEach(e => window.addEventListener(e, handler, { passive: true }));

    const handleStorage = (e: StorageEvent) => {
      if (e.key === SESSION_SYNC_KEY && e.newValue) {
        try {
          const msg = JSON.parse(e.newValue);
          if (msg.action === 'signout') {
            setUser(null);
            setProfile(null);
            setRole('RETAIL_USER');
            setWarningLevel('none');
            sessionStorage.clear();
            window.location.href = '/signin?reason=signout';
          } else if (msg.action === 'activity') {
            resetInactivityTimer();
          }
        } catch {}
      }
    };
    window.addEventListener('storage', handleStorage);

    let lastBroadcast = 0;
    const broadcastActivity = () => {
      const now = Date.now();
      if (now - lastBroadcast > 30000) {
        lastBroadcast = now;
        localStorage.setItem(SESSION_SYNC_KEY, JSON.stringify({ action: 'activity', ts: now }));
      }
    };
    events.forEach(e => window.addEventListener(e, broadcastActivity, { passive: true }));

    const handleFocus = async () => {
      if (!user) return;
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session) {
        await handleSignOut();
        window.location.href = '/signin?reason=expired';
        return;
      }
      // Re-check account_status on app resume
      const { data: statusData } = await supabase
        .from('profiles')
        .select('account_status, restriction_reason, restriction_until')
        .eq('id', session.user.id)
        .single();
      if (statusData) {
        const sd = statusData as any;
        setProfile(prev => prev ? { ...prev, account_status: sd.account_status, restriction_reason: sd.restriction_reason, restriction_until: sd.restriction_until } as Profile : prev);
        setCachedProfile(session.user.id, { ...profile, account_status: sd.account_status, restriction_reason: sd.restriction_reason, restriction_until: sd.restriction_until });
        if (sd.account_status === 'banned') {
          await supabase.auth.signOut();
          sessionStorage.removeItem('circle_authenticated');
        }
      }
    };
    window.addEventListener('focus', handleFocus);

    if (window.location.hash.includes('access_token')) {
      window.history.replaceState(null, '', window.location.pathname);
    }

    const handleVisibility = () => {
      const overlay = document.getElementById('circle-security-overlay');
      if (document.visibilityState === 'hidden') {
        if (!overlay) {
          const div = document.createElement('div');
          div.id = 'circle-security-overlay';
          div.style.cssText = 'position:fixed;inset:0;background:hsl(var(--background));z-index:99999;display:flex;align-items:center;justify-content:center;';
          div.innerHTML = '<div style="color:hsl(var(--primary));font-size:2rem;font-weight:bold;">ACUMENEDGE</div>';
          document.body.appendChild(div);
        }
      } else {
        overlay?.remove();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearTimeout(forceTimeout);
      subscription.unsubscribe();
      events.forEach(e => window.removeEventListener(e, handler));
      events.forEach(e => window.removeEventListener(e, broadcastActivity));
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
      clearTimeout(inactivityTimer.current);
      clearTimeout(warningTimer.current);
      clearTimeout(criticalTimer.current);
      clearInterval(countdownInterval.current);
    };
  }, [fetchProfile, resetInactivityTimer, handleSignOut]);

  // ─── PART 4 — EXACTLY 2 REAL-TIME CHANNELS ───
  useEffect(() => {
    if (!user || !queryClient) return;

    const userId = user.id;

    // CHANNEL 1 — user-events: notifications, profile, orders, transactions
    const userChannel = supabase
      .channel(`user-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        queryClient!.setQueryData(queryKeys.notifications(userId), (old: any[] | undefined) => {
          const existing = old || [];
          if (existing.some((n: any) => n.id === payload.new.id)) return existing;
          return [payload.new, ...existing].slice(0, 50);
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      }, async (payload) => {
        const updated = payload.new as any;
        const previous = payload.old as any;
        setProfile(updated);
        setCachedProfile(userId, updated);

        if (updated?.account_status === 'banned') {
          await supabase.auth.signOut();
          sessionStorage.removeItem('circle_authenticated');
        }

        if (previous?.kyc_status !== 'approved' && updated?.kyc_status === 'approved') {
          setShowKYCApproval(true);
          // Auto-trigger CSD registration when KYC is approved
          if (!updated?.csd_registered && !updated?.csd_bpid) {
            toast.info('Setting up your investment account...');
            tryCsdRegister(userId);
          }
        }

        if (previous?.kyc_status !== 'rejected' && updated?.kyc_status === 'rejected') {
          const reason = updated?.kyc_rejection_reason || updated?.kyc_notes || '';
          if (reason) sessionStorage.setItem('kyc_rejection_reason', reason);
        }

        // FIX J: clear pending CSD retry timer once registration succeeds (Supabase realtime).
        if (previous?.csd_registered !== true && updated?.csd_registered === true) {
          if (csdRetryTimer.current) { clearTimeout(csdRetryTimer.current); csdRetryTimer.current = null; }
          csdRetryAttempt.current = 0;
        }

        if (previous?.csd_registered === true && updated?.csd_registered === false) {
          await logAudit(supabase, userId, 'ACCOUNT_SUSPENDED');
          await handleSignOut();
          window.location.href = '/signin?reason=suspended';
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const updated = payload.new as any;
        const old = payload.old as any;

        queryClient!.setQueryData(queryKeys.orders(userId), (prev: any[] | undefined) => {
          if (!prev) return prev;
          return prev.map((o: any) => o.id === updated.id ? { ...o, ...updated } : o);
        });
        queryClient!.setQueryData(queryKeys.recentOrders(userId), (prev: any[] | undefined) => {
          if (!prev) return prev;
          return prev.map((o: any) => o.id === updated.id ? { ...o, ...updated } : o);
        });

        if (updated.status === 'filled' && old?.status !== 'filled') {
          toast.success(`Trade executed — ${updated.filled_quantity || updated.quantity} shares at K${(updated.filled_price || 0).toFixed(2)}`, {
            duration: 6000,
          });
          queryClient!.invalidateQueries({ queryKey: queryKeys.holdings(userId) });
        }
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'transactions',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const tx = payload.new as any;
        if (tx.type === 'deposit') {
          toast.success(`Deposit confirmed — K${Number(tx.amount).toFixed(2)} has been added to your wallet`, {
            duration: 6000,
          });
        }
      })
      .subscribe();

    // CHANNEL 2 — market-events: market_status + platform_settings
    const marketChannel = supabase
      .channel('market-global')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'market_status',
        filter: 'exchange=eq.LuSE',
      }, (payload) => {
        queryClient!.setQueryData(queryKeys.marketStatus, payload.new);
        setMarketStatusCache(payload.new);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'platform_settings',
      }, (payload: any) => {
        if (payload.new?.key === 'platform_enabled' && payload.new?.value === 'false') {
          window.location.href = '/maintenance';
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(userChannel);
      supabase.removeChannel(marketChannel);
    };
  }, [user, queryClient, handleSignOut]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      clearCachedProfile(user.id);
      await fetchProfile(user.id);
    }
  }, [user, fetchProfile]);

  const formatCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Banned screen — full block, no app content
  const isBanned = profile?.account_status === 'banned';

  if (isBanned) {
    const reason = profile?.restriction_reason;
    const until = profile?.restriction_until;
    let timeframeText = 'permanently';
    if (until) {
      try {
        const d = new Date(until);
        if (!isNaN(d.getTime())) {
          timeframeText = `until ${format(d, 'dd MMM yyyy, HH:mm')}`;
        }
      } catch {}
    }

    return (
      <AuthContext.Provider value={{ user, profile, role, isLoading, signOut: handleSignOut, refreshProfile }}>
        <div className="fixed inset-0 z-[9999] bg-background flex items-center justify-center p-6">
          <div className="max-w-sm text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--destructive))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
            </div>
            <h1 className="text-xl font-bold text-foreground">Your account has been closed.</h1>
            {reason && (
              <p className="text-sm text-muted-foreground"><span className="font-medium text-foreground">Reason:</span> {reason}</p>
            )}
            <p className="text-sm text-muted-foreground leading-relaxed">
              This restriction is in effect <span className="font-medium text-foreground">{timeframeText}</span>.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Please contact Money Acumen Advisory at{' '}
              <a href="mailto:trading@moneyacumenadvisory.com" className="text-primary font-medium">
                trading@moneyacumenadvisory.com
              </a>{' '}
              if you believe this is an error.
            </p>
          </div>
        </div>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{ user, profile, role, isLoading, signOut: handleSignOut, refreshProfile }}>
      <KYCApprovalModal open={showKYCApproval} onClose={() => setShowKYCApproval(false)} />

      {warningLevel === 'warning' && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-warning/90 text-warning-foreground px-4 py-2.5 flex items-center justify-between">
          <p className="text-sm font-medium">Your session will expire in 5 minutes due to inactivity.</p>
          <button
            onClick={resetInactivityTimer}
            className="text-xs font-bold bg-background/20 hover:bg-background/30 px-3 py-1 rounded-lg transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {warningLevel === 'critical' && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
          <div className="bg-card border border-destructive/30 rounded-xl p-8 max-w-md text-center space-y-4">
            <p className="text-destructive font-bold text-lg">Session Expiring</p>
            <div className="text-4xl font-mono font-bold text-foreground">{formatCountdown(countdownSeconds)}</div>
            <p className="text-muted-foreground text-sm">You will be signed out due to inactivity.</p>
            <button
              onClick={resetInactivityTimer}
              className="bg-primary text-primary-foreground font-bold px-8 py-3 rounded-xl w-full text-sm hover:opacity-90 transition-opacity"
            >
              Keep Me Logged In
            </button>
          </div>
        </div>
      )}

      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
