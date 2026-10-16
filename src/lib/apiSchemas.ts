/**
 * Runtime schemas for the trading and wallet API.
 *
 * TypeScript types disappear at runtime, so a money field that is missing,
 * null or non-numeric would otherwise flow on as `undefined`/`NaN`, or be
 * quietly turned into 0 by `Number(x || 0)`: a balance of K0.00 or a
 * position worth nothing, shown as fact. Every financial response is parsed
 * here instead; a response that does not match is an error the caller shows
 * as "unavailable", never a default.
 *
 * Money fields are required and must be finite. They may arrive as numbers
 * or as plain decimal strings ("1250.50"), but never as null, "", "NaN" or
 * anything else. Genuinely optional fields stay optional and are left
 * `undefined`, not filled in.
 */
import { z } from 'zod';
import { ResponseShapeError } from '@/lib/idempotency';

const DECIMAL = /^-?\d+(\.\d+)?$/;

/** A finite number, from a number or a plain decimal string. */
export const money = z
  .union([z.number(), z.string().regex(DECIMAL, 'not a decimal number')])
  .transform((v) => (typeof v === 'number' ? v : Number(v)))
  .refine(Number.isFinite, 'not a finite number');

const nonEmpty = z.string().trim().min(1, 'must not be empty');
const idLike = z.union([z.string().min(1), z.number()]).transform(String);

/** Parse `data` or throw a ResponseShapeError naming what was being read. */
export function parseApi<S extends z.ZodTypeAny>(schema: S, data: unknown, what: string): z.output<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const issues = result.error.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
  throw new ResponseShapeError(what, issues);
}

// ── Wallet ──────────────────────────────────────────────────────────────
const walletTransaction = z.object({
  id: idLike,
  type: z.string(),
  amount: money,
  status: z.string(),
  createdAt: z.string(),
  description: z.string().optional(),
});

export const walletSchema = z.object({
  balance: money,
  currency: nonEmpty,
  // History rows are validated one by one in getWallet(): a single bad row
  // must not hide a good balance, but it is never silently counted.
  transactions: z.array(z.unknown()).optional(),
});

export function parseWalletTransactions(rows: unknown[] | undefined) {
  const good: z.output<typeof walletTransaction>[] = [];
  let rejected = 0;
  for (const row of rows ?? []) {
    const r = walletTransaction.safeParse(row);
    if (r.success) good.push(r.data);
    else rejected += 1;
  }
  return { transactions: good, rejected };
}

export const withdrawResultSchema = z.object({
  transactionId: idLike.optional(),
  status: z.string().optional(),
  newBalance: money.optional(),
  message: z.string().optional(),
  success: z.boolean().optional(),
});

/** Card deposits return payUrl, mobile deposits only a token; either way a token or URL must be there. */
export const depositInitSchema = z
  .object({
    payUrl: z.string().url().optional(),
    transactionToken: nonEmpty.optional(),
    reference: z.string().optional(),
    transactionId: idLike.optional(),
    amount: money.optional(),
    status: z.string().optional(),
    message: z.string().optional(),
    success: z.boolean().optional(),
  })
  .refine((d) => d.payUrl !== undefined || d.transactionToken !== undefined, {
    message: 'no payUrl or transactionToken',
  });

export const depositVerifySchema = z
  .object({
    status: nonEmpty,
    newBalance: money.optional(),
    amount: money.optional(),
    dpoResult: z.string().optional(),
    explanation: z.string().optional(),
    success: z.boolean().optional(),
  })
  .passthrough();

export const stepUpSchema = z.object({
  token: nonEmpty,
  expiresIn: z.number().positive().optional(),
});

// ── Portfolio ───────────────────────────────────────────────────────────
const CSD_STATUS = z.enum(['csd_deposited', 'pending_deposit', 'not_deposited']);

const position = z
  .object({
    symbol: nonEmpty,
    quantity: money,
    pendingQty: money.optional(),
    pending_qty: money.optional(),
    avgPrice: money,
    cost: money,
    marketValue: money,
    pnl: money,
    pnlPct: money,
    currentPrice: money,
    csdStatus: CSD_STATUS.optional(),
    csd_status: CSD_STATUS.optional(),
  })
  .refine((p) => p.quantity >= 0, { message: 'quantity must not be negative', path: ['quantity'] });

export const portfolioSchema = z.object({ positions: z.array(position) });
export type Position = z.output<typeof position>;

// ── Orders ──────────────────────────────────────────────────────────────
export const placeOrderResultSchema = z
  .object({
    status: z.string().optional(),
    clOrdId: z.string().optional(),
    orderStatus: z.string().optional(),
    fixSent: z.boolean().optional(),
    queued: z.boolean().optional(),
    message: z.string().optional(),
    error: z.string().optional(),
  })
  // An answer that says neither "ok" nor why not is not an answer.
  .refine((r) => r.status !== undefined || r.orderStatus !== undefined || r.error !== undefined, {
    message: 'no status, orderStatus or error',
  });

const orderRow = z
  .object({
    symbol: nonEmpty,
    side: z.string(),
    quantity: money,
    status: z.string().optional(),
    price: money.optional(),
  })
  .passthrough();

export const ordersListSchema = z.object({ orders: z.array(orderRow) });

const tradeRow = z
  .object({
    symbol: nonEmpty,
    side: z.string(),
    quantity: money,
    price: money.optional(),
    executionPrice: money.optional(),
  })
  .passthrough()
  .refine((t) => t.price !== undefined || t.executionPrice !== undefined, {
    message: 'executed trade has no price',
    path: ['price'],
  });

/** History arrives bare, or wrapped as { orders } or { data }. */
export const tradeHistorySchema = z
  .union([z.array(tradeRow), z.object({ orders: z.array(tradeRow) }), z.object({ data: z.array(tradeRow) })])
  .transform((v) => (Array.isArray(v) ? v : 'orders' in v ? v.orders : v.data));
