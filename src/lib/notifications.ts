import { Capacitor } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PushNotifications } from '@capacitor/push-notifications';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getApp } from 'firebase/app';
import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { db } from './firebase';
import type { WorkspaceItem } from '../types/hamahangi';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

export async function refreshNotificationPermission(): Promise<NotificationPermissionState> {
  if (isNativePlatform()) {
    try {
      const permission = await LocalNotifications.checkPermissions();
      return permission.display === 'granted' ? 'granted' : permission.display === 'denied' ? 'denied' : 'default';
    } catch {
      return 'unsupported';
    }
  }
  return getNotificationPermission();
}

export function getNotificationPermission(): NotificationPermissionState {
  if (isNativePlatform()) return 'default';
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (isNativePlatform()) {
    try {
      let permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions();
      if (permission.display === 'granted' && Capacitor.getPlatform() === 'android') {
        const exact = await LocalNotifications.checkExactNotificationSetting();
        if (exact.exact_alarm !== 'granted') {
          await LocalNotifications.changeExactNotificationSetting();
        }
      }
      return permission.display === 'granted' ? 'granted' : permission.display === 'denied' ? 'denied' : 'default';
    } catch {
      return 'unsupported';
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function tokenDocumentId(token: string): string {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

async function savePushToken(userId: string, token: string, platform: 'web' | 'android' | 'ios') {
  const tokenId = tokenDocumentId(token);
  await setDoc(doc(db, 'users', userId, 'fcmTokens', tokenId), {
    token,
    platform,
    updatedAt: serverTimestamp(),
  }, { merge: true });
  localStorage.setItem(`hamahangi_fcm_token_${userId}`, tokenId);
}

export async function unregisterDevicePush(userId: string): Promise<void> {
  const tokenId = localStorage.getItem(`hamahangi_fcm_token_${userId}`);
  if (!tokenId) return;
  try {
    await deleteDoc(doc(db, 'users', userId, 'fcmTokens', tokenId));
    localStorage.removeItem(`hamahangi_fcm_token_${userId}`);
  } catch (error) {
    console.warn('Could not remove device token before sign-out', error);
  }
}

export async function setupDevicePush(userId: string): Promise<() => void> {
  if (isNativePlatform()) {
    await LocalNotifications.createChannel({
      id: 'hamahangi_notifications',
      name: 'اعلان‌های هماهنگی',
      description: 'اعلان‌های گروه کاری و پیام‌های جدید',
      importance: 5,
      sound: 'default',
      vibration: true,
    });
    const listeners: PluginListenerHandle[] = [];
    listeners.push(await PushNotifications.addListener('registration', ({ value }) => {
      void savePushToken(userId, value, Capacitor.getPlatform() === 'ios' ? 'ios' : 'android')
        .catch((error) => console.error('FCM token save failed', error));
    }));
    listeners.push(await PushNotifications.addListener('registrationError', (error) => {
      console.error('FCM registration failed', error);
    }));
    listeners.push(await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      const title = notification.title || 'اعلان جدید هماهنگی';
      const body = notification.body || '';
      void LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Date.now() % 2147483000),
          title,
          body,
          schedule: { at: new Date(Date.now() + 300) },
          channelId: 'hamahangi_notifications',
          extra: notification.data,
        }],
      }).catch((error) => console.error('Foreground push display failed', error));
    }));
    try {
      const permission = await PushNotifications.checkPermissions();
      if (permission.receive === 'granted') await PushNotifications.register();
    } catch (error) {
      console.warn('Native FCM is not configured or registration is unavailable', error);
    }
    return () => { listeners.forEach((listener) => void listener.remove()); };
  }

  let unsubscribeMessage: (() => void) | undefined;
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted' && await isSupported()) {
      const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
      if (vapidKey) {
        const registration = await navigator.serviceWorker.register('/firebase-messaging/firebase-messaging-sw.js', { scope: '/firebase-messaging/' });
        const messaging = getMessaging(getApp());
        const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
        if (token) await savePushToken(userId, token, 'web');
      }
    }
  } catch (error) {
    console.warn('Web push setup is not available yet', error);
  }
  return () => unsubscribeMessage?.();
}

