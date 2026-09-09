import DOMPurify from 'dompurify';
import validator from 'validator';

export function sanitizeText(input: string): string {
  if (!input) return '';
  let clean = DOMPurify.sanitize(input.trim(), { ALLOWED_TAGS: [] });
  clean = clean
    .replace(/['";]|--|\/\*|\*\//gi, '')
    .replace(/\b(DROP|DELETE|INSERT|UPDATE|SELECT|UNION|EXEC)\s/gi, '')
    .replace(/javascript:|on\w+=|data:/gi, '');
  return clean;
}

export const sanitizeName = (v: string) =>
  sanitizeText(v).replace(/[^a-zA-Z\s\-'\.]/g, '').slice(0, 100);

export const sanitizeEmail = (v: string) => {
  const c = sanitizeText(v).toLowerCase();
  return validator.isEmail(c) ? c : '';
};

export const sanitizePhone = (v: string) =>
  sanitizeText(v).replace(/[^\d\+\s\-\(\)]/g, '').slice(0, 20);

export const sanitizeAmount = (v: string) => {
  const n = parseFloat(v.replace(/[^\d\.]/g, ''));
  return isNaN(n) || n < 0 ? null : Math.round(n * 100) / 100;
};

export const sanitizeSearch = (v: string) =>
  sanitizeText(v).replace(/[^a-zA-Z0-9\s]/g, '').slice(0, 100);

export const sanitizeAccountNumber = (v: string) =>
  sanitizeText(v).replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);

export const sanitizePin = (v: string) =>
  v.replace(/\D/g, '').slice(0, 6);
