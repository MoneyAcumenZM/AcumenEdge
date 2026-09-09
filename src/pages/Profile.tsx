import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { User, MapPin, Phone, Mail, Bell, Shield, Building2, Hash, MapPinned, Lock, KeyRound, CheckCircle2, Clock, AlertTriangle, Eye, EyeOff, LogOut, Copy, Check } from "lucide-react";
import { isPINEnabled, getPINSetAt, clearPIN } from "@/services/pinService";
import { useAuth } from "@/contexts/AuthContext";
import { useMiddleware } from "@/contexts/MiddlewareContext";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useNotificationPreferences, queryKeys } from "@/hooks/useSupabaseQuery";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { middlewareClient } from "@/services/middlewareClient";
import PINSetupFlow from "@/components/PINSetupFlow";
import { toast } from "sonner";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { Fingerprint } from "lucide-react";


const Profile = () => {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { csdConnected } = useMiddleware();
  const biometric = useBiometricAuth();

  const { data: csdStatusData } = useQuery({
    queryKey: ['csd-status'],
    queryFn: () => middlewareClient.csdStatus(),
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });
  const csdLastAttempt = (csdStatusData as any)?.csd?.lastAttempt ?? null;
  const csdEndpoint = (csdStatusData as any)?.endpoint ?? null;
  const csdEncryptionEnabled = (csdStatusData as any)?.encryptionEnabled === true;
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
    if (user) logAudit(supabase, user.id, 'PROFILE_VIEWED');
  }, [user]);

  useEffect(() => {
    if (showBPID) {
      const timer = setTimeout(() => setShowBPID(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [showBPID]);

  const saveNotifPref = useCallback(async (field: string, value: boolean) => {
    if (!user) return;
    const update = { [field]: value, updated_at: new Date().toISOString() };
    const { error } = await supabase.from('notification_preferences')
      .upsert({ user_id: user.id, ...update }, { onConflict: 'user_id' });
    if (!error) queryClient.invalidateQueries({ queryKey: queryKeys.notificationPreferences(user.id) });
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
  const province = (profile as any)?.province || '';
  const tpin = profile?.tpin || '';
  const nrc = profile?.nrc_passport || '';
  const bankName = (profile as any)?.bank_name || '';
  const bankAccount = (profile as any)?.bank_account_number || '';

  const csdRegistered = profile?.csd_registered === true;
  const csdBPID = (profile as any)?.csd_bpid || '';
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
        {(csdLastAttempt || csdStatusData) && (
          <div className="flex items-center justify-between text-[10px] text-muted-foreground -mt-1 mb-2">
            {csdLastAttempt && (
              <span>Last checked: {new Date(csdLastAttempt).toLocaleTimeString('en-ZM', { hour: '2-digit', minute: '2-digit' })}</span>
            )}
            <span className="ml-auto">Encryption: {csdEncryptionEnabled ? 'enabled' : 'disabled'}</span>
          </div>
        )}
        {!csdRegistered && kycStatus !== 'approved' && (
          <div className="flex items-start gap-2 bg-secondary/50 rounded-lg px-3 py-2.5">
            <Clock className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">Your CSD account will be created once your identity is verified.</p>
          </div>
        )}
        {!csdRegistered && kycStatus === 'approved' && (
          <div className="flex items-start gap-2 bg-[#3b82f6]/10 rounded-lg px-3 py-2.5">
            <div className="w-4 h-4 shrink-0 mt-0.5 rounded-full bg-[#3b82f6] animate-pulse" />
            {/* FIX J: explicit copy when CSD bpid is still missing — replaces the blank field. */}
            <p className="text-xs text-muted-foreground">
              {!csdBPID
                ? "Registration pending. We will notify you when complete."
                : 'Your identity is verified. Our team is registering your CSD account. You will be notified once complete.'}
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
                    if (!showBPID && user) logAudit(supabase, user.id, 'BPID_REVEALED');
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {showBPID ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <span className="text-sm font-mono font-bold text-foreground flex-1">
                  {showBPID ? csdBPID : `CSD-XXXXX-${csdBPID.slice(-4)}`}
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
              <button onClick={() => { if (user) { clearPIN(user.id); setPinEnabled(false); setPinSetAt(null); logAudit(supabase, user.id, 'PROFILE_VIEWED', undefined, undefined, { action: 'pin_removed' }); } }} className="flex-1 py-2.5 bg-destructive/10 text-destructive rounded-xl text-xs font-medium hover:bg-destructive/20 transition-colors">Remove PIN</button>
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
          <p className="text-xs text-muted-foreground mb-4">Use Face ID or fingerprint to unlock the app</p>
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
                    const { data: { session } } = await supabase.auth.getSession();
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
          <ToggleRow label="Deposit & Withdrawal Confirmations" desc="Notify on deposits and withdrawals" checked={depositWithdrawal} onChange={(v) => { setDepositWithdrawal(v); saveNotifPref('deposit_withdrawal', v); }} />
          <ToggleRow label="Weekly Portfolio Summary" desc="Performance summary every week" checked={weeklySummary} onChange={(v) => { setWeeklySummary(v); saveNotifPref('weekly_summary', v); }} />
          <ToggleRow label="Market Open & Close Alerts" desc="Get notified when trading sessions start/end" checked={marketAlerts} onChange={(v) => { setMarketAlerts(v); saveNotifPref('market_alerts', v); }} />
          <ToggleRow label="Price Alerts for Watched Stocks" desc="Notify when watchlisted stocks hit targets" checked={priceAlerts} onChange={(v) => { setPriceAlerts(v); saveNotifPref('price_alerts', v); }} />
        </div>
      </div>

      {/* Personal Details */}
      <div className="hairline-top pt-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <User className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Personal Details</h3>
        </div>
        <ReadOnlyField label="Full Name" value={fullName} />
        <ReadOnlyField label="NRC Number" value={nrc} />
        <ReadOnlyField label="Date of Birth" value={profile?.date_of_birth || ''} />
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
        <ReadOnlyField label="Account Number" value={bankAccount} icon={<Hash className="w-3.5 h-3.5 text-muted-foreground" />} mono />
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

const ReadOnlyField = ({ label, value, icon, mono }: { label: string; value: string; icon?: React.ReactNode; mono?: boolean }) => (
  <div>
    <div className="flex items-center gap-1.5 mb-1.5">
      {icon}
      <label className="text-sm font-medium text-foreground">{label}</label>
    </div>
    <div className={`w-full bg-secondary/50 rounded-xl px-4 py-3 text-sm text-foreground/80 ${mono ? 'font-mono' : ''}`}>
      {value || '—'}
    </div>
  </div>
);

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
      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'left-6' : 'left-0.5'}`} />
    </button>
  </div>
);

export default Profile;
