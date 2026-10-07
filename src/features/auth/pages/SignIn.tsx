import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LogIn, Loader2, Fingerprint, ScanFace } from "lucide-react";
import circleLogo from "@/assets/circle-logo-new.svg";
import { db, isBackendConfigured } from "@/integrations/data/client";
import { checkRateLimit, clearRateLimit, formatLockoutTime, RateLimits } from "@/lib/rateLimiter";
import { signInSchema } from "@/lib/schemas";
import { IS_PRODUCTION_BUILD } from "@/lib/config";
import { logAudit } from "@/lib/audit";
import {
  isMedianApp,
  getBiometricStatus,
  getBiometricSecret,
  getBiometricUserId,
  disableBiometricLogin,
  type BiometricStatus,
} from "@/features/auth/services/biometricService";

const SignIn = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);
  // Set only inside the Median app, with biometrics available and a session
  // stored by Profile → Biometric Login; otherwise the button never shows.
  const [biometric, setBiometric] = useState<BiometricStatus | null>(null);

  // Validate next as a same-origin relative path to avoid open redirects.
  const safeNext = (() => {
    if (!next) return "/";
    if (next.startsWith("/") && !next.startsWith("//")) return next;
    return "/";
  })();

  useEffect(() => {
    db.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) navigate(safeNext, { replace: true });
    });
  }, [navigate, safeNext]);

  useEffect(() => {
    if (!isMedianApp() || !getBiometricUserId()) return;
    let cancelled = false;
    getBiometricStatus().then((status) => {
      if (!cancelled && status.available && status.hasSecret) setBiometric(status);
    });
    return () => { cancelled = true; };
  }, []);

  const handleBiometricLogin = async () => {
    if (!biometric) return;
    setErrors({});
    setGeneralError("");
    setLoading(true);

    let refreshToken: string | null;
    try {
      refreshToken = await getBiometricSecret(biometric.biometryType);
    } catch {
      setGeneralError(`${biometric.displayName} didn't match. Try again or sign in with your password.`);
      setLoading(false);
      return;
    }
    if (!refreshToken) {
      // Prompt cancelled.
      setLoading(false);
      return;
    }

    // Exchanging the stored refresh token for a new session signs the user
    // in; AuthContext then stores the rotated token for next time.
    const { data, error } = await db.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) {
      await disableBiometricLogin();
      setBiometric(null);
      setGeneralError(`${biometric.displayName} sign-in has expired. Sign in with your password, then turn it back on in Profile.`);
      setLoading(false);
      return;
    }

    await logAudit("SIGN_IN_BIOMETRIC");
    navigate(safeNext, { replace: true });
  };

  const handlePasswordLogin = async () => {
    setErrors({});
    setGeneralError("");

    const cleanEmail = email.trim().toLowerCase();

    // signInSchema existed but was never actually called from anywhere, so
    // an obviously malformed email reached signInWithPassword unchecked.
    const validation = signInSchema.safeParse({ email: cleanEmail, password });
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.errors.forEach((e) => { if (e.path[0]) fieldErrors[String(e.path[0])] = e.message; });
      setErrors(fieldErrors);
      return;
    }

    // Client-side speed bump only (see lib/rateLimiter.ts); real brute-force
    // protection must be enforced server-side.
    const limit = checkRateLimit(`login:${cleanEmail}`, RateLimits.login);
    if (!limit.allowed) {
      setGeneralError(`Too many attempts. Try again in ${formatLockoutTime(limit.remainingMs || 0)}.`);
      return;
    }

    setLoading(true);

    const { error } = await db.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (!error) clearRateLimit(`login:${cleanEmail}`);

    if (error) {
      // Local dev/demo only: no backend configured, so any credentials are
      // accepted by the local client. This must NEVER apply in a real
      // production build — client.ts locks the local client's auth in that
      // case (see IS_PRODUCTION_BUILD), so this branch is a no-op there and
      // the real error below is shown instead.
      if (!isBackendConfigured && !IS_PRODUCTION_BUILD) {
        navigate(safeNext, { replace: true });
        return;
      }
      setGeneralError(error.message);
      setLoading(false);
      return;
    }

    navigate(safeNext, { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background keyboard-aware">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-4">
          <img
            src={circleLogo}
            alt="AcumenEdge"
            width={80}
            height={80}
            loading="eager"
            fetchPriority="high"
            className="w-20 h-20 mx-auto rounded-xl"
            style={{ filter: "drop-shadow(0 0 12px rgba(6, 182, 212, 0.35))" }}
          />
          <p className="text-sm text-muted-foreground">Sign in to continue</p>
        </div>

        <div className="space-y-4">
          {generalError && (
            <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3">
              <p className="text-xs text-destructive">{generalError}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-hidden focus:border-primary"
              placeholder="you@example.com"
            />
            {errors.email && <p className="text-[11px] text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handlePasswordLogin(); }}
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-hidden focus:border-primary"
              placeholder="Enter your password"
            />
            {errors.password && <p className="text-[11px] text-destructive">{errors.password}</p>}
          </div>

          <button
            onClick={handlePasswordLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><LogIn className="w-4 h-4" /> Sign In to Trading</>}
          </button>

          {biometric && (
            <button
              onClick={handleBiometricLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 border border-border bg-card text-foreground rounded-xl text-sm font-semibold hover:border-primary transition-colors disabled:opacity-50"
            >
              {biometric.icon === "scan-face" ? <ScanFace className="w-4 h-4 text-primary" /> : <Fingerprint className="w-4 h-4 text-primary" />}
              Sign in with {biometric.displayName}
            </button>
          )}
        </div>

        <p className="text-[10px] text-center leading-relaxed text-primary">
          Money Acumen is a licensed stockbroker regulated by the Securities and Exchange Commission of Zambia.
        </p>
      </div>
    </div>
  );
};

export default SignIn;
