import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function isPushSupported(): Promise<boolean> {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export async function getPushPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

export async function requestPushPermission(): Promise<boolean> {
  if (!await isPushSupported()) return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
}

export async function subscribeToPush(userId: string): Promise<boolean> {
  try {
    if (!await isPushSupported()) return false;
    if (Notification.permission !== 'granted') return false;
    if (!VAPID_PUBLIC_KEY) {
      console.warn('VAPID public key not configured');
      return false;
    }

    const registration = await navigator.serviceWorker.ready;

    const existingSubscription = await registration.pushManager.getSubscription();
    if (existingSubscription) {
      await savePushSubscription(userId, existingSubscription);
      return true;
    }

    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
    });

    await savePushSubscription(userId, subscription);
    return true;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return false;
  }
}

async function savePushSubscription(userId: string, subscription: PushSubscription): Promise<void> {
  const subscriptionData = subscription.toJSON();

  await supabase
    .from('push_subscriptions' as any)
    .upsert({
      user_id: userId,
      endpoint: subscriptionData.endpoint,
      p256dh: subscriptionData.keys?.p256dh,
      auth: subscriptionData.keys?.auth,
      device_info: navigator.userAgent,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: 'user_id,endpoint' });
}

export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
      await supabase
        .from('push_subscriptions' as any)
        .delete()
        .eq('user_id', userId)
        .eq('endpoint', subscription.endpoint);
    }
    return true;
  } catch {
    return false;
  }
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!await isPushSupported()) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}

/** Send push + in-app notification */
export async function sendNotification(params: {
  userId: string;
  title: string;
  body: string;
  type: string;
  url?: string;
  tag?: string;
  requireInteraction?: boolean;
}): Promise<void> {
  await Promise.all([
    supabase.from('notifications').insert({
      user_id: params.userId,
      title: params.title,
      body: params.body,
      type: params.type,
    }),
    supabase.functions.invoke('send-push-notification', {
      body: {
        userId: params.userId,
        title: params.title,
        body: params.body,
        url: params.url || '/',
        tag: params.tag,
        requireInteraction: params.requireInteraction || false,
      },
    }),
  ]);
}
