-- ═══════════════════════════════════════════════════════════════════════════
-- Security hardening migration — run this in the Supabase SQL editor
-- (the project is connected to an external Supabase project, so migrations
--  are applied manually rather than through the Lovable migration tool).
--
--  TASK 1  profiles privilege escalation
--  TASK 2b order_executions idempotency ledger
--  TASK 3a wallets (integer minor units)
--  TASK 5a role helper
--  TASK 5d audit_logs insert restricted to service_role
--  TASK 6d server-authoritative platform flags
--
-- Nothing here weakens an existing policy or trigger.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────────────
-- TASK 5a: canonical role lookup (SECURITY DEFINER, no RLS recursion)
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- TASK 1: profiles — replace the FOR ALL policy with explicit per-command
-- policies, and block privileged column writes from non-service callers.
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own profile" ON public.profiles;

-- Signup still needs to create its own row (previously allowed implicitly).
DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Service role manages profiles" ON public.profiles;
CREATE POLICY "Service role manages profiles" ON public.profiles
  FOR ALL USING (auth.role() = 'service_role');

GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Column-level protection: Postgres RLS cannot restrict columns, so a
-- trigger enforces it. Personal fields (full_name, phone, address, next of
-- kin, payout bank details) remain freely editable by the owner.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (edge functions / back office) may write anything.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Force privileged columns to safe defaults on self-signup.
    NEW.kyc_status           := 'pending';
    NEW.kyc_rejection_reason := NULL;
    NEW.csd_registered       := FALSE;
    NEW.csd_registered_at    := NULL;
    NEW.sor_account          := NULL;
    NEW.broker_bpid          := 'LB01/B';
    NEW.member_bank_sca      := 'LB01/C';
    NEW.platform_code        := 'CIRC';
    RETURN NEW;
  END IF;

  IF NEW.kyc_status              IS DISTINCT FROM OLD.kyc_status
     OR NEW.kyc_rejection_reason IS DISTINCT FROM OLD.kyc_rejection_reason
     OR NEW.csd_registered       IS DISTINCT FROM OLD.csd_registered
     OR NEW.csd_registered_at    IS DISTINCT FROM OLD.csd_registered_at
     OR NEW.sor_account          IS DISTINCT FROM OLD.sor_account
     OR NEW.broker_bpid          IS DISTINCT FROM OLD.broker_bpid
     OR NEW.member_bank_sca      IS DISTINCT FROM OLD.member_bank_sca
     OR NEW.platform_code        IS DISTINCT FROM OLD.platform_code
  THEN
    RAISE EXCEPTION 'Privileged profile fields (KYC / CSD / settlement accounts) can only be changed by the platform';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profiles_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profiles_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- ───────────────────────────────────────────────────────────────────────────
-- TASK 2b: execution idempotency ledger. The FIX bridge delivers
-- at-least-once, so every execution report is recorded here FIRST and a
-- unique violation short-circuits the holdings update.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.order_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_order_id text NOT NULL,
  execution_id text NOT NULL,
  filled_qty integer NOT NULL,
  filled_price numeric(18,4),
  applied_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT order_executions_identity_unique UNIQUE (client_order_id, execution_id)
);

ALTER TABLE public.order_executions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role manages order_executions" ON public.order_executions;
CREATE POLICY "Service role manages order_executions" ON public.order_executions
  FOR ALL USING (auth.role() = 'service_role');
GRANT ALL ON public.order_executions TO service_role;

-- ───────────────────────────────────────────────────────────────────────────
-- TASK 3a: cash balances in INTEGER minor units (ngwee). No floats.
-- ───────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wallets (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,   -- minor units (ngwee)
  held integer NOT NULL DEFAULT 0,      -- minor units reserved for open orders
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own wallet" ON public.wallets;
CREATE POLICY "Users read own wallet" ON public.wallets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role manages wallets" ON public.wallets;
CREATE POLICY "Service role manages wallets" ON public.wallets
  FOR ALL USING (auth.role() = 'service_role');

GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;

DROP TRIGGER IF EXISTS update_wallets_updated_at ON public.wallets;
CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ───────────────────────────────────────────────────────────────────────────
-- TASK 5d: the audit trail must not be forgeable by the audited user.
-- ───────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users insert own logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Service role inserts logs" ON public.audit_logs;
CREATE POLICY "Service role inserts logs" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ───────────────────────────────────────────────────────────────────────────
-- TASK 6d: trading mode flags become server-authoritative.
-- ───────────────────────────────────────────────────────────────────────────
INSERT INTO public.platform_settings (key, value) VALUES
  ('market_always_open', 'false'),
  ('paper_trading_mode', 'false')
ON CONFLICT (key) DO NOTHING;
