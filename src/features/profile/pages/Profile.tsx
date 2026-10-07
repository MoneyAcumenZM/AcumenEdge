import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { User, MapPin, Phone, Mail, Bell, Shield, Building2, Hash, MapPinned, Lock, KeyRound, CheckCircle2, Clock, AlertTriangle, Eye, EyeOff, LogOut, Copy, Check } from "lucide-react";
import { isPINEnabled, getPINSetAt, clearPIN } from "@/features/auth/services/pinService";
import { useAuth } from "@/contexts/AuthContext";
import { useMiddleware } from "@/contexts/MiddlewareContext";
import { db } from "@/integrations/data/client";
import { logAudit } from "@/lib/audit";
import { useNotificationPreferences, queryKeys } from "@/hooks/useDataQuery";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { middlewareClient } from "@/services/middlewareClient";
import { asRecord, asString } from "@/lib/apiShape";
import { isCsdRegistered } from "@/lib/tradingUtils";
import PINSetupFlow from "@/features/auth/components/PINSetupFlow";
import { toast } from "sonner";
import { useBiometricAuth } from "@/features/auth/hooks/useBiometricAuth";
import { Fingerprint } from "lucide-react";


const Profile = () => {
  const { user, profile, signOut } = useAuth();
  const { csdConnected } = useMiddleware();
  const biometric = useBiometricAuth(user?.id);

  const { data: csdStatusData } = useQuery({
    queryKey: ['csd-status'],
    queryFn: () => middlewareClient.csdStatus(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const csdLastAttempt = asString(asRecord(csdStatusData?.csd).lastAttempt) || null;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: notifPrefs } = useNotificationPreferences();
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinSetAt, setPinSetAt] = useState<string | null>(null);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [showBPID, setShowBPID] = useState(false);
  const [copiedBPID, setCopiedBPID] = useState(false);

  const [tradeExecuted, setTradeExecuted] = useState(true);
  const [depositWithdrawal, setDepositWithdrawal] = useState(true);
  const [weeklySummary, setWeeklySummary] = useState(true);
  const [marketAlerts, setMarketAlerts] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState(false);

  useEffect(() => {
    if (notifPrefs) {
      setTradeExecuted(notifPrefs.trade_executed);
      setDepositWithdrawal(notifPrefs.deposit_withdrawal);
      setWeeklySummary(notifPrefs.weekly_summary);
      setMarketAlerts(notifPrefs.market_alerts);
      setPriceAlerts(notifPrefs.price_alerts);
    }
  }, [notifPrefs]);

  useEffect(() => {
    if (user) {
      setPinEnabled(isPINEnabled(user.id));
      setPinSetAt(getPINSetAt(user.id));
    }
  }, [user]);

  useEffect(() => {
    if (user) logAudit('PROFILE_VIEWED');
  }, [user]);

  useEffect(() => {
    if (showBPID) {
      const timer = setTimeout(() => setShowBPID(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [showBPID]);

  // Callers set local state optimistically before this resolves; on failure
  // it reverts the change and tells the user the setting wasn't saved.
  const saveNotifPref = useCallback(async (field: string, value: boolean, revert: (v: boolean) => void) => {
    if (!user) return;
    const update = { [field]: value, updated_at: new Date().toISOString() };
    const { error } = await db.from('notification_preferences')
      .upsert({ user_id: user.id, ...update }, { onConflict: 'user_id' });
    if (!error) {
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences(user.id) });
    } else {
      revert(!value);
      toast.error("Couldn't save that setting. Please try again.");
    }
  }, [user, queryClient]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/signin');
  };

  const handleCopyBPID = async () => {
    if (!csdBPID) return;
    try {
      await navigator.clipboard.writeText(csdBPID);
      setCopiedBPID(true);
      toast.success('BPID copied to clipboard');
      setTimeout(() => setCopiedBPID(false), 2000);
    } catch {
      toast.error('Could not copy. Please copy manually.');
    }
  };

  const email = user?.email || '';
  const fullName = profile?.full_name || '';
  const phone = profile?.phone || '';
  const address = profile?.physical_address || '';
  const province = profile?.province || '';
  const tpin = profile?.tpin || '';
  const nrc = profile?.nrc_passport || '';
  const bankName = profile?.bank_name || '';
  const bankAccount = profile?.bank_account_number || '';

  const csdRegistered = isCsdRegistered(profile);
  const csdRejected = !csdRegistered && profile?.csd_registration_status === 'rejected';
  const csdBPID = profile?.csd_bpid || '';
  const csdDate = profile?.csd_registered_at;
  const kycStatus = profile?.kyc_status || 'pending';

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <User className="w-6 h-6 text-white" />
          <h1 className="text-2xl font-bold text-foreground">My Profile</h1>
        </div>
        <p className="text-sm text-muted-foreground">View your account details</p>
      </div>

      {/* ── KYC Status Card ── */}
      <div className="hairline-top pt-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Identity Verification</h3>
        </div>
        {kycStatus === 'pending' && (
          <div className="flex items-start gap-2 bg-warning/10 rounded-lg px-3 py-2.5">
            <Clock className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">Your documents are being reviewed. This usually takes 1 to 2 business days.</p>
          </div>
        )}
        {((kycStatus as string) === 'under_review' || (kycStatus as string) === 'pending_review') && (
          <div className="flex items-start gap-2 bg-[#3b82f6]/10 rounded-lg px-3 py-2.5">
            <Clock className="w-4 h-4 text-[#3b82f6] shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">Your documents are under review. We will notify you once complete.</p>
          </div>
        )}
        {kycStatus === 'approved' && (
          <div className="flex items-start gap-2 bg-success/10 rounded-lg px-3 py-2.5">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
            <p className="text-xs text-success font-medium">Your identity has been verified successfully.</p>
          </div>
        )}
        {kycStatus === 'rejected' && (
          <div className="flex items-start gap-2 bg-destructive/10 rounded-lg px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-destructive font-medium">Your KYC was not approved.</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Reason: {profile?.kyc_rejection_reason || 'Not specified'}. Please contact{' '}
                <a href="mailto:trading@moneyacumenadvisory.com" className="text-primary">support</a>.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── CSD Registration Card ── */}
      <div className="hairline-top pt-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">CSD Account</h3>
          </div>
          <span
            className="flex items-center gap-1.5 text-[10px] font-medium"
            title={csdConnected ? 'CSD service connected' : 'CSD service offline'}
          >
            <span className={`w-2 h-2 rounded-full ${csdConnected ? 'bg-success animate-pulse' : 'bg-warning'}`} />
            <span className={csdConnected ? 'text-success' : 'text-warning'}>
              {csdConnected ? 'CSD Connected' : 'CSD Offline'}
            </span>
          </span>
        </div>
        {csdLastAttempt && (
          <p className="text-[10px] text-muted-foreground -mt-1 mb-2">
            Last checked: {new Date(csdLastAttempt).toLocaleTimeString('en-ZM', { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        {csdRejected && (
          <div className="flex items-start gap-2 bg-destructive/10 rounded-lg px-3 py-2.5">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Your CSD account could not be opened. Please contact{' '}
              <span className="text-primary">trading@moneyacumenadvisory.com</span>.
            </p>
          </div>
        )}
        {!csdRegistered && !csdRejected && kycStatus !== 'approved' && (
          <div className="flex items-start gap-2 bg-secondary/50 rounded-lg px-3 py-2.5">
            <Clock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">Your CSD account will be created once your identity is verified.</p>
          </div>
        )}
        {!csdRegistered && !csdRejected && kycStatus === 'approved' && (
          <div className="flex items-start gap-2 bg-[#3b82f6]/10 rounded-lg px-3 py-2.5">
            <div className="w-4 h-4 shrink-0 mt-0.5 rounded-full bg-[#3b82f6] animate-pulse" />
            <p className="text-xs text-muted-foreground">
              Your identity is verified. Our team is registering your CSD account. You will be notified once complete.
            </p>
          </div>
        )}
        {csdRegistered && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 bg-success/10 rounded-lg px-3 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-success shrink-0 mt-0.5" />
              <p className="text-xs text-success font-medium">CSD Account Active</p>
            </div>
            {/* BPID display */}
            <div>
              <p className="text-xs text-muted-foreground mb-1.5">Your CSD Number:</p>
              <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-4 py-3">
                <button
                  onClick={() => {
                    setShowBPID(!showBPID);
                    if (!showBPID && user) logAudit('BPID_REVEALED');
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {showBPID ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <span className="text-sm font-mono font-bold text-foreground flex-1">
                  {!csdBPID ? 'Being issued' : showBPID ? csdBPID : `CSD-XXXXX-${csdBPID.slice(-4)}`}
                </span>
                <button onClick={handleCopyBPID} className="text-muted-foreground hover:text-primary transition-colors">
                  {copiedBPID ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {csdDate && <ReadOnlyField label="Registration Date" value={new Date(csdDate).toLocaleDateString('en-ZM', { day: 'numeric', month: 'long', year: 'numeric' })} />}
          </div>
        )}
      </div>

      {/* Edit notice */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-start gap-2">
        <Lock className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-xs text-foreground font-medium">Profile fields are locked for your protection</p>
          <p className="text-xs text-muted-foreground mt-0.5">To update details, email <a href="mailto:trading@moneyacumenadvisory.com" className="text-primary hover:underline">trading@moneyacumenadvisory.com</a></p>
        </div>
      </div>

      {/* PIN Security */}
      <div className="hairline-top pt-5">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">App PIN</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Locks the app after 2 minutes of inactivity</p>
        {showPinSetup ? (
          <PINSetupFlow
            userId={user!.id}
            isModal
            onComplete={() => { setShowPinSetup(false); setPinEnabled(true); setPinSetAt(new Date().toISOString()); }}
            onSkip={() => setShowPinSetup(false)}
          />
        ) : pinEnabled ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">PIN Status</p>
                <p className="text-xs text-muted-foreground">{pinSetAt ? `Set on ${new Date(pinSetAt).toLocaleDateString()}` : 'Active'}</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 font-medium">Set</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowPinSetup(true)} className="flex-1 py-2.5 bg-secondary text-foreground rounded-xl text-xs font-medium hover:bg-secondary/80 transition-colors">Change PIN</button>
              <button onClick={() => { if (user) { clearPIN(user.id); setPinEnabled(false); setPinSetAt(null); logAudit('PIN_REMOVED'); } }} className="flex-1 py-2.5 bg-destructive/10 text-destructive rounded-xl text-xs font-medium hover:bg-destructive/20 transition-colors">Remove PIN</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowPinSetup(true)} className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">Set Up PIN</button>
        )}
      </div>

      {/* Biometric Login */}
      {biometric.isAvailable && (
        <div className="hairline-top pt-5">
          <div className="flex items-center gap-2 mb-1">
            <Fingerprint className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Security</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">Use Face ID or fingerprint to sign in</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Biometric Login</p>
              <p className="text-xs text-muted-foreground">{biometric.isEnabled ? 'Enabled' : 'Disabled'}</p>
            </div>
            <button
              onClick={async () => {
                try {
                  if (biometric.isEnabled) {
                    await biometric.disable();
                    toast.success('Biometric login disabled');
                  } else {
                    const { data: { session } } = await db.auth.getSession();
                    if (!session?.refresh_token) { toast.error('Session expired. Sign in again.'); return; }
                    await biometric.enable(session.refresh_token);
                    toast.success('Biometric login enabled');
                  }
                } catch {
                  toast.error('Could not update biometric setting');
                }
              }}
              role="switch"
              aria-checked={biometric.isEnabled}
              className={`relative w-11 h-6 rounded-full transition-colors ${biometric.isEnabled ? 'bg-primary' : 'bg-secondary'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-background transition-transform ${biometric.isEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      )}


      {/* Notifications */}


      <div className="hairline-top pt-5">
        <div className="flex items-center gap-2 mb-1">
          <Bell className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Notifications</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">Choose which notifications you receive</p>
        <div className="space-y-4">
          <ToggleRow label="Trade Executed Alerts" desc="Always on — cannot be disabled" checked={tradeExecuted} onChange={() => {}} disabled />
          <ToggleRow label="Deposit & Withdrawal Confirmations" desc="Notify on deposits and withdrawals" checked={depositWithdrawal} onChange={(v) => { setDepositWithdrawal(v); saveNotifPref('deposit_withdrawal', v, setDepositWithdrawal); }} />
          <ToggleRow label="Weekly Portfolio Summary" desc="Performance summary every week" checked={weeklySummary} onChange={(v) => { setWeeklySummary(v); saveNotifPref('weekly_summary', v, setWeeklySummary); }} />
          <ToggleRow label="Market Open & Close Alerts" desc="Get notified when trading sessions start/end" checked={marketAlerts} onChange={(v) => { setMarketAlerts(v); saveNotifPref('market_alerts', v, setMarketAlerts); }} />
          <ToggleRow label="Price Alerts for Watched Stocks" desc="Notify when watchlisted stocks hit targets" checked={priceAlerts} onChange={(v) => { setPriceAlerts(v); saveNotifPref('price_alerts', v, setPriceAlerts); }} />
        </div>
      </div>

      {/* Personal Details */}
      <div className="hairline-top pt-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Personal Details</h3>
        </div>
        <ReadOnlyField label="Full Name" value={fullName} />
        <ReadOnlyField label="NRC Number" value={nrc} sensitive onReveal={() => user && logAudit('PII_REVEALED', 'profiles', user.id, { field: 'nrc_passport' })} />
        <ReadOnlyField label="Date of Birth" value={formatDate(profile?.date_of_birth)} />
        <ReadOnlyField label="Address" value={address} icon={<MapPin className="w-3.5 h-3.5 text-muted-foreground" />} />
        <ReadOnlyField label="Province" value={province} icon={<MapPinned className="w-3.5 h-3.5 text-muted-foreground" />} />
      </div>

      {/* TPIN */}
      <div className="hairline-top pt-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Hash className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">TPIN</h3>
        </div>
        <ReadOnlyField label="Tax Payer Identification Number" value={tpin} />
      </div>

      {/* Contact Details */}
      <div className="hairline-top pt-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Phone className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Contact Details</h3>
        </div>
        <ReadOnlyField label="Phone Number" value={phone} icon={<Phone className="w-3.5 h-3.5 text-muted-foreground" />} />
        <ReadOnlyField label="Email" value={email} icon={<Mail className="w-3.5 h-3.5 text-muted-foreground" />} />
      </div>

      {/* Banking Details */}
      <div className="hairline-top pt-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Banking Details</h3>
        </div>
        <ReadOnlyField label="Bank Name" value={bankName} icon={<Building2 className="w-3.5 h-3.5 text-muted-foreground" />} />
        <ReadOnlyField label="Account Number" value={bankAccount} icon={<Hash className="w-3.5 h-3.5 text-muted-foreground" />} mono sensitive onReveal={() => user && logAudit('PII_REVEALED', 'profiles', user.id, { field: 'bank_account_number' })} />
      </div>

      {/* Sign Out */}
      <button
        onClick={handleSignOut}
        className="w-full py-3.5 bg-destructive/10 text-destructive rounded-xl text-sm font-semibold hover:bg-destructive/20 transition-colors flex items-center justify-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </div>
  );
};

// "17 May 1990" from "1990-05-17"; the raw value if it isn't a date.
// A bare YYYY-MM-DD is read as that calendar day, not as midnight UTC (which
// would show the previous day in time zones behind UTC).
const formatDate = (value: string | null | undefined): string => {
  if (!value) return '';
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = ymd ? new Date(+ymd[1], +ymd[2] - 1, +ymd[3]) : new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-ZM', { day: 'numeric', month: 'long', year: 'numeric' });
};

// `sensitive` fields are masked until revealed, and each reveal is audited
// (same treatment as the CSD BPID above).
const ReadOnlyField = ({ label, value, icon, mono, sensitive, onReveal }: { label: string; value: string; icon?: React.ReactNode; mono?: boolean; sensitive?: boolean; onReveal?: () => void }) => {
  const [revealed, setRevealed] = useState(false);
  const masked = sensitive && value && !revealed
    ? value.length > 4 ? `${'•'.repeat(Math.max(0, value.length - 4))}${value.slice(-4)}` : '•'.repeat(value.length)
    : value;
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <label className="text-sm font-medium text-foreground">{label}</label>
      </div>
      <div className={`w-full bg-secondary/50 rounded-xl px-4 py-3 text-sm text-foreground/80 flex items-center justify-between gap-2 ${mono ? 'font-mono' : ''}`}>
        <span>{masked || '—'}</span>
        {sensitive && value && (
          <button
            type="button"
            onClick={() => { const next = !revealed; setRevealed(next); if (next) onReveal?.(); }}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label={revealed ? 'Hide' : 'Reveal'}
          >
            {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
};

const ToggleRow = ({ label, desc, checked, onChange, disabled }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
    <button
      onClick={() => !disabled && onChange(!checked)}
      className={`w-12 h-6 rounded-full transition-colors relative ${checked ? 'bg-primary' : 'bg-secondary'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      disabled={disabled}
    >
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${checked ? 'left-6' : 'left-0.5'}`} />
    </button>
  </div>
);

export default Profile;
