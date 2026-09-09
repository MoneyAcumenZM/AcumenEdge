import { useState, useRef, useEffect } from 'react';
import { Shield, Check, X } from 'lucide-react';
import { setPIN } from '@/services/pinService';

interface PINSetupFlowProps {
  userId: string;
  onComplete: () => void;
  onSkip?: () => void;
  isModal?: boolean;
}

export default function PINSetupFlow({ userId, onComplete, onSkip, isModal }: PINSetupFlowProps) {
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [firstPin, setFirstPin] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 300);
  }, [step]);

  const handleChange = async (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 4);
    setPin(digits);
    setError('');

    if (digits.length === 4) {
      if (step === 'enter') {
        setFirstPin(digits);
        setPin('');
        setStep('confirm');
      } else {
        if (digits === firstPin) {
          await setPIN(userId, digits);
          setSuccess(true);
          setTimeout(onComplete, 1000);
        } else {
          setError('PINs do not match. Please try again.');
          setPin('');
          setFirstPin('');
          setStep('enter');
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      }
    }
  };

  const Wrapper = isModal ? 'div' : 'div';

  return (
    <div className={`flex flex-col items-center justify-center ${isModal ? 'p-6' : 'min-h-screen bg-background p-6'}`} onClick={() => inputRef.current?.focus()}>
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        {success ? <Check className="w-8 h-8 text-green-500" /> : <Shield className="w-8 h-8 text-primary" />}
      </div>

      {success ? (
        <div className="text-center space-y-2">
          <h2 className="text-lg font-bold text-foreground">PIN Set Successfully</h2>
          <p className="text-sm text-muted-foreground">Your app is now secured</p>
        </div>
      ) : (
        <>
          <h2 className="text-lg font-bold text-foreground mb-1">
            {step === 'enter' ? 'Create your 4-digit PIN' : 'Confirm your PIN'}
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            {step === 'enter'
              ? 'You\'ll use this to quickly unlock the app'
              : 'Enter the same PIN again to confirm'}
          </p>

          {/* PIN dots */}
          <div className="flex gap-4 mb-4">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  i < pin.length ? 'bg-primary scale-110' : 'border-2 border-muted-foreground/30'
                }`}
              />
            ))}
          </div>

          {error && <p className="text-xs text-destructive mt-2 mb-4">{error}</p>}

          {/* Hidden input for native keyboard */}
          <input
            ref={inputRef}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={e => handleChange(e.target.value)}
            autoFocus
            className="absolute opacity-0 w-px h-px pointer-events-none"
            autoComplete="off"
          />

          {onSkip && (
            <button onClick={onSkip} className="mt-8 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Skip for now
            </button>
          )}
        </>
      )}
    </div>
  );
}
