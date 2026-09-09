/**
 * DATA CLIENT — backend-ready switch.
 *
 * The whole app imports `supabase` from this file and nothing else.
 *
 *  - If VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set to a reachable
 *    project, a real Supabase client is created and every query/auth call
 *    goes to that backend.
 *  - If they are missing (or point nowhere), we fall back to the local
 *    localStorage-backed stub so the frontend keeps running offline with no
 *    network calls.
 *
 * To connect a backend: set the two env vars in `.env` and restart. No
 * component or hook changes are required.
 */

import { createClient } from '@supabase/supabase-js';
import { localClient } from './localClient';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const isBackendConfigured = Boolean(url && anonKey && /^https?:\/\//.test(url));

export const supabase: any = isBackendConfigured
  ? createClient(url!, anonKey!, {
      auth: {
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : localClient;

export default supabase;
