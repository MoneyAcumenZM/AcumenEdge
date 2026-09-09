import { useState } from 'react';
import { Receipt, ChevronDown, ChevronUp, Download, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { formatZMW } from '@/lib/tradingUtils';
import { useTransactions } from '@/hooks/useSupabaseQuery';

interface Transaction {
  id: string;
  type: string;
  description: string;
  amount: number;
  balance_after: number | null;
  reference: string | null;
  created_at: string;
}

const typeColors: Record<string, string> = {
  deposit: 'text-success',
  withdraw: 'text-destructive',
  buy: 'text-destructive',
  sell: 'text-success',
  fee: 'text-warning'
};

const typeLabels: Record<string, string> = {
  deposit: 'Deposit',
  withdraw: 'Withdrawal',
  buy: 'Buy Deduction',
  sell: 'Sell Revenue',
  fee: 'Fee'
};

const TransactionHistory = ({ open, onClose }: {open: boolean;onClose: () => void;}) => {
  const { profile } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const { data: result } = useTransactions(page, open);
  const transactions = (result?.data || []) as Transaction[];
  const total = result?.total || 0;
  const pageSize = result?.pageSize || 20;
  const totalPages = Math.ceil(total / pageSize);

  const downloadPDF = () => {
    const lines: string[] = [];
    lines.push('═══════════════════════════════════════');
    lines.push('         CIRCLE TRADING PLATFORM       ');
    lines.push('        TRANSACTION STATEMENT          ');
    lines.push('═══════════════════════════════════════');
    lines.push('');
    lines.push(`Account Holder: ${profile?.full_name || 'N/A'}`);
    lines.push(`TPIN: ${profile?.tpin || 'N/A'}`);
    lines.push(`CSD Account: ${profile?.sor_account || 'Pending'}`);
    lines.push('');
    lines.push('───────────────────────────────────────');
    lines.push('Date            Type         Amount    ');
    lines.push('───────────────────────────────────────');

    transactions.forEach((t) => {
      const date = new Date(t.created_at).toLocaleDateString('en-ZM');
      const type = (typeLabels[t.type] || t.type).padEnd(12);
      const amount = formatZMW(Math.abs(t.amount));
      lines.push(`${date.padEnd(16)}${type}${amount}`);
      lines.push(`  ${t.description}`);
      if (t.reference) lines.push(`  Ref: ${t.reference}`);
      lines.push('');
    });

    lines.push('───────────────────────────────────────');
    lines.push(`Generated: ${new Date().toLocaleString('en-ZM')}`);
    lines.push(`Statement ID: TXN-${Date.now().toString(36).toUpperCase()}`);
    lines.push('═══════════════════════════════════════');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `circle-transactions-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-card rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-foreground text-sm">Transaction History</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={downloadPDF} className="text-primary hover:text-primary/80 p-1" title="Download statement">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 divide-y divide-border">
          {transactions.length === 0 ?
          <div className="px-4 py-8 text-center">
              <p className="text-xs text-muted-foreground">No transactions yet</p>
            </div> :

          transactions.map((t) =>
          <div key={t.id} className="px-4 py-3">
                <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)} className="w-full text-left">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-foreground">{typeLabels[t.type] || t.type}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(t.created_at).toLocaleDateString('en-ZM')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${typeColors[t.type] || 'text-foreground'}`}>
                        {t.type === 'withdraw' || t.type === 'buy' || t.type === 'fee' ? '-' : '+'}
                        {formatZMW(Math.abs(t.amount))}
                      </span>
                      {expandedId === t.id ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  </div>
                </button>
                {expandedId === t.id &&
            <div className="mt-2 bg-secondary/50 rounded-lg px-3 py-2 space-y-1 text-xs">
                    <p className="text-foreground">{t.description}</p>
                    {t.reference && <p className="text-muted-foreground">Ref: {t.reference}</p>}
                    {t.balance_after != null && <p className="text-muted-foreground">Balance after: {formatZMW(t.balance_after)}</p>}
                    <p className="text-muted-foreground">{new Date(t.created_at).toLocaleString('en-ZM')}</p>
                  </div>
            }
              </div>
          )
          }
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-border shrink-0">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 text-xs text-muted-foreground disabled:opacity-30 hover:text-foreground transition-colors"
            >
              <ChevronLeft className="w-3 h-3" /> Previous
            </button>
            <span className="text-[10px] text-muted-foreground">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 text-xs text-muted-foreground disabled:opacity-30 hover:text-foreground transition-colors"
            >
              Next <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>);
};

export default TransactionHistory;
