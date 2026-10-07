/**
 * Narrowing helpers for data that arrives from outside the app (the trading
 * API, realtime payloads, caught errors). TypeScript interfaces don't
 * validate network data, so responses are typed `unknown`/ApiRecord at the
 * boundary and narrowed here before they reach UI state — a malformed or
 * version-skewed response becomes an empty list or a null, never a NaN or a
 * crash.
 */
import type { ApiRecord } from '@/services/middlewareClient';

export type { ApiRecord };

export function asRecord(value: unknown): ApiRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as ApiRecord) : {};
}

export function asRecords(value: unknown): ApiRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

export function asString(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

/** A finite number, or null when the value is missing or not numeric. */
export function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Message of a thrown value, whatever it turned out to be. */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  const message = asRecord(error).message;
  return typeof message === 'string' && message ? message : fallback;
}
