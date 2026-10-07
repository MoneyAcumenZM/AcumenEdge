/**
 * YOUR OWN BACKEND — the adapter that connects the app to it.
 *
 * Use this when the data backend is anything other than Supabase. The app
 * calls `db` (see ./client.ts) in one fixed style; this adapter receives
 * those calls and turns them into requests to your API. For example,
 * `db.from("orders").select("*").eq("user_id", id)` could become
 * `GET /orders?user_id=<id>`. Only the calls listed in ./client.ts are
 * ever made, so only those need translating.
 *
 * To use it:
 *   1. Set VITE_BACKEND_PROVIDER=custom.
 *   2. Make createCustomClient() below return your adapter. Start from a
 *      copy of ./localClient.ts — a complete adapter that already answers
 *      every call the app makes (it keeps data in the browser) — and swap
 *      its storage for calls to your API.
 *   3. Keep ./schema.ts matching the rows your API returns, then run
 *      `npm run typecheck`.
 *
 * While this returns null, a release build reports no backend and shows
 * "Service unavailable"; it never falls back to the local stand-in.
 *
 * Trading, wallet and audit calls do not go through here: they are plain
 * HTTP calls to VITE_API_BASE_URL (services/middlewareClient.ts and
 * services/dpoService.ts).
 *
 * The type below borrows its shape from the Supabase client library only
 * because that is the call style the app was written in; your adapter does
 * not use Supabase in any way.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/data/schema';

/** The parts of the data client the app actually calls. */
export type DataClient = Pick<
  SupabaseClient<Database>,
  'auth' | 'from' | 'channel' | 'removeChannel' | 'storage'
>;

export function createCustomClient(): DataClient | null {
  return null;
}
