// Median JavaScript Bridge biometric service
// Works on Android (fingerprint, face) and iOS (Face ID, Touch ID)
// Median stores secrets in native secure storage (Android Keystore / iOS Keychain)
//
// IMPORTANT: The Median app must have this app's production domain
// whitelisted in the Face ID / Touch ID / Android Biometrics plugin
// settings in Median App Studio. Without this the biometric bridge will
// not work on the production domain.
//
// To test biometric integration during development use the Median App Studio
// simulator at median.dev and click the Fingerprint ID button in the simulator
// to enable biometric support. Then test the full flow using the demo page at
// median.dev/auth/ as a reference. On a physical Android device the native
// fingerprint or face prompt will appear automatically when median.auth.get is called.

declare global {
  interface Window {
    median?: {
      auth?: {
        status: (options?: {
          minimumAndroidBiometric?: 'strong' | 'weak'
          callbackFunction?: string
        }) => Promise<{
          hasTouchId: boolean
          hasFaceId?: boolean
          hasSecret: boolean
          biometryType?: 'touchId' | 'faceId' | 'none'
        }>
        save: (options: {
          secret: string
          reason?: string
          minimumAndroidBiometric?: 'strong' | 'weak'
          callbackFunction?: string
        }) => Promise<{ success: boolean }>
        get: (options: {
          callbackFunction?: string
          minimumAndroidBiometric?: 'strong' | 'weak'
          prompt?: string
          reason?: string
          callbackOnCancel?: number
        }) => Promise<{
          success: boolean
          secret?: string
          error?: string
        }>
        delete: (options?: {
          callbackFunction?: string
        }) => Promise<{ success: boolean; error?: string }>
      }
    }
  }
}

/** Detect if running inside Median native app */
export function isMedianApp(): boolean {
  return typeof window !== 'undefined' &&
    window.median !== undefined &&
    window.median.auth !== undefined;
}

/** Detect iOS platform */
export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Detect Android platform */
export function isAndroid(): boolean {
  return /android/i.test(navigator.userAgent);
}

/** Get biometric display name based on device type */
export function getBiometricDisplayName(biometryType?: string): string {
  if (biometryType === 'faceId') return 'Face ID';
  if (biometryType === 'touchId') return 'Touch ID';
  if (isAndroid()) return 'Fingerprint';
  return 'Biometric Login';
}

/** Get biometric icon name based on device type */
export function getBiometricIcon(biometryType?: string): 'scan-face' | 'fingerprint' {
  if (biometryType === 'faceId') return 'scan-face';
  return 'fingerprint';
}

export interface BiometricStatus {
  available: boolean;
  hasSecret: boolean;
  biometryType?: 'touchId' | 'faceId' | 'none';
  displayName: string;
  icon: 'scan-face' | 'fingerprint';
}

/** Check biometric availability and secret status */
export async function getBiometricStatus(): Promise<BiometricStatus> {
  if (!isMedianApp()) {
    return { available: false, hasSecret: false, displayName: '', icon: 'fingerprint' };
  }

  try {
    // iOS does not use minimumAndroidBiometric; Android uses strong by default
    const options = isAndroid() ? { minimumAndroidBiometric: 'strong' as const } : {};
    const result = await window.median!.auth!.status(options);

    return {
      available: result.hasTouchId,
      hasSecret: result.hasSecret,
      biometryType: result.biometryType,
      displayName: getBiometricDisplayName(result.biometryType),
      icon: getBiometricIcon(result.biometryType),
    };
  } catch {
    return { available: false, hasSecret: false, displayName: '', icon: 'fingerprint' };
  }
}

/** Save encrypted secret — iOS uses Keychain, Android uses Keystore */
export async function saveBiometricSecret(secret: string): Promise<boolean> {
  if (!isMedianApp()) return false;

  try {
    const result = await window.median!.auth!.save({
      secret,
      ...(isAndroid() ? { minimumAndroidBiometric: 'strong' as const } : {}),
    });
    return result.success;
  } catch {
    return false;
  }
}

/**
 * Retrieve secret with biometric prompt.
 * iOS shows Face ID scan or Touch ID fingerprint prompt.
 * Android shows fingerprint or face prompt.
 */
export async function getBiometricSecret(biometryType?: string): Promise<string | null> {
  if (!isMedianApp()) return null;

  try {
    const promptText = biometryType === 'faceId'
      ? 'Use Face ID to sign in to AcumenEdge'
      : biometryType === 'touchId'
      ? 'Use Touch ID to sign in to AcumenEdge'
      : 'Use your fingerprint to sign in to AcumenEdge';

    const result = await window.median!.auth!.get({
      prompt: promptText,
      callbackOnCancel: 1,
      ...(isAndroid() ? { minimumAndroidBiometric: 'strong' as const } : {}),
    });

    if (result.success && result.secret) {
      return result.secret;
    }

    if (result.error === 'authenticationFailed') {
      throw new Error('authenticationFailed');
    }

    return null;
  } catch (error) {
    if (error instanceof Error && error.message === 'authenticationFailed') throw error;
    return null;
  }
}

/** Delete saved biometric secret */
export async function deleteBiometricSecret(): Promise<boolean> {
  if (!isMedianApp()) return false;
  try {
    const result = await window.median!.auth!.delete({});
    return result.success;
  } catch {
    return false;
  }
}

// ─── Biometric sign-in ───
// The secret saved in the phone's secure storage is the user's refresh
// token; reading it back (behind a Face ID / fingerprint prompt) and
// exchanging it for a new session is what "sign in with biometrics" does.
// This key records whose token is stored, so a token is only ever used for,
// and kept up to date for, the account that turned the feature on.
const BIOMETRIC_USER_KEY = 'acumenedge_biometric_user';
// Flags written by earlier builds, cleared whenever biometric login changes.
const LEGACY_KEYS = ['circle_biometric_enabled', 'circle_biometric_refresh'];

function clearLegacyFlags() {
  try {
    LEGACY_KEYS.forEach((k) => localStorage.removeItem(k));
    Object.keys(localStorage).filter((k) => k.startsWith('bio_enabled_')).forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage unavailable — nothing to clear.
  }
}

/** The user whose session is stored for biometric sign-in, if any. */
export function getBiometricUserId(): string | null {
  try {
    return localStorage.getItem(BIOMETRIC_USER_KEY);
  } catch {
    return null;
  }
}

/** Store this user's refresh token behind biometrics. Returns false if the phone refused. */
export async function enableBiometricLogin(userId: string, refreshToken: string): Promise<boolean> {
  clearLegacyFlags();
  const saved = await saveBiometricSecret(refreshToken);
  if (saved) localStorage.setItem(BIOMETRIC_USER_KEY, userId);
  return saved;
}

/** Remove the stored token and turn biometric sign-in off. */
export async function disableBiometricLogin(): Promise<void> {
  clearLegacyFlags();
  await deleteBiometricSecret();
  try {
    localStorage.removeItem(BIOMETRIC_USER_KEY);
  } catch {
    // Storage unavailable — the secret itself is already deleted.
  }
}

/**
 * Keep the stored token current. Refresh tokens rotate, so after every
 * sign-in or token refresh the newest one must replace the stored copy or
 * the next biometric sign-in would present a token that's already been used.
 * A different account signing in removes the stored token instead.
 */
export async function syncBiometricLogin(userId: string, refreshToken: string): Promise<void> {
  const owner = getBiometricUserId();
  if (!owner) return;
  if (owner === userId) await saveBiometricSecret(refreshToken);
  else await disableBiometricLogin();
}
