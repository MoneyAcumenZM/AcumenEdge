import OneSignal from 'react-onesignal';

let initialized = false;

export async function initOneSignal(): Promise<void> {
  if (initialized) return;
  const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
  if (!appId) {
    console.warn('OneSignal App ID not configured');
    return;
  }
  try {
    await OneSignal.init({
      appId,
      allowLocalhostAsSecureOrigin: true,
    });
    initialized = true;
  } catch (error) {
    console.error('OneSignal init failed:', error);
  }
}

export async function linkUserToOneSignal(userId: string, email: string): Promise<void> {
  try {
    await OneSignal.login(userId);
    OneSignal.User.addEmail(email);
  } catch (error) {
    console.error('OneSignal link failed:', error);
  }
}

export async function unlinkUserFromOneSignal(): Promise<void> {
  try {
    await OneSignal.logout();
  } catch {}
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    await OneSignal.Notifications.requestPermission();
    return OneSignal.Notifications.permission;
  } catch {
    return false;
  }
}

export function getNotificationPermission(): boolean {
  try {
    return OneSignal.Notifications.permission;
  } catch {
    return false;
  }
}

export async function isOneSignalSubscribed(): Promise<boolean> {
  try {
    return OneSignal.User.PushSubscription.optedIn ?? false;
  } catch {
    return false;
  }
}

export async function optIn(): Promise<void> {
  await OneSignal.User.PushSubscription.optIn();
}

export async function optOut(): Promise<void> {
  await OneSignal.User.PushSubscription.optOut();
}

export function setUserTags(tags: Record<string, string>): void {
  try {
    OneSignal.User.addTags(tags);
  } catch {}
}

export function setupNotificationClickHandler(navigate: (path: string) => void): void {
  try {
    OneSignal.Notifications.addEventListener('click', (event: any) => {
      const url = event.notification.launchURL
        || (event.notification.additionalData as any)?.url;
      if (url) {
        const path = url.replace(window.location.origin, '');
        navigate(path);
      }
    });
  } catch {}
}

export function setupForegroundHandler(
  onNotification: (title: string, body: string) => void
): void {
  try {
    OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
      event.preventDefault();
      const { title, body } = event.notification;
      onNotification(title || 'AcumenEdge', body || '');
    });
  } catch {}
}

// ── Event Tracking for OneSignal ──────────────────────────────────────────
export function trackEvent(name: string, props?: Record<string, string>): void {
  try {
    OneSignal.User.addTags({
      last_event: name,
      last_event_time: new Date().toISOString(),
      ...(props || {}),
    });
    if ((OneSignal as any).addEvent) {
      (OneSignal as any).addEvent(name, props || {});
    }
  } catch {}
}
