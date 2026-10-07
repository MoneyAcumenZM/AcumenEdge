import { useState, useEffect, useCallback } from 'react';
import {
  getBiometricStatus,
  getBiometricUserId,
  enableBiometricLogin,
  disableBiometricLogin,
} from '@/features/auth/services/biometricService';

export interface BiometricResult {
  /** The phone supports biometrics and the app is running inside Median. */
  isAvailable: boolean;
  /** Biometric sign-in is turned on for this user. */
  isEnabled: boolean;
  /** "Face ID", "Touch ID" or "Fingerprint". */
  displayName: string;
  enable: (refreshToken: string) => Promise<void>;
  disable: () => Promise<void>;
}

/** Biometric sign-in settings for the signed-in user (Profile page). */
export function useBiometricAuth(userId: string | undefined): BiometricResult {
  const [isAvailable, setIsAvailable] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBiometricStatus().then((status) => {
      if (cancelled) return;
      setIsAvailable(status.available);
      setDisplayName(status.displayName);
      setIsEnabled(Boolean(userId) && status.hasSecret && getBiometricUserId() === userId);
    });
    return () => { cancelled = true; };
  }, [userId]);

  const enable = useCallback(async (refreshToken: string) => {
    if (!userId) throw new Error('Not signed in');
    const saved = await enableBiometricLogin(userId, refreshToken);
    if (!saved) throw new Error('Failed to enable biometric authentication');
    setIsEnabled(true);
  }, [userId]);

  const disable = useCallback(async () => {
    await disableBiometricLogin();
    setIsEnabled(false);
  }, []);

  return { isAvailable, isEnabled, displayName, enable, disable };
}
