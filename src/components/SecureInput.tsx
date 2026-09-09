import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { containsInjection } from '@/lib/security';

interface SecureInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onSecureChange: (value: string) => void;
  error?: string;
  label?: string;
}

export function SecureInput({ onSecureChange, error, label, ...props }: SecureInputProps) {
  const [localError, setLocalError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const sanitized = DOMPurify.sanitize(raw, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });

    if (containsInjection(sanitized)) {
      setLocalError('Invalid characters detected');
      return;
    }

    setLocalError('');
    onSecureChange(sanitized);
  };

  const displayError = error || localError;

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <input
        {...props}
        onChange={handleChange}
        autoComplete={props.autoComplete || 'off'}
        spellCheck={false}
        className={`w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${props.className || ''} ${displayError ? 'ring-1 ring-destructive' : ''}`}
      />
      {displayError && (
        <span className="text-xs text-destructive">{displayError}</span>
      )}
    </div>
  );
}

interface SecureTextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onSecureChange: (value: string) => void;
  error?: string;
  label?: string;
}

export function SecureTextArea({ onSecureChange, error, label, ...props }: SecureTextAreaProps) {
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const sanitized = DOMPurify.sanitize(e.target.value, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    onSecureChange(sanitized);
  };

  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <textarea
        {...props}
        onChange={handleChange}
        spellCheck={false}
        className={`w-full bg-secondary rounded-xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary ${props.className || ''} ${error ? 'ring-1 ring-destructive' : ''}`}
      />
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
