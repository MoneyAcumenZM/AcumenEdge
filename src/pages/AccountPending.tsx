import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Mail, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import luseLogo from '@/assets/luse-logo.webp';

const POLL_MS = 30 * 1000;


const AccountPending = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading, refreshProfile, signOut } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date>(new Date());

  const status = profile?.kyc_status;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshProfile?.();
      setLastChecked(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile]);

  // Auto-poll while pending
  useEffect(() => {
    if (!user || status === 'approved' || status === 'rejected') return;
    const id = setInterval(handleRefresh, POLL_MS);
    return () => clearInterval(id);
  }, [user, status, handleRefresh]);

  // Middleware auth-status poll disabled — this build runs standalone.
  // KYC approval is picked up via the Supabase realtime subscription below.


  // Route by latest status
  useEffect(() => {
    if (isLoading || !user) return;
    const acct = profile?.account_status;
    if (status === 'approved' && (!acct || acct === 'active')) {
      navigate('/', { replace: true });
    } else if (status === 'rejected') {
      navigate('/account-rejected', { replace: true });
    }
  }, [status, user, profile?.account_status, isLoading, navigate]);

  // Realtime subscription on profiles row
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`user-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        (payload: any) => {
          const next = payload?.new;
          if (!next) return;
          if (next.kyc_status === 'approved' && next.account_status === 'active') {
            navigate('/', { replace: true });
          } else if (next.kyc_status === 'rejected') {
            navigate('/account-rejected', { replace: true });
          }
          refreshProfile?.();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, navigate, refreshProfile]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background animate-fade-in">
      <div className="w-full max-w-sm space-y-7 text-center">
        <img
          src={luseLogo}
          alt="LuSE"
          width={80}
          height={80}
          loading="eager"
          fetchPriority="high"
          className="w-20 h-20 mx-auto rounded-xl"
          style={{ filter: 'drop-shadow(0 0 12px rgba(6, 182, 212, 0.35))' }}
        />

        <div className="flex justify-center">
          <Clock className="w-14 h-14 text-amber-400 animate-pulse" />
        </div>

        <h1 className="text-2xl font-bold text-foreground uppercase tracking-wide">
          Account Under Review
        </h1>

        <div className="mx-auto w-16 h-0.5 bg-amber-400 rounded-full" />

        <p className="text-sm text-muted-foreground leading-relaxed">
          Your registration has been received and is being verified by the Money Acumen Advisory compliance team.
        </p>

        <p className="text-xs text-muted-foreground leading-relaxed">
          You will be notified once your account is approved. This typically takes 1–2 business days.
        </p>

        <div className="space-y-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40 hover:bg-secondary/60 text-sm font-medium text-foreground px-4 py-3 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Checking status…' : 'Check status now'}
          </button>
          <p className="text-[10px] text-muted-foreground">
            Last checked {lastChecked.toLocaleTimeString()}
          </p>
        </div>

        <div className="bg-secondary/50 border border-border rounded-xl px-4 py-3 flex items-center justify-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Questions? Contact us at{' '}
            <a href="mailto:trading@moneyacumenadvisory.com" className="text-primary font-medium">
              trading@moneyacumenadvisory.com
            </a>
          </p>
        </div>

        <button
          onClick={handleSignOut}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </div>
  );
};

export default AccountPending;