export async function enableRemotePush(userId: string): Promise<boolean> {
  if (isNativePlatform()) {
    try {
      let permission = await PushNotifications.checkPermissions();
      if (permission.receive !== 'granted') permission = await PushNotifications.requestPermissions();
      if (permission.receive !== 'granted') return false;
      await PushNotifications.register();
      return true;
    } catch (error) {
      console.error('Native FCM registration is unavailable', error);
      return false;
    }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;
  try {
    if (!(await isSupported())) return false;
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) return false;
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const messaging = getMessaging(getApp());
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
    if (!token) return false;
    await savePushToken(userId, token, 'web');
    return true;
  } catch (error) {
    console.error('Could not enable remote push', error);
    return false;
  }
}

function reminderId(item: WorkspaceItem): number {
  const source = `${item.id}|${item.gregorianDate}|${item.startTime}`;
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2147483000 + 1;
}

let reminderScheduleQueue: Promise<void> = Promise.resolve();

export function scheduleNativeReminders(items: WorkspaceItem[]): Promise<void> {
  if (!isNativePlatform()) return Promise.resolve();
  const itemSnapshot = [...items];
  reminderScheduleQueue = reminderScheduleQueue.then(async () => {
    await LocalNotifications.createChannel({
      id: 'hamahangi_reminders',
      name: 'یادآوری جلسات و کارها',
      description: 'یادآوری زمان شروع جلسه‌ها و کارهای برنامه‌ریزی‌شده',
      importance: 5,
      sound: 'default',
      vibration: true,
    });
    const pending = await LocalNotifications.getPending();
    const oldReminders = pending.notifications
      .filter((notification) => notification.extra?.source === 'hamahangi-reminder')
      .map((notification) => ({ id: notification.id }));
    if (oldReminders.length) await LocalNotifications.cancel({ notifications: oldReminders });

    const now = Date.now();
    const notifications = itemSnapshot
      .filter((item) =>
        item.status !== 'completed' &&
        item.status !== 'cancelled' &&
        Boolean(item.startTime) &&
        Number(item.reminderMinutes) > 0
      )
      .map((item) => {
        const at = new Date(`${item.gregorianDate}T${item.startTime}:00`);
        at.setMinutes(at.getMinutes() - Number(item.reminderMinutes));
        return { item, at };
      })
      .filter(({ at }) => Number.isFinite(at.getTime()) && at.getTime() > now)
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, 450)
      .map(({ item, at }) => ({
        id: reminderId(item),
        title: `یادآوری: ${item.title}`,
        body: `${item.reminderMinutes} دقیقه تا شروع ${item.type === 'meeting' ? 'جلسه' : item.type === 'task' ? 'کار' : 'رویداد'} — ساعت ${item.startTime}`,
        schedule: { at, allowWhileIdle: true },
        channelId: 'hamahangi_reminders',
        extra: { source: 'hamahangi-reminder', itemId: item.id, workspaceId: item.workspaceId },
      }));
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  }).catch((error) => {
    console.error('Native reminder scheduling failed', error);
  });
  return reminderScheduleQueue;
}

export function playNotificationChime(): void {
  if (isNativePlatform()) return;
  try {
    const AudioCtx = window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, now);
    osc.frequency.setValueAtTime(880, now + 0.09);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.36);
  } catch {
    // Audio is optional and may be blocked by browser autoplay policy.
  }
}

export async function showDeviceNotification(title: string, body: string, tag?: string): Promise<void> {
  if (isNativePlatform()) {
    try {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') return;
      await LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Date.now() % 2147483000),
          title,
          body,
          schedule: { at: new Date(Date.now() + 300) },
          channelId: 'hamahangi_notifications',
          extra: { tag },
        }],
      });
    } catch (error) {
      console.error('Native notification failed', error);
    }
    return;
  }

  playNotificationChime();
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
  const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body, icon: '/pwa-192x192.png', badge: '/pwa-192x192.png',
    tag: tag || 'hamahangi-alert', dir: 'rtl', lang: 'fa',
    vibrate: [180, 90, 180], renotify: true,
  };
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
    new Notification(title, options);
  } catch {
    try { new Notification(title, options); } catch { /* In-app toast remains available. */ }
  }
}
