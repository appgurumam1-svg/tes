import { remoteEnabled, scheduleApi } from './api';

const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() ?? '';

export const pushSupported =
  remoteEnabled &&
  VAPID_PUBLIC_KEY.length > 0 &&
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return buffer;
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function enablePush(): Promise<void> {
  if (!pushSupported) throw new Error('Push notification tidak didukung browser ini.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Izin notifikasi ditolak.');

  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  await scheduleApi.subscribePush(subscription.toJSON());
}

export async function disablePush(): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await scheduleApi.unsubscribePush(subscription.endpoint).catch(() => undefined);
  await subscription.unsubscribe();
}
