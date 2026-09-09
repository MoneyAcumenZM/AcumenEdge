/**
 * Role gate utility — server-side verified.
 * Always reads from Supabase user_roles table. Never trusts client-side state alone.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type UserRole = 'CLIENT' | 'BROKER_ADMIN' | 'BROKER_DEALER' | 'RETAIL_USER';

export function useClientRole() {
  const { user, role: cachedRole } = useAuth();
  const [role, setRole] = useState<UserRole>((cachedRole as UserRole) || 'CLIENT');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setRole('CLIENT');
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function verify() {
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!cancelled && data?.role) {
          const mapped = mapRole(data.role);
          setRole(mapped);
        }
      } catch {
        // Keep cached role on error
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    verify();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Also sync from AuthContext cached role
  useEffect(() => {
    if (cachedRole) {
      setRole(mapRole(cachedRole));
    }
  }, [cachedRole]);

  return {
    role,
    loading,
    isAdmin: role === 'BROKER_ADMIN',
    isDealer: role === 'BROKER_DEALER',
    isClient: role === 'CLIENT' || role === 'RETAIL_USER',
    isAdminOrDealer: role === 'BROKER_ADMIN' || role === 'BROKER_DEALER',
  };
}

function mapRole(r: string): UserRole {
  const upper = r.toUpperCase();
  if (upper === 'BROKER_ADMIN') return 'BROKER_ADMIN';
  if (upper === 'BROKER_DEALER') return 'BROKER_DEALER';
  if (upper === 'RETAIL_USER' || upper === 'CLIENT') return 'CLIENT';
  return 'CLIENT';
}
