import { Capacitor } from '@capacitor/core';

const SERVER = 'circle-app-auth';

export async function isBiometricAvailable(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    const result = await NativeBiometric.isAvailable();
    return result.isAvailable;
  } catch {
    return false;
  }
}

export async function enrollBiometric(email: string, refreshToken: string): Promise<boolean> {
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    // Verify the user can authenticate first
    await NativeBiometric.verifyIdentity({
      reason: 'Enable biometric login for Circle',
      title: 'Enable Biometric Login',
      subtitle: 'Use your fingerprint or face to sign in',
    });
    // Store the credentials securely
    await NativeBiometric.setCredentials({
      username: email,
      password: refreshToken,
      server: SERVER,
    });
    localStorage.setItem('biometric_enabled', 'true');
    return true;
  } catch {
    return false;
  }
}

export async function biometricSignIn(): Promise<{ email: string; refreshToken: string } | null> {
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    await NativeBiometric.verifyIdentity({
      reason: 'Sign in to Circle',
      title: 'Sign In',
      subtitle: 'Authenticate to access your account',
    });
    const creds = await NativeBiometric.getCredentials({ server: SERVER });
    return { email: creds.username, refreshToken: creds.password };
  } catch {
    return null;
  }
}

export async function clearBiometricCredentials(): Promise<void> {
  try {
    const { NativeBiometric } = await import('capacitor-native-biometric');
    await NativeBiometric.deleteCredentials({ server: SERVER });
  } catch {}
  localStorage.removeItem('biometric_enabled');
}

export function isBiometricEnrolled(): boolean {
  return localStorage.getItem('biometric_enabled') === 'true';
}
