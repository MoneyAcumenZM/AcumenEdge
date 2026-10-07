import DOMPurify from 'dompurify';
import validator from 'validator';

export function sanitizeText(input: string): string {
  if (!input) return '';
  // Removes HTML and script-like content only (XSS hardening). Quotes,
  // semicolons, hyphens and SQL keywords are left alone: every query is
  // parameterised, so stripping them would only corrupt real input such as
  // "O'Brien" or a business name containing "Select".
  return DOMPurify.sanitize(input.trim(), { ALLOWED_TAGS: [] })
    .replace(/javascript:|on\w+=|data:/gi, '');
}

export const sanitizeName = (v: string) =>
  sanitizeText(v).replace(/[^a-zA-Z\s\-'.]/g, '').slice(0, 100);

export const sanitizeEmail = (v: string) => {
  const c = sanitizeText(v).toLowerCase();
  return validator.isEmail(c) ? c : '';
};

export const sanitizePhone = (v: string) =>
  sanitizeText(v).replace(/[^\d+\s\-()]/g, '').slice(0, 20);

export const sanitizeAmount = (v: string) => {
  const n = parseFloat(v.replace(/[^\d.]/g, ''));
  return isNaN(n) || n < 0 ? null : Math.round(n * 100) / 100;
};

export const sanitizeSearch = (v: string) =>
  sanitizeText(v).replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 100);

export const sanitizeAccountNumber = (v: string) =>
  sanitizeText(v).replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);

export const sanitizePin = (v: string) =>
  v.replace(/\D/g, '').slice(0, 6);
