/* Firebase Cloud Messaging worker with a dedicated scope, separate from the PWA cache worker. */
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBMFaz8U6gnWa6Pwfx1H0aoA2CS2DxziJA',
  authDomain: 'peak-amp-lxjsq.firebaseapp.com',
  projectId: 'peak-amp-lxjsq',
  storageBucket: 'peak-amp-lxjsq.firebasestorage.app',
  messagingSenderId: '47458957898',
  appId: '1:47458957898:web:d46cc525459a5f40a9c4b3',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'اعلان جدید هماهنگی';
  return self.registration.showNotification(title, {
    body: payload.notification?.body || '',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    dir: 'rtl',
    lang: 'fa',
    tag: payload.data?.notificationId || 'hamahangi-push',
    data: payload.data || {},
    renotify: true,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL('/', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.focus();
        client.postMessage({ type: 'HAMAHANGI_PUSH_CLICK', payload: event.notification.data });
        return;
      }
    }
    await clients.openWindow(target);
  })());
});
