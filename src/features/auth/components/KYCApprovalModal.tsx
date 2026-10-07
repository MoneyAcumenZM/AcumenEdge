import { CheckCircle, X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

const KYCApprovalModal = ({ open, onClose }: Props) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center animate-fade-in">
      <div className="bg-card border border-success/30 rounded-2xl p-8 max-w-md text-center space-y-5 relative mx-4">
        <button onClick={onClose} className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
        <div className="w-20 h-20 rounded-full bg-success/20 flex items-center justify-center mx-auto">
          <CheckCircle className="w-12 h-12 text-success" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">Account Approved!</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your account has been approved. You can now start trading on the Lusaka Stock Exchange.
        </p>
        <button
          onClick={onClose}
          className="w-full bg-success text-success-foreground font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
        >
          Start Trading
        </button>
      </div>
    </div>
  );
};

export default KYCApprovalModal;
