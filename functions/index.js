const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

exports.sendUserNotificationPush = onDocumentCreated(
  {
    document: 'users/{userId}/notifications/{notificationId}',
    region: 'us-central1',
    retry: true,
  },
  async (event) => {
    const notification = event.data?.data();
    const { userId, notificationId } = event.params;
    if (!notification || notification.read === true) return;

    const tokenSnapshot = await db.collection('users').doc(userId).collection('fcmTokens').get();
    const tokenDocs = tokenSnapshot.docs.filter((doc) => typeof doc.data().token === 'string' && doc.data().token.length > 0);
    if (tokenDocs.length === 0) {
      logger.info('No registered push devices for recipient', { userId, notificationId });
      return;
    }

    const title = String(notification.title || 'اعلان جدید هماهنگی').slice(0, 160);
    const body = String(notification.body || '').slice(0, 500);
    const payload = {
      notification: { title, body },
      data: {
        notificationId: String(notificationId),
        itemId: String(notification.itemId || ''),
        workspaceId: String(notification.workspaceId || ''),
        itemType: String(notification.itemType || 'system'),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'hamahangi_notifications',
          sound: 'default',
        },
      },
      webpush: {
        headers: { TTL: '3600', Urgency: 'high' },
        notification: {
          title,
          body,
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          dir: 'rtl',
          lang: 'fa',
          tag: String(notificationId),
          renotify: true,
        },
      },
      apns: {
        payload: { aps: { sound: 'default' } },
      },
    };

    const invalidTokens = [];
    for (let offset = 0; offset < tokenDocs.length; offset += 500) {
      const batch = tokenDocs.slice(offset, offset + 500);
      const response = await messaging.sendEachForMulticast({
        ...payload,
        tokens: batch.map((doc) => doc.data().token),
      });
      response.responses.forEach((result, index) => {
        if (!result.success) {
          const code = result.error?.code || '';
          if (code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-registration-token') {
            invalidTokens.push(batch[index].ref);
          } else {
            logger.warn('Push delivery failed for one device', { userId, code });
          }
        }
      });
    }

    if (invalidTokens.length) {
      await Promise.all(invalidTokens.map((ref) => ref.delete()));
    }
    logger.info('Push delivery processed', {
      userId,
      notificationId,
      registeredDevices: tokenDocs.length,
      invalidTokensRemoved: invalidTokens.length,
    });
  }
);
