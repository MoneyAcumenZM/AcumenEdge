import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { CheckCircle2, XCircle, Loader2, Search, ShieldAlert, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { middlewareClient } from '@/services/middlewareClient';

type ClientRow = {
  user_id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  kyc_status?: 'pending' | 'approved' | 'rejected' | string;
  csd_registration_status?: string;
  created_at?: string;
};

const STATUS_FILTERS = ['pending', 'approved', 'rejected'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number] | 'all';

const ADMIN_ROLES = new Set(['BROKER_ADMIN', 'BROKER_DEALER']);

const StatusBadge = ({ status }: { status?: string }) => {
  const s = (status || 'pending').toLowerCase();
  const map: Record<string, string> = {
    approved: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    rejected: 'bg-destructive/15 text-destructive border-destructive/30',
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md border ${map[s] || map.pending}`}>
      {s}
    </span>
  );
};

const AdminClients = () => {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();

  const isAdmin = !!role && ADMIN_ROLES.has(role);

  const [filter, setFilter] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');
  const [active, setActive] = useState<ClientRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approveNotes, setApproveNotes] = useState('');

  useEffect(() => {
    if (!authLoading && user && !isAdmin) {
      navigate('/', { replace: true });
    }
  }, [authLoading, user, isAdmin, navigate]);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin', 'clients'],
    queryFn: async () => {
      const res: any = await middlewareClient.adminListClients(1, 200);
      const rows: ClientRow[] = res?.clients || res?.rows || res?.data || [];
      return rows;
    },
    enabled: isAdmin,
    staleTime: 60 * 1000,
  });

  const approveMut = useMutation({
    mutationFn: ({ userId, notes }: { userId: string; notes: string }) =>
      middlewareClient.adminApproveClient(userId, notes),
    onSuccess: () => {
      toast.success('Client approved');
      setActive(null);
      setApproveNotes('');
      qc.invalidateQueries({ queryKey: ['admin', 'clients'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Approval failed'),
  });

  const rejectMut = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      middlewareClient.adminRejectClient(userId, reason),
    onSuccess: () => {
      toast.success('Client rejected');
      setActive(null);
      setRejectReason('');
      qc.invalidateQueries({ queryKey: ['admin', 'clients'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Rejection failed'),
  });

  const filtered = useMemo(() => {
    const rows = data || [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const status = (r.kyc_status || 'pending').toLowerCase();
      if (filter !== 'all' && status !== filter) return false;
      if (!q) return true;
      return (
        (r.full_name || '').toLowerCase().includes(q) ||
        (r.email || '').toLowerCase().includes(q) ||
        (r.phone || '').toLowerCase().includes(q) ||
        (r.user_id || '').toLowerCase().includes(q)
      );
    });
  }, [data, filter, search]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto mt-16 text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-warning mx-auto" />
        <h1 className="text-lg font-semibold text-foreground">Restricted</h1>
        <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-foreground">Clients</h1>
          <p className="text-xs text-muted-foreground">Review KYC submissions and approve or reject onboarding requests.</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 text-xs font-medium border border-border rounded-lg px-3 py-2 hover:bg-secondary/50 disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </header>

      <div className="flex items-center gap-2 flex-wrap">
        {(['pending', 'approved', 'rejected', 'all'] as StatusFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
              filter === f
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.toUpperCase()}
          </button>
        ))}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, phone, ID"
            className="w-full bg-secondary/40 border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
        </div>
      </div>

      <div className="border border-border rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-secondary/30">
          <div className="col-span-4">Name</div>
          <div className="col-span-3">Contact</div>
          <div className="col-span-2">Submitted</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1 text-right">Action</div>
        </div>

        {isLoading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">No clients match the current filter.</p>
        ) : (
          filtered.map((c) => (
            <div
              key={c.user_id}
              className="grid grid-cols-12 px-4 py-3 items-center text-xs border-t border-border hover:bg-secondary/20 transition-colors"
            >
              <div className="col-span-4">
                <p className="text-foreground font-medium truncate">{c.full_name || '—'}</p>
                <p className="text-[10px] text-muted-foreground font-mono truncate">{c.user_id}</p>
              </div>
              <div className="col-span-3 text-muted-foreground truncate">
                <p className="truncate">{c.email || '—'}</p>
                <p className="text-[10px] truncate">{c.phone || '—'}</p>
              </div>
              <div className="col-span-2 text-muted-foreground">
                {c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}
              </div>
              <div className="col-span-2">
                <StatusBadge status={c.kyc_status} />
              </div>
              <div className="col-span-1 text-right">
                <button
                  onClick={() => setActive(c)}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Review
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
          onClick={() => setActive(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full md:max-w-lg bg-background border border-border rounded-t-2xl md:rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto hide-scrollbar"
          >
            <div>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-foreground">{active.full_name || 'Client'}</h2>
                <StatusBadge status={active.kyc_status} />
              </div>
              <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{active.user_id}</p>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="text-foreground">{active.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="text-foreground">{active.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">CSD status</dt>
                <dd className="text-foreground">{active.csd_registration_status || '—'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Submitted</dt>
                <dd className="text-foreground">
                  {active.created_at ? new Date(active.created_at).toLocaleString() : '—'}
                </dd>
              </div>
            </dl>

            {(active.kyc_status || 'pending').toLowerCase() === 'pending' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Approval notes (optional)</label>
                  <textarea
                    value={approveNotes}
                    onChange={(e) => setApproveNotes(e.target.value)}
                    rows={2}
                    className="w-full bg-secondary/40 border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-primary"
                    placeholder="Internal note for the audit trail"
                  />
                  <button
                    onClick={() =>
                      approveMut.mutate({ userId: active.user_id, notes: approveNotes.trim() })
                    }
                    disabled={approveMut.isPending}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-60"
                  >
                    {approveMut.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Approve client
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Rejection reason (required)</label>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={2}
                    className="w-full bg-secondary/40 border border-border rounded-lg p-2 text-xs text-foreground focus:outline-none focus:border-destructive"
                    placeholder="Shown to the client in their dashboard"
                  />
                  <button
                    onClick={() => {
                      const reason = rejectReason.trim();
                      if (!reason) {
                        toast.error('Please provide a rejection reason');
                        return;
                      }
                      rejectMut.mutate({ userId: active.user_id, reason });
                    }}
                    disabled={rejectMut.isPending}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 hover:bg-destructive/20 text-destructive text-sm font-semibold px-4 py-2.5 disabled:opacity-60"
                  >
                    {rejectMut.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Reject application
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground border border-border rounded-lg p-3">
                This client is already {active.kyc_status}. No further action is available from this view.
              </p>
            )}

            <button
              onClick={() => setActive(null)}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminClients;
