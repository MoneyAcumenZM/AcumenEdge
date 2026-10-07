import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/integrations/data/client';
import { SECURITY_CONFIG, enforceNoIframe } from '@/lib/security';
import { logAudit } from '@/lib/audit';
import { format } from 'date-fns';
import { queryKeys } from '@/hooks/useDataQuery';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Profile } from '@/lib/tradingUtils';
import KYCApprovalModal from '@/features/auth/components/KYCApprovalModal';
import type { Tables } from '@/integrations/data/schema';
import { getCachedProfile, setCachedProfile, clearCachedProfile } from '@/features/auth/profileCache';
import { disableBiometricLogin, syncBiometricLogin } from '@/features/auth/services/biometricService';
import { middlewareClient, setApiAccessToken, ApiError } from '@/services/middlewareClient';
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

type NotificationRow = Pick<Tables<'notifications'>, 'id' | 'title' | 'body' | 'type' | 'is_read' | 'created_at'>;
type OrderRow = Tables<'orders'>;
// Cached order lists hold a column subset plus the joined stock, so only `id` is relied on here.
type CachedOrder = Partial<OrderRow> & { id: string };
// `kyc_notes` is read defensively below but isn't in the generated row type.
type ProfileRow = Tables<'profiles'> & { kyc_notes?: string | null };

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

  // Mirrors `user` so handleSignOut/resetInactivityTimer can read the current
  // user from stable (empty-deps) callbacks. Depending on `user` directly would
  // give them a new identity on every auth event (setUser allocates a new
  // object, even on TOKEN_REFRESHED), which would re-run the main effect below
  // and re-subscribe onAuthStateChange and every window listener each time.
  const userRef = useRef<AuthUser | null>(null);
  useEffect(() => { userRef.current = user; }, [user]);
  // Same reasoning as userRef — handleFocus below lives inside the main
  // effect, which now only runs once on mount, so it must read the current
  // profile through a ref rather than closing over the `profile` state
  // (which would otherwise always be the mount-time value, permanently).
  const profileRef = useRef<Profile | null>(null);
  useEffect(() => { profileRef.current = profile; }, [profile]);

  // app/App.tsx always wraps AuthProvider in QueryClientProvider, so this hook
  // never actually throws — the try/catch around it was itself a
  // rules-of-hooks violation (a hook call that ESLint can't prove always
  // runs), flagged by react-hooks/rules-of-hooks.
  const queryClient = useQueryClient();

  useEffect(() => { enforceNoIframe(); }, []);

  // Fetch profile + role, verified with the server every time. The
  // localStorage cache (a small, non-sensitive field subset — see
  // profileCache.ts) only paints the UI while the real fetch is in flight; it
  // never replaces it, and the role is never read from cache.
  const fetchProfile = useCallback(async (userId: string) => {
    const cachedProf = getCachedProfile(userId);
    if (cachedProf) {
      setProfile((prev) => ({ ...(prev || {}), ...cachedProf }) as Profile);
    }

    const [profileRes, roleRes] = await Promise.all([
      db
        .from('profiles')
        .select('id, full_name, phone, nrc_passport, tpin, physical_address, province, bank_name, bank_account_number, date_of_birth, next_of_kin_name, next_of_kin_phone, next_of_kin_relation, sor_account, broker_bpid, member_bank_sca, platform_code, csd_registered, csd_registered_at, csd_bpid, csd_registration_status, kyc_status, kyc_rejection_reason, account_status, restriction_reason, restriction_until, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle(),
      db
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
        await disableBiometricLogin();
        await db.auth.signOut();
        sessionStorage.removeItem('circle_authenticated');
        setUser(null);
        setProfile(profileData);
        setRole('RETAIL_USER');
        return;
      }
    }
    const fetchedRole = roleRes.data?.role || 'RETAIL_USER';
    // The role is deliberately not cached: it is only ever trusted fresh
    // from the server, so a stored copy would just be something to tamper with.
    setRole(fetchedRole);
  }, []);

  // FIX J: CSD registration with graceful retry. Schedule: 5min → 15min → 30min → 30min ...
  // Never blocks the session. Banner is surfaced via useAccountRestrictions while this runs.
  const tryCsdRegister = useCallback((userId: string) => {
    if (csdRetryTimer.current) { clearTimeout(csdRetryTimer.current); csdRetryTimer.current = null; }

    // The server that performs the registration is also the one that
    // records it on the profile, with its own credentials. The browser used
    // to write csd_registered/csd_bpid itself here — fields the database
    // (rightly) refuses to let a client set, so the write was rejected and
    // the registration never showed up. All the client does now is re-read.
    const onRegistered = async (bpid: string) => {
      toast.success(`Investment account ready! CSD ref: ${bpid}`);
      clearCachedProfile(userId);
      csdRetryAttempt.current = 0;
      await fetchProfile(userId);
    };

    const scheduleRetry = () => {
      const delays = [5 * 60_000, 15 * 60_000, 30 * 60_000];
      const delay = delays[Math.min(csdRetryAttempt.current, delays.length - 1)];
      csdRetryAttempt.current += 1;
      csdRetryTimer.current = setTimeout(() => tryCsdRegister(userId), delay);
    };

    middlewareClient.csdRegister().then(async (res) => {
      const bpid = res?.bpid;
      if ((res?.success || res?.statusCode === '409' || res?.status === 409) && bpid) {
        await onRegistered(bpid);
      } else {
        // Soft failure — schedule retry, do not block session.
        scheduleRetry();
      }
    }).catch((err: unknown) => {
      // 409 = already registered; the body carries the existing BPID.
      const bpid = err instanceof ApiError && err.status === 409 ? err.body?.bpid : undefined;
      if (typeof bpid === 'string' && bpid) {
        onRegistered(bpid);
      } else {
        // Server offline / network error — retry quietly.
        scheduleRetry();
      }
    });
  }, [fetchProfile]);

  // Ends the session. `keepBiometric` is for the inactivity timeout: the
  // session ends on this device only and the token stored for biometric
  // sign-in stays valid, so the user can get straight back in with Face ID
  // or fingerprint. Tapping Sign Out removes biometric sign-in too, which
  // matters on shared phones.
  const endSession = useCallback(async (keepBiometric: boolean) => {
    clearTimeout(inactivityTimer.current);
    clearTimeout(warningTimer.current);
    clearTimeout(criticalTimer.current);
    clearInterval(countdownInterval.current);
    if (csdRetryTimer.current) { clearTimeout(csdRetryTimer.current); csdRetryTimer.current = null; }
    csdRetryAttempt.current = 0;
    const currentUser = userRef.current;
    if (currentUser) {
      await logAudit('SIGN_OUT');
      clearCachedProfile(currentUser.id);
      if (!keepBiometric) await disableBiometricLogin();
    }
    setUser(null);
    setProfile(null);
    setRole('RETAIL_USER');
    setWarningLevel('none');
    await db.auth.signOut(keepBiometric ? { scope: 'local' } : undefined);
    sessionStorage.clear();
    localStorage.removeItem('circle_authenticated');
    localStorage.removeItem('maa_access_token');
    localStorage.setItem(SESSION_SYNC_KEY, JSON.stringify({ action: 'signout', ts: Date.now() }));
  }, []);

  const handleSignOut = useCallback(() => endSession(false), [endSession]);

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
      if (userRef.current) await logAudit('SESSION_TIMEOUT');
      await endSession(true);
      window.location.href = '/signin?reason=timeout';
    }, SECURITY_CONFIG.SESSION_TIMEOUT_MS);
  }, [endSession]);

  // Auth state listener + initial session
  useEffect(() => {
    // Force isLoading to false after 2 seconds max
    const forceTimeout = setTimeout(() => setIsLoading(false), 2000);

    const { data: { subscription } } = db.auth.onAuthStateChange(async (_event, session) => {
      // Keep the API clients authenticated with the current session token.
      setApiAccessToken(session?.access_token ?? null);
      setPaymentsAccessToken(session?.access_token ?? null);
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
        setTimeout(() => fetchProfile(session.user.id), 0);
        resetInactivityTimer();

        // Auto-create profile if missing (safety net)
        if (_event === 'SIGNED_IN') {
          // Fire-and-forget profile safety net — don't block UI
          Promise.resolve(db.from('profiles').select('id').eq('id', session.user.id).maybeSingle()).then(({ data: existingProfile }) => {
            if (!existingProfile) {
              Promise.resolve(db.from('profiles').upsert({
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
                updated_at: new Date().toISOString(),
              }, { onConflict: 'id', ignoreDuplicates: true })).then(() => {
                fetchProfile(session.user.id);
              }).catch(() => {});
            }
          }).catch(() => {});
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      // Keep the token stored for biometric sign-in current (refresh tokens
      // rotate), or clear it if a different account has signed in.
      if ((_event === 'TOKEN_REFRESHED' || _event === 'SIGNED_IN') && session?.refresh_token && session?.user) {
        syncBiometricLogin(session.user.id, session.refresh_token);
      }
      setIsLoading(false);
    });

    db.auth.getSession().then(({ data: { session } }) => {
      setApiAccessToken(session?.access_token ?? null);
      setPaymentsAccessToken(session?.access_token ?? null);
      if (session?.user) {
        setUser({ id: session.user.id, email: session.user.email });
        fetchProfile(session.user.id);
        resetInactivityTimer();
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
        } catch {
          // Not one of our sync messages — ignore.
        }
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
      if (!userRef.current) return;
      const { data: { session }, error } = await db.auth.getSession();
      if (error || !session) {
        await handleSignOut();
        window.location.href = '/signin?reason=expired';
        return;
      }
      // Re-check account_status on app resume
      const { data: statusData } = await db
        .from('profiles')
        .select('account_status, restriction_reason, restriction_until')
        .eq('id', session.user.id)
        .single();
      if (statusData) {
        const sd = statusData;
        setProfile(prev => prev ? { ...prev, account_status: sd.account_status, restriction_reason: sd.restriction_reason, restriction_until: sd.restriction_until } as Profile : prev);
        // profileRef, not the closed-over `profile`: this handler is registered
        // once, so `profile` would be the mount-time value.
        setCachedProfile(session.user.id, { ...profileRef.current, account_status: sd.account_status, restriction_reason: sd.restriction_reason, restriction_until: sd.restriction_until });
        if (sd.account_status === 'banned') {
          await db.auth.signOut();
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
    const userChannel = db
      .channel(`user-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        queryClient!.setQueryData(queryKeys.notifications(userId), (old: NotificationRow[] | undefined) => {
          const existing = old || [];
          if (existing.some((n) => n.id === payload.new.id)) return existing;
          return [payload.new, ...existing].slice(0, 50);
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      }, async (payload) => {
        const updated = payload.new as ProfileRow;
        const previous = payload.old as Partial<ProfileRow>;
        setProfile(updated as unknown as Profile);
        setCachedProfile(userId, updated);

        if (updated?.account_status === 'banned') {
          await db.auth.signOut();
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
          await logAudit('ACCOUNT_SUSPENDED');
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
        // event '*' includes DELETE, where payload.new is {} — remove the row by
        // payload.old.id instead of trying to merge an empty update.
        if (payload.eventType === 'DELETE') {
          const deletedId = (payload.old as Partial<OrderRow>)?.id;
          if (deletedId) {
            queryClient!.setQueryData(queryKeys.orders(userId), (prev: CachedOrder[] | undefined) => prev?.filter((o) => o.id !== deletedId));
            queryClient!.setQueryData(queryKeys.recentOrders(userId), (prev: CachedOrder[] | undefined) => prev?.filter((o) => o.id !== deletedId));
          }
          return;
        }

        const updated = payload.new as OrderRow;
        const old = payload.old as Partial<OrderRow>;

        queryClient!.setQueryData(queryKeys.orders(userId), (prev: CachedOrder[] | undefined) => {
          if (!prev) return prev;
          return prev.map((o) => o.id === updated.id ? { ...o, ...updated } : o);
        });
        queryClient!.setQueryData(queryKeys.recentOrders(userId), (prev: CachedOrder[] | undefined) => {
          if (!prev) return prev;
          return prev.map((o) => o.id === updated.id ? { ...o, ...updated } : o);
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
        const tx = payload.new as Tables<'transactions'>;
        if (tx.type === 'deposit') {
          toast.success(`Deposit confirmed — K${Number(tx.amount).toFixed(2)} has been added to your wallet`, {
            duration: 6000,
          });
        }
      })
      .subscribe();

    // CHANNEL 2 — market-events: market_status + platform_settings
    const marketChannel = db
      .channel('market-global')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'market_status',
        filter: 'exchange=eq.LuSE',
      }, (payload) => {
        queryClient!.setQueryData(queryKeys.marketStatus, payload.new);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'platform_settings',
      }, (payload) => {
        if (payload.new?.key === 'platform_enabled' && payload.new?.value === 'false') {
          window.location.href = '/maintenance';
        }
      })
      .subscribe();

    return () => {
      db.removeChannel(userChannel);
      db.removeChannel(marketChannel);
    };
  }, [user, queryClient, handleSignOut, tryCsdRegister]);

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
      } catch {
        // Unparseable date — keep the default wording.
      }
    }

    return (
      <AuthContext.Provider value={{ user, profile, role, isLoading, signOut: handleSignOut, refreshProfile }}>
        <div className="fixed inset-0 z-9999 bg-background flex items-center justify-center p-6">
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
