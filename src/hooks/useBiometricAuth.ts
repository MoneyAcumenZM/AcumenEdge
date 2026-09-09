import { useState, useEffect, useCallback } from 'react';

const BIOMETRIC_ENABLED_KEY = 'circle_biometric_enabled';
/**
 * Session-only holder for a refresh token when a native vault is unavailable.
 * SECURITY: never persist auth tokens in localStorage — it survives tab close
 * and is readable by any script on the origin. On web, biometrics simply are
 * not offered; the user signs in with a password instead.
 */
const STORED_REFRESH_KEY = 'circle_biometric_refresh';

export interface BiometricResult {
  isAvailable: boolean;
  isEnabled: boolean;
  enable: (refreshToken: string) => Promise<void>;
  disable: () => Promise<void>;
  authenticate: () => Promise<string | null>;
}

/**
 * Multi-bridge biometric authentication hook.
 * Prefers Capacitor BiometricAuth plugin, falls back to Median JS bridge,
 * and finally to localStorage when no native vault is available.
 */
export function useBiometricAuth(): BiometricResult {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  const checkAvailability = useCallback(async () => {
    // Capacitor BiometricAuth (iOS/Android via @capacitor/biometric-auth or similar)
    try {
      const w: any = window as any;
      if (w.BiometricAuth) {
        const result = await w.BiometricAuth.isAvailable();
        setIsAvailable(Boolean(result?.isAvailable || (result?.biometryType && result.biometryType !== 'none')));
        return;
      }
    } catch {}

    // Median JS bridge
    try {
      const w: any = window as any;
      if (w.median?.auth) {
        const status = await w.median.auth.status();
        setIsAvailable(Boolean(status?.hasTouchId || status?.hasFaceId));
        return;
      }
    } catch {}

    setIsAvailable(false);
  }, []);

  useEffect(() => {
    checkAvailability();
    // Purge any token persisted by an earlier version of this app.
    localStorage.removeItem(STORED_REFRESH_KEY);
    setIsEnabled(localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true');
  }, [checkAvailability]);

  const enable = useCallback(async (refreshToken: string) => {
    const w: any = window as any;
    try {
      if (w.median?.auth?.save) {
        await w.median.auth.save({ secret: refreshToken, reason: 'Unlock Circle' });
      } else if (w.BiometricAuth) {
        // Capacitor build without the Median bridge: keep the secret for this
        // session only (Keychain/Keystore-backed plugins replace this).
        sessionStorage.setItem(STORED_REFRESH_KEY, refreshToken);
      } else {
        throw new Error('Biometric unlock needs the mobile app');
      }
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      setIsEnabled(true);
    } catch {
      throw new Error('Failed to enable biometric authentication');
    }
  }, []);

  const disable = useCallback(async () => {
    localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    localStorage.removeItem(STORED_REFRESH_KEY); // clear any pre-upgrade value
    sessionStorage.removeItem(STORED_REFRESH_KEY);
    try {
      const w: any = window as any;
      if (w.median?.auth?.delete) {
        await w.median.auth.delete();
      }
    } catch {}
    setIsEnabled(false);
  }, []);

  const authenticate = useCallback(async (): Promise<string | null> => {
    const w: any = window as any;
    try {
      if (w.median?.auth?.get) {
        const result = await w.median.auth.get({ reason: 'Unlock Circle' });
        if (result?.secret) return result.secret as string;
      }
      if (w.BiometricAuth) {
        await w.BiometricAuth.verify({ reason: 'Unlock Circle' });
        return sessionStorage.getItem(STORED_REFRESH_KEY);
      }
      // No native vault: do not hand back a token on the web.
    } catch {}
    return null;
  }, []);

  return { isAvailable, isEnabled, enable, disable, authenticate };
}
