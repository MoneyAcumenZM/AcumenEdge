import { useNavigate, useSearchParams } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { useEffect } from 'react';
import { cancelDeposit } from '@/services/dpoService';

const DepositCancelled = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const transToken = searchParams.get('TransactionToken') || '';

  useEffect(() => {
    if (transToken) {
      // Best-effort cancel — middleware may not implement this endpoint.
      cancelDeposit(transToken).catch(() => {});
    }
  }, [transToken]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
          <XCircle className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-foreground font-bold text-lg">Payment Cancelled</p>
        <p className="text-sm text-muted-foreground">Your wallet has not been charged.</p>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">Return to Home</button>
      </div>
    </div>
  );
};

export default DepositCancelled;
