import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { WorkspaceItem } from '../types/hamahangi';

export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';
export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

export function getNotificationPermission(): NotificationPermissionState {
  if (isNativePlatform()) return 'default';
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}
export async function refreshNotificationPermission(): Promise<NotificationPermissionState> {
  if (isNativePlatform()) {
    try {
      const p = await LocalNotifications.checkPermissions();
      return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'default';
    } catch { return 'unsupported'; }
  }
  return getNotificationPermission();
}
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (isNativePlatform()) {
    try {
      let p = await LocalNotifications.checkPermissions();
      if (p.display !== 'granted') p = await LocalNotifications.requestPermissions();
      if (p.display === 'granted' && Capacitor.getPlatform() === 'android') {
        const exact = await LocalNotifications.checkExactNotificationSetting();
        if (exact.exact_alarm !== 'granted') await LocalNotifications.changeExactNotificationSetting();
      }
      await LocalNotifications.createChannel({
        id: 'hamahangi_notifications', name: 'یادآوری‌های هماهنگی',
        description: 'یادآوری محلی جلسات، کارها و رویدادها', importance: 5,
        sound: 'default', vibration: true,
      });
      return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'default';
    } catch { return 'unsupported'; }
  }
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  try { return await Notification.requestPermission(); } catch { return Notification.permission; }
}
function numericId(value: string): number {
  let h = 2166136261;
  for (let i=0;i<value.length;i++) { h ^= value.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 2147483000 || 1;
}
export async function scheduleNativeReminders(items: WorkspaceItem[]): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== 'granted') return;
    await LocalNotifications.createChannel({
      id: 'hamahangi_notifications', name: 'یادآوری‌های هماهنگی',
      description: 'یادآوری محلی جلسات، کارها و رویدادها', importance: 5,
      sound: 'default', vibration: true,
    });
    const pending = await LocalNotifications.getPending();
    const owned = pending.notifications.filter(n => (n.extra as { source?: string } | undefined)?.source === 'hamahangi-reminder');
    if (owned.length) await LocalNotifications.cancel({ notifications: owned.map(n => ({ id: n.id })) });
    const now = Date.now();
    const notifications = items
      .filter(item => item.startTime && item.reminderMinutes > 0 && !['completed','cancelled'].includes(item.status))
      .map(item => {
        const start = new Date(`${item.gregorianDate}T${item.startTime}:00`);
        const at = new Date(start.getTime() - item.reminderMinutes * 60000);
        return { item, at };
      })
      .filter(x => !Number.isNaN(x.at.getTime()) && x.at.getTime() > now)
      .sort((a,b) => a.at.getTime() - b.at.getTime())
      .slice(0, 60)
      .map(({item,at}) => ({
        id: numericId(`reminder:${item.id}:${item.jalaliDate}:${item.startTime}`),
        title: `یادآوری: ${item.title}`,
        body: `تا ${item.reminderMinutes} دقیقه دیگر · ساعت ${item.startTime}`,
        schedule: { at },
        channelId: 'hamahangi_notifications',
        extra: { source: 'hamahangi-reminder', itemId: item.id, workspaceId: item.workspaceId },
      }));
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch (error) {
    console.error('Could not schedule local reminders', error);
  }
}
export function playNotificationChime(): void {
  // Browser/device notification sound is controlled by the operating system.
}
export async function showDeviceNotification(title: string, body: string, tag?: string): Promise<void> {
  if (isNativePlatform()) {
    try {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display !== 'granted') return;
      await LocalNotifications.schedule({ notifications: [{
        id: numericId(tag || `${title}:${Date.now()}`), title, body,
        schedule: { at: new Date(Date.now() + 250) },
        channelId: 'hamahangi_notifications', extra: { tag },
      }] });
    } catch (error) { console.error('Local notification failed', error); }
    return;
  }
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;
  const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body, icon: '/pwa-192x192.png', badge: '/pwa-192x192.png',
    tag: tag || 'hamahangi-alert', dir: 'rtl', lang: 'fa',
    vibrate: [180, 90, 180], renotify: true,
  };
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) await registration.showNotification(title, options);
    else new Notification(title, options);
  } catch { try { new Notification(title, options); } catch { /* in-app toast remains */ } }
}
