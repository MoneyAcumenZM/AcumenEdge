import { Capacitor } from '@capacitor/core';

/** Set up notification listeners and register push token if already permitted */
export async function initNotifications() {
  if (Capacitor.isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      PushNotifications.addListener('registration', async (token) => {
        console.log('Push registration token:', token.value);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        const type = action.notification.data?.type;
        if (type === 'trade') window.location.href = '/my-orders';
        if (type === 'price') window.location.href = '/market';
        if (type === 'deposit') window.location.href = '/portfolio';
        if (type === 'withdraw') window.location.href = '/portfolio';
        if (type === 'market') window.location.href = '/market';
      });

      const perm = await PushNotifications.checkPermissions();
      if (perm.receive === 'granted') {
        await PushNotifications.register();
      }
    } catch (e) {
      console.log('Push notification listeners not available:', e);
    }
  }
}

/** Check if we should show the in-app permission banner */
export function shouldShowNotificationPrompt(): boolean {
  // Don't show if user already dismissed this session
  if (sessionStorage.getItem('circle_notif_dismissed')) return false;

  if (Capacitor.isNativePlatform()) {
    // On native, always show the banner until OS permission is granted.
    // This lets users retry from the app after previous denied flows.
    return localStorage.getItem('circle_notif_native_granted') !== '1';
  }

  // Web: don't show if already resolved/granted/denied permanently
  if (localStorage.getItem('circle_notif_resolved')) return false;
  if (!('Notification' in window)) return false;
  if (Notification.permission !== 'default') return false;
  return true;
}

/** Request notification permission (native + web) */
export async function requestWebNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive === 'granted') {
        await PushNotifications.register();
        localStorage.setItem('circle_notif_native_granted', '1');
        localStorage.setItem('circle_notif_resolved', '1');
        return true;
      }
      // Do not permanently suppress native banner when not granted.
      localStorage.removeItem('circle_notif_native_granted');
      return false;
    } catch (e) {
      console.log('Native push permission failed:', e);
      return false;
    }
  }

  if (!('Notification' in window)) return false;
  const result = await Notification.requestPermission();
  localStorage.setItem('circle_notif_resolved', '1');
  return result === 'granted';
}

export async function notify(title: string, body: string, type: string) {
  if (Capacitor.isNativePlatform()) {
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.schedule({
        notifications: [{
          id: Date.now(),
          title,
          body,
          extra: { type },
          sound: 'default',
          channelId: 'circle-trading'
        }]
      });
    } catch (e) {
      console.log('Local notifications not available:', e);
    }
  } else if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, icon: '/favicon.ico' });
    } catch {
      // Notification constructor may fail in some contexts
    }
  }
}
