import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { XCircle, Mail, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import luseLogo from '@/assets/luse-logo.webp';

const AccountRejected = () => {
  const navigate = useNavigate();
  const { user, profile, isLoading, signOut } = useAuth();
  const reason =
    (profile as any)?.kyc_rejection_reason ||
    (profile as any)?.kyc_notes ||
    sessionStorage.getItem('kyc_rejection_reason') ||
    '';

  useEffect(() => {
    if (!isLoading && user && profile?.kyc_status === 'approved') {
      navigate('/', { replace: true });
    }
  }, [user, profile, isLoading, navigate]);

  useEffect(() => {
    return () => {
      sessionStorage.removeItem('kyc_rejection_reason');
    };
  }, []);

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
          <XCircle className="w-14 h-14 text-destructive" />
        </div>

        <h1 className="text-2xl font-bold text-foreground uppercase tracking-wide">
          Application Not Approved
        </h1>

        <div className="mx-auto w-16 h-0.5 bg-amber-400 rounded-full" />

        <p className="text-sm text-muted-foreground leading-relaxed">
          Unfortunately your account application was not successful at this time.
        </p>

        {reason && (
          <div className="border border-destructive/30 bg-destructive/5 rounded-xl px-4 py-3 text-left">
            <p className="text-xs text-foreground">
              <span className="font-bold text-destructive">REASON:</span> {reason}
            </p>
          </div>
        )}

        <a
          href="mailto:trading@moneyacumenadvisory.com?subject=KYC%20Appeal"
          className="block w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold px-4 py-3 hover:opacity-90 transition-opacity"
        >
          Appeal this decision
        </a>

        <div className="bg-secondary/50 border border-border rounded-xl px-4 py-3 flex items-center justify-center gap-2">
          <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            For more information, contact{' '}
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

export default AccountRejected;
