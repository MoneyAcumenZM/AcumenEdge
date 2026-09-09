import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  initiateDeposit,
  initiateMobileDeposit,
  verifyDeposit,
  type MobileNetwork,
} from '@/services/dpoService';
import { ArrowLeft, Loader2, XCircle, ShieldCheck, CreditCard, Smartphone, CheckCircle2, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

interface DepositScreenProps {
  onClose: () => void;
}

const PRESETS = [50, 100, 200, 500, 1000];
const PROVIDERS: { id: MobileNetwork; label: string }[] = [
  { id: 'Airtel', label: 'Airtel Money' },
  { id: 'MTN', label: 'MTN Mobile Money' },
  { id: 'Zamtel', label: 'Zamtel Kwacha' },
];

const MIN_ZMW = 1;
const MAX_ZMW = 500_000;

type Method = 'card' | 'mobile';
type MobileStage = 'idle' | 'waiting' | 'success' | 'failed';

function formatPhone(input: string): string {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('260')) return digits.slice(0, 12);
  if (digits.startsWith('0')) return ('260' + digits.slice(1)).slice(0, 12);
  if (digits.length > 0) return ('260' + digits).slice(0, 12);
  return '';
}

const DepositScreen = ({ onClose }: DepositScreenProps) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Method>('card');
  const [provider, setProvider] = useState<MobileNetwork>('Airtel');
  const [phone, setPhone] = useState<string>(() => formatPhone((profile as any)?.phone || ''));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showRetry, setShowRetry] = useState(false);
  const [stage, setStage] = useState<MobileStage>('idle');
  const [transToken, setTransToken] = useState<string | null>(null);
  const [waitingMessage, setWaitingMessage] = useState('');
  const [pendingExplanation, setPendingExplanation] = useState('');
  const [newBalance, setNewBalance] = useState<number | null>(null);

  const amountNum = parseFloat(amount) || 0;
  const isAmountValid = amountNum >= MIN_ZMW && amountNum <= MAX_ZMW;
  const isPhoneValid = /^260\d{9}$/.test(phone);

  const handleAuthError = (result: { sessionExpired?: boolean; error?: string }) => {
    if (result.sessionExpired) {
      navigate('/signin', { state: { message: 'Session expired — please sign in again.' } });
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (stage !== 'waiting' || !transToken) return;
    const start = Date.now();
    const MAX_MS = 3 * 60 * 1000;
    const id = setInterval(async () => {
      if (Date.now() - start > MAX_MS) {
        clearInterval(id);
        setStage('failed');
        setError('Timed out waiting for payment approval.');
        return;
      }
      const result = await verifyDeposit(transToken);
      if (handleAuthError(result)) { clearInterval(id); return; }
      if (!result.success) {
        // Transient — keep polling until timeout.
        return;
      }
      if (result.status === 'completed') {
        clearInterval(id);
        setNewBalance(result.newBalance ?? null);
        setPendingExplanation('');
        setStage('success');
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
        queryClient.refetchQueries({ queryKey: ['wallet'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
      } else if (result.status === 'pending') {
        if (result.explanation) setPendingExplanation(result.explanation);
      }
    }, 4000);
    return () => clearInterval(id);
     
  }, [stage, transToken, queryClient]);

  const handleCard = async () => {
    if (!user || !isAmountValid) return;
    // Payments middleware is disabled in this build.
    setError('Payments are currently unavailable.');
    return;
    setLoading(true); setError(''); setShowRetry(false);
    const result = await initiateDeposit({ amount: amountNum, currency: 'ZMW' });
    setLoading(false);
    if (handleAuthError(result)) return;
    if (!result.success || !result.payUrl) {
      setError(result.error || 'Could not initiate payment.');
      setShowRetry(!!result.networkError);
      return;
    }
    if (Capacitor.isNativePlatform()) {
      await Browser.open({ url: result.payUrl, windowName: '_self' });
      Browser.addListener('browserFinished', () => {
        queryClient.invalidateQueries({ queryKey: ['wallet'] });
        navigate('/wallet/deposit-complete');
      });
    } else {
      window.location.href = result.payUrl;
    }
  };

  const handleMobile = async () => {
    if (!user || !isAmountValid || !isPhoneValid) return;
    // Payments middleware is disabled in this build.
    setError('Payments are currently unavailable.');
    return;
    setLoading(true); setError(''); setShowRetry(false);
    const result = await initiateMobileDeposit({ amount: amountNum, mobileNumber: phone, provider });
    setLoading(false);
    if (handleAuthError(result)) return;
    if (!result.success || !result.transactionToken) {
      setError(result.error || 'Could not initiate mobile payment.');
      setShowRetry(!!result.networkError);
      return;
    }
    setTransToken(result.transactionToken);
    setWaitingMessage(result.message || `Approve the payment prompt on your ${provider} phone.`);
    setPendingExplanation('');
    setStage('waiting');
  };

  if (stage === 'success') {
    return (
      <div className="space-y-4 text-center py-6">
        <div className="w-14 h-14 mx-auto rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-success" />
        </div>
        <p className="text-foreground font-semibold">Payment Successful</p>
        {newBalance != null && (
          <p className="text-sm text-muted-foreground">
            Your new balance is ZMW {newBalance.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        )}
        <button onClick={onClose} className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold">Done</button>
      </div>
    );
  }

  if (stage === 'waiting') {
    return (
      <div className="space-y-4 text-center py-6">
        <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
        <p className="text-foreground font-semibold">Awaiting Approval</p>
        <p className="text-sm text-muted-foreground">{waitingMessage}</p>
        {pendingExplanation && (
          <p className="text-xs text-muted-foreground italic">{pendingExplanation}</p>
        )}
        <p className="text-xs text-muted-foreground">Waiting up to 3 minutes…</p>
        <button onClick={() => { setStage('idle'); setTransToken(null); setWaitingMessage(''); setPendingExplanation(''); }} className="text-xs text-muted-foreground underline">Cancel</button>
      </div>
    );
  }

  return (
    <div className="space-y-4 keyboard-aware">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={onClose} aria-label="Back"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
        <h3 className="font-semibold text-foreground text-lg">Deposit Funds</h3>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Amount (ZMW)</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">K</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 12))}
            placeholder="0.00"
            min={MIN_ZMW}
            max={MAX_ZMW}
            className="w-full bg-secondary rounded-xl pl-8 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {amount && amountNum < MIN_ZMW && <p className="text-xs text-destructive mt-1">Minimum deposit is K{MIN_ZMW}</p>}
        {amount && amountNum > MAX_ZMW && <p className="text-xs text-destructive mt-1">Maximum deposit is K{MAX_ZMW.toLocaleString()}</p>}
        <div className="flex gap-2 mt-2">
          {PRESETS.map((v) => (
            <button key={v} onClick={() => setAmount(String(v))} className="flex-1 py-2 rounded-lg bg-secondary text-xs text-muted-foreground hover:bg-secondary/80 transition-colors">
              K{v.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Payment method</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMethod('card')}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors ${method === 'card' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
          >
            <CreditCard className="w-4 h-4" /> Card
          </button>
          <button
            onClick={() => setMethod('mobile')}
            className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors ${method === 'mobile' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
          >
            <Smartphone className="w-4 h-4" /> Mobile Money
          </button>
        </div>
      </div>

      {method === 'mobile' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={`py-2 rounded-lg text-xs font-medium transition-colors ${provider === p.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Phone number</label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="260XXXXXXXXX"
              className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {phone && !isPhoneValid && <p className="text-xs text-destructive mt-1">Enter a valid 12-digit number starting with 260</p>}
          </div>
        </div>
      )}

      <div className="bg-secondary/40 border border-border rounded-xl px-4 py-3 flex items-start gap-2">
        <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {method === 'card'
            ? 'You will be redirected to a secure hosted checkout to complete payment by card.'
            : 'You will receive a payment prompt on your phone. Approve it to complete the deposit.'}
        </p>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-start gap-2">
            <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
          {showRetry && (
            <button
              onClick={method === 'card' ? handleCard : handleMobile}
              className="flex items-center gap-1.5 text-xs text-destructive font-semibold underline"
            >
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
          )}
        </div>
      )}

      {method === 'card' ? (
        <button
          onClick={handleCard}
          disabled={!isAmountValid || loading}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isAmountValid ? `Pay by Card — ZMW ${amountNum.toFixed(2)}` : 'Pay by Card'}
        </button>
      ) : (
        <button
          onClick={handleMobile}
          disabled={!isAmountValid || !isPhoneValid || loading}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Send Payment Request
        </button>
      )}
    </div>
  );
};

export default DepositScreen;
