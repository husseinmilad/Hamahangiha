import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const owner = { uid: 'userA', email: 'owner@example.com', email_verified: true };
const member = { uid: 'userB', email: 'member@example.com', email_verified: true };
const coordinator = { uid: 'userC', email: 'coordinator@example.com', email_verified: true };
const outsider = { uid: 'userD', email: 'outsider@example.com', email_verified: true };

async function seedWorkspace() {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'workspaces/ws1'), {
      id: 'ws1', name: 'گروه آزمایشی', description: '', ownerUid: owner.uid,
      createdAt: new Date(), updatedAt: new Date(),
    });
    for (const [uid, email, role] of [
      [owner.uid, owner.email, 'owner'],
      [member.uid, member.email, 'member'],
      [coordinator.uid, coordinator.email, 'coordinator'],
    ]) {
      await setDoc(doc(db, 'workspaces/ws1/members', uid), {
        uid, email, displayName: uid, photoURL: '', role, inviteId: 'creator', joinedAt: new Date(),
      });
      await setDoc(doc(db, 'users', uid, 'memberships', 'ws1'), {
        workspaceId: 'ws1', workspaceName: 'گروه آزمایشی', role,
        ownerUid: owner.uid, joinedAt: new Date(),
      });
    }
  });
}

function notificationPayload(senderUid: string, senderEmail: string) {
  return {
    id: 'notice1',
    workspaceId: 'ws1',
    workspaceName: 'گروه آزمایشی',
    itemId: 'item1',
    itemType: 'meeting',
    title: 'جلسه آزمایشی',
    body: 'اعلان آزمایشی',
    senderUid,
    senderName: senderUid,
    senderEmail,
    read: false,
    actionStatus: 'none',
    createdAt: serverTimestamp(),
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'hamahangi-rules-test',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await seedWorkspace();
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('Firestore security rules', () => {
  it('allows a verified user to register their own FCM token', async () => {
    const db = testEnv.authenticatedContext(owner.uid, {
      email: owner.email, email_verified: true,
    }).firestore();
    await assertSucceeds(setDoc(doc(db, 'users/userA/fcmTokens/device1'), {
      token: 'fcm-token-example', platform: 'android', updatedAt: serverTimestamp(),
    }));
  });

  it('prevents a user from registering a token under another account', async () => {
    const db = testEnv.authenticatedContext(owner.uid, {
      email: owner.email, email_verified: true,
    }).firestore();
    await assertFails(setDoc(doc(db, 'users/userB/fcmTokens/device1'), {
      token: 'stolen-token', platform: 'android', updatedAt: serverTimestamp(),
    }));
  });

  it('keeps device tokens private to the account owner', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'users/userA/fcmTokens/device1'), {
        token: 'private-token', platform: 'web', updatedAt: new Date(),
      });
    });
    const db = testEnv.authenticatedContext(member.uid, {
      email: member.email, email_verified: true,
    }).firestore();
    await assertFails(getDoc(doc(db, 'users/userA/fcmTokens/device1')));
  });

  it('allows a verified workspace member to notify another member', async () => {
    const db = testEnv.authenticatedContext(owner.uid, {
      email: owner.email, email_verified: true,
    }).firestore();
    await assertSucceeds(setDoc(
      doc(collection(db, 'users/userB/notifications'), 'notice1'),
      notificationPayload(owner.uid, owner.email),
    ));
  });

  it('blocks notification spam from a non-member', async () => {
    const db = testEnv.authenticatedContext(outsider.uid, {
      email: outsider.email, email_verified: true,
    }).firestore();
    await assertFails(setDoc(
      doc(collection(db, 'users/userB/notifications'), 'notice1'),
      notificationPayload(outsider.uid, outsider.email),
    ));
  });

  it('allows a workspace owner to remove a non-owner membership', async () => {
    const db = testEnv.authenticatedContext(owner.uid, {
      email: owner.email, email_verified: true,
    }).firestore();
    await assertSucceeds(deleteDoc(doc(db, 'users/userB/memberships/ws1')));
  });

  it('prevents another workspace administrator from deleting the owner membership', async () => {
    const db = testEnv.authenticatedContext(coordinator.uid, {
      email: coordinator.email, email_verified: true,
    }).firestore();
    await assertFails(deleteDoc(doc(db, 'users/userA/memberships/ws1')));
  });
});
