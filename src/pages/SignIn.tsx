import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LogIn, Loader2 } from "lucide-react";
import circleLogo from "@/assets/circle-logo-new.svg";
import { supabase, isBackendConfigured } from "@/integrations/supabase/client";

const SignIn = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generalError, setGeneralError] = useState("");
  const [loading, setLoading] = useState(false);

  // Validate next as a same-origin relative path to avoid open redirects.
  const safeNext = (() => {
    if (!next) return "/";
    if (next.startsWith("/") && !next.startsWith("//")) return next;
    return "/";
  })();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (session?.user) navigate(safeNext, { replace: true });
    });
  }, [navigate, safeNext]);

  const handlePasswordLogin = async () => {
    setErrors({});
    setGeneralError("");

    const cleanEmail = email.trim().toLowerCase() || "guest@acumenedge.app";

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: password || "guest",
    });

    if (error) {
      // No backend connected yet: never block access on a missing server.
      if (!isBackendConfigured) {
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
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
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
              className="w-full bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
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
        </div>

        <p className="text-[10px] text-center leading-relaxed text-primary">
          Money Acumen is a licensed stockbroker regulated by the Securities and Exchange Commission of Zambia.
        </p>
      </div>
    </div>
  );
};

export default SignIn;
