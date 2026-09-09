import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useWallet } from '@/hooks/useSupabaseQuery';

const DepositComplete = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: wallet, refetch } = useWallet();
  const [done, setDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const initialBalance = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;
    initialBalance.current = Number(wallet?.balance ?? 0);

    const start = Date.now();
    const MAX_MS = 60_000;
    const id = setInterval(async () => {
      const { data } = await refetch();
      const current = Number(data?.balance ?? 0);
      if (initialBalance.current != null && current > initialBalance.current) {
        clearInterval(id);
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        setDone(true);
      } else if (Date.now() - start > MAX_MS) {
        clearInterval(id);
        setTimedOut(true);
      }
    }, 10_000);

    return () => clearInterval(id);
  }, [user, refetch, queryClient]);

  const balanceText = wallet
    ? `ZMW ${Number(wallet.balance).toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-success/10 flex items-center justify-center">
          {done ? (
            <CheckCircle2 className="w-8 h-8 text-success" />
          ) : (
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          )}
        </div>
        <p className="text-foreground font-bold text-lg">
          {done ? 'Payment Received' : 'Payment Submitted'}
        </p>
        {done && balanceText ? (
          <p className="text-sm text-muted-foreground">Your new balance is {balanceText}</p>
        ) : timedOut ? (
          <p className="text-sm text-muted-foreground">
            Your balance may take a few minutes to reflect. Check your wallet shortly.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Confirming with the payment provider…</p>
        )}
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold"
        >
          Done
        </button>
      </div>
    </div>
  );
};

export default DepositComplete;
