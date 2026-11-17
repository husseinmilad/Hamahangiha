export type NotificationPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  try {
    const result = await Notification.requestPermission();
    return result;
  } catch {
    return Notification.permission;
  }
}

export function playNotificationChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, now); // E5
    osc1.frequency.setValueAtTime(880, now + 0.09); // A5
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.36);
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

export async function showDeviceNotification(title: string, body: string, tag?: string): Promise<void> {
  playNotificationChime();

  if (typeof window === 'undefined' || !('Notification' in window)) {
    return;
  }
  if (Notification.permission !== 'granted') {
    return;
  }

  const options: NotificationOptions & { vibrate?: number[]; renotify?: boolean } = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: tag || 'hamahangi-alert',
    dir: 'rtl',
    lang: 'fa',
    vibrate: [180, 90, 180],
    renotify: true,
  };

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(title, options);
        return;
      }
    }
    new Notification(title, options);
  } catch {
    try {
      new Notification(title, options);
    } catch {
      // Fallback handled by in-app toast
    }
  }
}
