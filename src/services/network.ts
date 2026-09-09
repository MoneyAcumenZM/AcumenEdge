import { Capacitor } from '@capacitor/core';

export async function initNetworkMonitoring(
  onOffline: () => void,
  onOnline: () => void
) {
  if (!Capacitor.isNativePlatform()) {
    // Web fallback
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return;
  }

  try {
    const { Network } = await import('@capacitor/network');
    Network.addListener('networkStatusChange', (status) => {
      if (!status.connected) onOffline();
      else onOnline();
    });
  } catch (e) {
    console.log('Network monitoring not available:', e);
  }
}
