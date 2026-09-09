import { useState, useRef, useEffect, useCallback } from 'react';
import { Lock, LogOut } from 'lucide-react';
import { verifyPIN, isPINLocked, getPINFailedAttempts } from '@/services/pinService';
import circleLogo from '@/assets/circle-logo-new.svg';

interface PINLockScreenProps {
  userId: string;
  firstName: string;
  onUnlock: () => void;
  onSignOut: () => void;
}

export default function PINLockScreen({ userId, firstName, onUnlock, onSignOut }: PINLockScreenProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [lockSeconds, setLockSeconds] = useState(0);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const verifying = useRef(false);

  // Auto-focus input
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, []);

  // Lockout countdown
  useEffect(() => {
    if (lockSeconds <= 0) return;
    const interval = setInterval(() => {
      setLockSeconds(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setAttemptsLeft(null);
          setTimeout(() => inputRef.current?.focus(), 100);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [lockSeconds]);

  const handlePinChange = useCallback(async (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    setError(false);

    if (digits.length === 4 && !verifying.current) {
      verifying.current = true;
      const correct = await verifyPIN(userId, digits);
      if (correct) {
        setSuccess(true);
        setTimeout(onUnlock, 400);
      } else {
        setError(true);
        setPin('');
        const lockState = isPINLocked(userId);
        if (lockState.locked) {
          setLockSeconds(lockState.secondsRemaining);
        } else {
          const attempts = getPINFailedAttempts(userId);
          if (attempts >= 3) setAttemptsLeft(5 - attempts);
        }
        setTimeout(() => {
          setError(false);
          inputRef.current?.focus();
        }, 600);
      }
      verifying.current = false;
    }
  }, [userId, onUnlock]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div
      className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-background/95 backdrop-blur-xl"
      onClick={() => inputRef.current?.focus()}
    >
      <img src={circleLogo} alt="" width={56} height={56} className="w-14 h-14 rounded-xl mb-6" />
      <p className="text-muted-foreground text-sm mb-1">Welcome back</p>
      <h2 className="text-lg font-bold text-foreground mb-8">{firstName}</h2>

      {lockSeconds > 0 ? (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <p className="text-sm text-muted-foreground">Too many attempts</p>
          <p className="text-2xl font-mono font-bold text-foreground">{formatTime(lockSeconds)}</p>
        </div>
      ) : (
        <>
          {/* PIN dots */}
          <div className="flex gap-4 mb-4">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  success ? 'bg-green-500 scale-110' :
                  error ? 'bg-destructive animate-[shake_0.3s_ease-in-out]' :
                  i < pin.length ? 'bg-primary scale-110' :
                  'border-2 border-muted-foreground/30'
                }`}
              />
            ))}
          </div>

          <p className="text-xs text-muted-foreground mb-6">Enter your 4-digit PIN</p>

          {attemptsLeft !== null && attemptsLeft > 0 && (
            <p className="text-xs text-destructive mb-4">{attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining</p>
          )}

          <input
            ref={inputRef}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={e => handlePinChange(e.target.value)}
            autoFocus
            className="absolute opacity-0 w-px h-px pointer-events-none"
            autoComplete="off"
          />
        </>
      )}

      {/* Sign out */}
      <div className="absolute bottom-10">
        {showSignOutConfirm ? (
          <div className="flex items-center gap-3">
            <button onClick={onSignOut} className="text-xs text-destructive font-medium">Confirm Sign Out</button>
            <button onClick={() => setShowSignOutConfirm(false)} className="text-xs text-muted-foreground">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setShowSignOutConfirm(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        )}
      </div>
    </div>
  );
}
