import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountRestrictions } from '@/features/auth/hooks/useAccountRestrictions';
import { useIdempotencyKey } from '@/hooks/useIdempotencyKey';
import { logAudit } from '@/lib/audit';
import { sanitizeText, sanitizePhone, sanitizeAccountNumber } from '@/lib/formSanitizers';
import { useQueryClient } from '@tanstack/react-query';
import { requestWithdrawal, type MobileNetwork } from '@/services/dpoService';
import { useWallet } from '@/hooks/useDataQuery';
import { formatZMW } from '@/lib/tradingUtils';
import { isPINEnabled, verifyPIN, isPINLocked } from '@/features/auth/services/pinService';
import { ArrowLeft, Loader2, XCircle, CheckCircle2, Smartphone, Building2, Wallet as WalletIcon, ShieldCheck } from 'lucide-react';

interface WithdrawScreenProps {
  onClose: () => void;
}

type Step = 'method' | 'mobile' | 'bank' | 'confirm' | 'success';

const WithdrawScreen = ({ onClose }: WithdrawScreenProps) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWithdraw } = useAccountRestrictions();
  const { data: wallet, isLoading: walletPending, isFetched: walletFetched } = useWallet();
  const walletLoading = walletPending && !walletFetched;
  // No confirmed balance means no withdrawal: with `wallet` missing this is
  // 0, so every amount exceeds it and the submit buttons stay disabled.
  const availableBalance = Number(wallet?.balance ?? 0);

  const [step, setStep] = useState<Step>('method');
  const [pendingMethod, setPendingMethod] = useState<'mobile_money' | 'bank' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isSubmitting = useRef(false);
  // One key per withdrawal intent (amount + destination). It survives a
  // timeout or network failure — when nobody knows whether the server acted —
  // so trying again can't create a second withdrawal. It is only replaced
  // once the server has given a definite answer, or the details change.
  const { keyFor, settle } = useIdempotencyKey();

  // Mobile money
  const [amount, setAmount] = useState('');
  const [mobileNumber, setMobileNumber] = useState(profile?.phone || '');
  const [mobileProvider, setMobileProvider] = useState<MobileNetwork>('Airtel');
  const isPhoneValid = /^260\d{9}$/.test(mobileNumber.replace(/\D/g, '').replace(/^0/, '260'));

  // Bank
  const [bankName, setBankName] = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [bankBranch, setBankBranch] = useState('');

  // Step-up PIN re-entry, required before any withdrawal is submitted; a
  // client without a PIN is sent to set one first. pinService's PIN is checked
  // on the device, not by a server, so this is defence in depth rather than
  // server-verified step-up authentication.
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const hasPin = user ? isPINEnabled(user.id) : false;

  // Success
  const [successMessage, setSuccessMessage] = useState('');
  const [newBalance, setNewBalance] = useState<number | null>(null);

  const amountNum = parseFloat(amount) || 0;
  const isAmountValid = amountNum >= 50;
  const exceedsBalance = !walletLoading && amountNum > availableBalance;

  const back = () => {
    setError('');
    setStep('method');
  };

  const handleAuthError = (result: { sessionExpired?: boolean }) => {
    if (result.sessionExpired) {
      navigate('/signin', { state: { message: 'Session expired — please sign in again.' } });
      return true;
    }
    return false;
  };

  const goToConfirm = (method: 'mobile_money' | 'bank') => {
    setError('');
    setPinInput('');
    setPinError('');
    setPendingMethod(method);
    setStep('confirm');
  };

  const submitMobile = async () => {
    if (isSubmitting.current || !isAmountValid || !isPhoneValid || exceedsBalance) return;
    isSubmitting.current = true;
    setLoading(true);
    setError('');
    const result = await requestWithdrawal({
      amount: amountNum,
      method: 'mobile_money',
      mobileNumber,
      mobileProvider,
      idempotencyKey: keyFor(JSON.stringify({ method: 'mobile_money', amount: amountNum, mobileNumber, mobileProvider })),
    });
    setLoading(false);
    isSubmitting.current = false;
    if (!result.networkError) settle();
    if (handleAuthError(result)) return;
    if (!result.success) {
      setError(result.error || 'Withdrawal failed.');
      setStep('mobile');
      return;
    }
    setSuccessMessage(result.message || 'Your withdrawal is being processed within 1–2 business days.');
    setNewBalance(typeof result.newBalance === 'number' ? result.newBalance : null);
    queryClient.invalidateQueries({ queryKey: ['wallet'] });
    queryClient.refetchQueries({ queryKey: ['wallet'] });
    setStep('success');
  };

  const submitBank = async () => {
    if (isSubmitting.current || !isAmountValid || !bankName || !bankAccount || exceedsBalance) return;
    isSubmitting.current = true;
    setLoading(true);
    setError('');
    const result = await requestWithdrawal({
      amount: amountNum,
      method: 'bank',
      bankName,
      bankAccount,
      bankBranch: bankBranch || undefined,
      idempotencyKey: keyFor(JSON.stringify({ method: 'bank', amount: amountNum, bankName, bankAccount, bankBranch })),
    });
    setLoading(false);
    isSubmitting.current = false;
    if (!result.networkError) settle();
    if (handleAuthError(result)) return;
    if (!result.success) {
      setError(result.error || 'Withdrawal failed.');
      setStep('bank');
      return;
    }
    setSuccessMessage(result.message || 'Your withdrawal is being processed within 1–2 business days.');
    setNewBalance(typeof result.newBalance === 'number' ? result.newBalance : null);
    queryClient.invalidateQueries({ queryKey: ['wallet'] });
    queryClient.refetchQueries({ queryKey: ['wallet'] });
    setStep('success');
  };

  const handleConfirm = async () => {
    if (isSubmitting.current || !user || !pendingMethod) return;
    if (!canWithdraw) {
      setError('Withdrawals are not currently available on your account. Contact support for details.');
      return;
    }
    if (!hasPin) return;
    const lock = isPINLocked(user.id);
    if (lock.locked) {
      setPinError(`Too many attempts. Try again in ${Math.ceil(lock.secondsRemaining / 60)} min.`);
      return;
    }
    const ok = await verifyPIN(user.id, pinInput);
    if (!ok) {
      setPinError('Incorrect PIN.');
      return;
    }
    setPinError('');
    logAudit('WITHDRAWAL_REQUESTED', 'withdrawals', undefined, { method: pendingMethod, amount: amountNum });
    if (pendingMethod === 'mobile_money') await submitMobile();
    else await submitBank();
  };

  const BalanceHeader = (
    <div className="bg-secondary/60 border border-border rounded-xl px-4 py-3 flex items-center gap-2">
      <WalletIcon className="w-4 h-4 text-primary" />
      <p className="text-xs text-muted-foreground">
        Available: <span className="text-foreground font-semibold">
          {formatZMW(wallet ? availableBalance : 0)}
        </span>
      </p>
    </div>
  );


  if (step === 'method') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={onClose} aria-label="Back"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
          <h3 className="font-semibold text-foreground text-lg">Withdraw Funds</h3>
        </div>
        <p className="text-xs text-muted-foreground">Choose a withdrawal method</p>
        <button
          onClick={() => setStep('mobile')}
          className="w-full p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-3 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Mobile Money</p>
            <p className="text-xs text-muted-foreground">Airtel, MTN, Zamtel</p>
          </div>
        </button>
        <button
          onClick={() => setStep('bank')}
          className="w-full p-4 rounded-xl bg-secondary hover:bg-secondary/80 transition-colors flex items-center gap-3 text-left"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Bank Transfer</p>
            <p className="text-xs text-muted-foreground">Local bank account</p>
          </div>
        </button>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="space-y-4 text-center py-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-success/10 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-success" />
        </div>
        <p className="text-foreground font-semibold">Withdrawal Requested</p>
        <p className="text-sm text-muted-foreground">{successMessage}</p>
        {newBalance !== null && (
          <p className="text-sm text-foreground">
            New balance: <span className="font-semibold">K{newBalance.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </p>
        )}
        <button onClick={onClose} className="mt-2 px-6 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">Done</button>
      </div>
    );
  }

  const AmountField = (
    <div>
      <label className="text-xs text-muted-foreground block mb-1">Amount (ZMW)</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">K</span>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').slice(0, 12))}
          placeholder="0.00"
          min={50}
          className="w-full bg-secondary rounded-xl pl-8 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
        />
      </div>
      {amount && !isAmountValid && <p className="text-xs text-destructive mt-1">Minimum withdrawal is K50</p>}
    </div>
  );

  if (step === 'mobile') {
    return (
      <div className="space-y-4 keyboard-aware">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={back} aria-label="Back"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
          <h3 className="font-semibold text-foreground text-lg">Mobile Money</h3>
        </div>

        {BalanceHeader}
        {AmountField}
        {exceedsBalance && (
          <p className="text-xs text-destructive">Amount exceeds your available balance.</p>
        )}

        <div>
          <label className="text-xs text-muted-foreground block mb-1">Phone Number</label>
          <input
            type="tel"
            value={mobileNumber}
            onChange={(e) => setMobileNumber(sanitizePhone(e.target.value))}
            placeholder="260XXXXXXXXX"
            className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
          />
          {mobileNumber && !isPhoneValid && <p className="text-xs text-destructive mt-1">Enter a valid 12-digit number starting with 260</p>}
        </div>

        <div>
          <label className="text-xs text-muted-foreground block mb-2">Provider</label>
          <div className="grid grid-cols-3 gap-2">
            {(['Airtel', 'MTN', 'Zamtel'] as MobileNetwork[]).map((p) => (
              <button
                key={p}
                onClick={() => setMobileProvider(p)}
                className={`py-2 rounded-lg text-xs font-medium transition-colors ${mobileProvider === p ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'}`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 flex items-start gap-2">
            <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        <button
          onClick={() => goToConfirm('mobile_money')}
          disabled={!isAmountValid || !isPhoneValid || loading || exceedsBalance || walletLoading}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
        >
          Continue
        </button>
      </div>
    );
  }

  if (step === 'confirm') {
    const destination = pendingMethod === 'mobile_money'
      ? `${mobileProvider} ${mobileNumber}`
      : `${bankName} — ${bankAccount}`;
    return (
      <div className="space-y-4 keyboard-aware">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => setStep(pendingMethod === 'mobile_money' ? 'mobile' : 'bank')} aria-label="Back"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
          <h3 className="font-semibold text-foreground text-lg">Confirm Withdrawal</h3>
        </div>

        <div className="bg-secondary/60 border border-border rounded-xl px-4 py-3 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Amount</span><span className="font-semibold text-foreground">{formatZMW(amountNum)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">To</span><span className="font-semibold text-foreground text-right">{destination}</span></div>
        </div>

        {hasPin ? (
          <div>
            <label className="text-xs text-muted-foreground block mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Enter your PIN to authorize this withdrawal
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={pinInput}
              onChange={(e) => { setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4)); setPinError(''); }}
              placeholder="••••"
              autoFocus
              className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground tracking-[0.5em] text-center placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
            {pinError && <p className="text-xs text-destructive mt-1">{pinError}</p>}
          </div>
        ) : (
          <div className="bg-warning/10 border border-warning/20 rounded-xl px-4 py-3 space-y-2">
            <p className="text-xs text-warning">
              Withdrawals need a security PIN. Set one up in Profile, then come back to withdraw.
            </p>
            <button
              onClick={() => { onClose(); navigate('/profile'); }}
              className="text-xs font-semibold text-primary underline"
            >
              Set up PIN
            </button>
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 flex items-start gap-2">
            <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        <button
          onClick={handleConfirm}
          disabled={loading || !hasPin || pinInput.length !== 4}
          className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Confirm & Withdraw {formatZMW(amountNum)}
        </button>
      </div>
    );
  }

  // Bank
  return (
    <div className="space-y-4 keyboard-aware">
      <div className="flex items-center gap-3 mb-2">
        <button onClick={back} aria-label="Back"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
        <h3 className="font-semibold text-foreground text-lg">Bank Transfer</h3>
      </div>

      {BalanceHeader}
      {AmountField}
      {exceedsBalance && (
        <p className="text-xs text-destructive">Amount exceeds your available balance.</p>
      )}

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Bank Name</label>
        <input
          type="text"
          value={bankName}
          onChange={(e) => setBankName(sanitizeText(e.target.value).slice(0, 60))}
          placeholder="e.g. Zanaco"
          className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Account Number</label>
        <input
          type="text"
          value={bankAccount}
          onChange={(e) => setBankAccount(sanitizeAccountNumber(e.target.value))}
          placeholder="Account number"
          className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
        />
      </div>

      <div>
        <label className="text-xs text-muted-foreground block mb-1">Branch (optional)</label>
        <input
          type="text"
          value={bankBranch}
          onChange={(e) => setBankBranch(sanitizeText(e.target.value).slice(0, 60))}
          placeholder="Branch name"
          className="w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
        />
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-4 py-3 flex items-start gap-2">
          <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      <button
        onClick={() => goToConfirm('bank')}
        disabled={!isAmountValid || !bankName || !bankAccount || loading || exceedsBalance || walletLoading}
        className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity flex items-center justify-center gap-2"
      >
        Continue
      </button>
    </div>
  );
};

export default WithdrawScreen;
