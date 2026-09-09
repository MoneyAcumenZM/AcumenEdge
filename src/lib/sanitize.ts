import DOMPurify from 'dompurify';
import { containsInjection } from './security';

export function sanitizeText(value: string): string {
  const cleaned = DOMPurify.sanitize(value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  return cleaned.trim();
}

export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .substring(0, 100);
}

export function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (!['https:', 'http:'].includes(parsed.protocol)) return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export function isInputSafe(value: string): boolean {
  return !containsInjection(value);
}
