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
          hasSecret: boolean
          biometryType?: 'touchId' | 'faceId' | 'none'
        }>
        save: (options: {
          secret: string
          minimumAndroidBiometric?: 'strong' | 'weak'
          callbackFunction?: string
        }) => Promise<{ success: boolean }>
        get: (options: {
          callbackFunction?: string
          minimumAndroidBiometric?: 'strong' | 'weak'
          prompt?: string
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
    const options: any = { secret };
    if (isAndroid()) {
      options.minimumAndroidBiometric = 'strong';
    }
    const result = await window.median!.auth!.save(options);
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

    const options: any = {
      prompt: promptText,
      callbackOnCancel: 1,
    };

    if (isAndroid()) {
      options.minimumAndroidBiometric = 'strong';
    }

    const result = await window.median!.auth!.get(options);

    if (result.success && result.secret) {
      return result.secret;
    }

    if (result.error === 'authenticationFailed') {
      throw new Error('authenticationFailed');
    }

    return null;
  } catch (error: any) {
    if (error.message === 'authenticationFailed') throw error;
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
