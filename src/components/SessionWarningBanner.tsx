import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Clock } from 'lucide-react';

/**
 * Surfaces a warning banner when the Supabase access token is close to expiring.
 * Lets the user proactively refresh the session without being logged out.
 *
 * Thresholds:
 *   - WARN  : token expires within 5 min  → show banner
 *   - HIDE  : token has > 6 min remaining → hide banner
 */
const WARN_MS = 5 * 60 * 1000;
const HIDE_MS = 6 * 60 * 1000;
const POLL_MS = 30 * 1000;

const SessionWarningBanner = () => {
  const { user, signOut } = useAuth();
  const [msRemaining, setMsRemaining] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const check = useCallback(async () => {
    if (!user) {
      setMsRemaining(null);
      return;
    }
    const { data } = await supabase.auth.getSession();
    const expiresAt = data.session?.expires_at;
    if (!expiresAt) {
      setMsRemaining(null);
      return;
    }
    setMsRemaining(expiresAt * 1000 - Date.now());
  }, [user]);

  useEffect(() => {
    check();
    const id = setInterval(check, POLL_MS);
    return () => clearInterval(id);
  }, [check]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const { error } = await supabase.auth.refreshSession();
      if (error) throw error;
      await check();
    } catch {
      // Refresh failed — sign out so the user re-authenticates cleanly.
      await signOut();
    } finally {
      setRefreshing(false);
    }
  }, [check, signOut]);

  if (msRemaining == null) return null;
  if (msRemaining > HIDE_MS) return null;

  const minutes = Math.max(0, Math.ceil(msRemaining / 60000));
  const expired = msRemaining <= 0;

  return (
    <div className="mb-4 bg-warning/10 border border-warning/20 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <Clock className="w-4 h-4 text-warning shrink-0" />
        <p className="text-xs text-warning font-medium truncate">
          {expired
            ? 'Your session has expired'
            : `Your session expires in ${minutes} min${minutes === 1 ? '' : 's'}`}
        </p>
      </div>
      <button
        onClick={handleRefresh}
        disabled={refreshing}
        className="text-xs font-semibold text-warning underline-offset-2 hover:underline disabled:opacity-60"
      >
        {refreshing ? 'Refreshing…' : 'Stay signed in'}
      </button>
    </div>
  );
};

export default SessionWarningBanner;
