// Filename sanitising for uploads. Text-field sanitisers live in
// lib/formSanitizers.ts.
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/\.{2,}/g, '.')
    .substring(0, 100);
}
