import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  ChecklistItem,
  ITEM_TYPE_LABELS,
  ItemPriority,
  ItemStatus,
  ItemType,
  NotificationActionStatus,
  SCHEMA_LIMITS,
  Workspace,
  WorkspaceInvite,
  WorkspaceItem,
  WorkspaceMember,
  WorkspaceRole,
} from '../types/hamahangi';
import { jalaliToGregorianStr, toPersianDigits } from '../lib/jalali';

function clampStr(value: string | null | undefined, maxLen: number): string {
  return (value ?? '').trim().slice(0, maxLen);
}

export function generateSafeId(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

export async function ensureUserProfile(user: User, defaultTitle?: string): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    const email = clampStr((user.email ?? '').toLowerCase(), SCHEMA_LIMITS.EMAIL_MAX);
    const displayName = clampStr(
      user.displayName || email.split('@')[0] || 'کاربر هماهنگی',
      SCHEMA_LIMITS.NAME_MAX
    );
    const photoURL = clampStr(user.photoURL, SCHEMA_LIMITS.PHOTO_MAX);

    if (!snap.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email,
        displayName,
        photoURL,
        defaultTitle: clampStr(defaultTitle || 'عضو تیم', SCHEMA_LIMITS.DEFAULT_TITLE_MAX),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const existingData = snap.data();
      await updateDoc(ref, {
        displayName,
        photoURL,
        defaultTitle: clampStr(
          defaultTitle ?? existingData.defaultTitle ?? 'عضو تیم',
          SCHEMA_LIMITS.DEFAULT_TITLE_MAX
        ),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserDefaultTitle(user: User, defaultTitle: string): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    await updateDoc(doc(db, 'users', user.uid), {
      displayName: clampStr(user.displayName || user.email?.split('@')[0] || 'کاربر', SCHEMA_LIMITS.NAME_MAX),
      photoURL: clampStr(user.photoURL, SCHEMA_LIMITS.PHOTO_MAX),
      defaultTitle: clampStr(defaultTitle, SCHEMA_LIMITS.DEFAULT_TITLE_MAX),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function createWorkspace(
  user: User,
  name: string,
  description: string
): Promise<string> {
  const workspaceId = generateSafeId('ws');
  const cleanName = clampStr(name, SCHEMA_LIMITS.NAME_MAX);
  const cleanDesc = clampStr(description, SCHEMA_LIMITS.WORKSPACE_DESC_MAX);
  const email = clampStr((user.email ?? '').toLowerCase(), SCHEMA_LIMITS.EMAIL_MAX);
  const displayName = clampStr(user.displayName || email.split('@')[0], SCHEMA_LIMITS.NAME_MAX);
  const photoURL = clampStr(user.photoURL, SCHEMA_LIMITS.PHOTO_MAX);

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'workspaces', workspaceId), {
      id: workspaceId,
      name: cleanName,
      description: cleanDesc,
      ownerUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'workspaces', workspaceId, 'members', user.uid), {
      uid: user.uid,
      email,
      displayName,
      photoURL,
      role: 'owner',
      inviteId: 'creator',
      joinedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'users', user.uid, 'memberships', workspaceId), {
      workspaceId,
      workspaceName: cleanName,
      role: 'owner',
      ownerUid: user.uid,
      joinedAt: serverTimestamp(),
    });

    await batch.commit();
    return workspaceId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `workspaces/${workspaceId}`);
  }
}

export async function inviteMemberByGmail(
  workspace: Workspace,
  inviter: User,
  invitedEmailRaw: string,
  role: 'executive' | 'coordinator' | 'member'
): Promise<string> {
  const inviteId = generateSafeId('inv');
  const invitedEmail = clampStr(invitedEmailRaw.toLowerCase(), SCHEMA_LIMITS.EMAIL_MAX);
  const inviterEmail = clampStr((inviter.email ?? '').toLowerCase(), SCHEMA_LIMITS.EMAIL_MAX);
  const inviterName = clampStr(inviter.displayName || inviterEmail.split('@')[0], SCHEMA_LIMITS.NAME_MAX);

  try {
    await setDoc(doc(db, 'workspaceInvites', inviteId), {
      id: inviteId,
      workspaceId: workspace.id,
      workspaceName: clampStr(workspace.name, SCHEMA_LIMITS.NAME_MAX),
      invitedEmail,
      invitedByUid: inviter.uid,
      invitedByName: inviterName,
      invitedByEmail: inviterEmail,
      role,
      status: 'pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return inviteId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `workspaceInvites/${inviteId}`);
  }
}

export async function acceptWorkspaceInvite(user: User, invite: WorkspaceInvite): Promise<void> {
  const email = clampStr((user.email ?? '').toLowerCase(), SCHEMA_LIMITS.EMAIL_MAX);
  const displayName = clampStr(user.displayName || email.split('@')[0], SCHEMA_LIMITS.NAME_MAX);
  const photoURL = clampStr(user.photoURL, SCHEMA_LIMITS.PHOTO_MAX);

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'workspaceInvites', invite.id), {
      status: 'accepted',
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'workspaces', invite.workspaceId, 'members', user.uid), {
      uid: user.uid,
      email,
      displayName,
      photoURL,
      role: invite.role,
      inviteId: invite.id,
      joinedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'users', user.uid, 'memberships', invite.workspaceId), {
      workspaceId: invite.workspaceId,
      workspaceName: clampStr(invite.workspaceName, SCHEMA_LIMITS.NAME_MAX),
      role: invite.role,
      ownerUid: invite.invitedByUid,
      joinedAt: serverTimestamp(),
    });

    await batch.commit();

    // Notify inviter after membership is established
    const notifId = generateSafeId('ntf');
    try {
      await setDoc(doc(db, 'users', invite.invitedByUid, 'notifications', notifId), {
        id: notifId,
        workspaceId: invite.workspaceId,
        workspaceName: clampStr(invite.workspaceName, SCHEMA_LIMITS.NAME_MAX),
        itemId: invite.id,
        itemType: 'invite',
        title: clampStr(`${displayName} به گروه «${invite.workspaceName}» پیوست`, SCHEMA_LIMITS.NOTIF_TITLE_MAX),
        body: clampStr(`دعوت‌نامه جیمیل (${email}) تأیید شد و اکنون همگام‌سازی لحظه‌ای فعال است.`, SCHEMA_LIMITS.NOTIF_BODY_MAX),
        senderUid: user.uid,
        senderName: displayName,
        senderEmail: email,
        read: false,
        actionStatus: 'confirmed',
        createdAt: serverTimestamp(),
      });
    } catch {
      // Non-critical if inviter left workspace
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `workspaceInvites/${invite.id}`);
  }
}

export async function declineWorkspaceInvite(inviteId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'workspaceInvites', inviteId), {
      status: 'declined',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `workspaceInvites/${inviteId}`);
  }
}

export async function updateMemberRole(
  workspaceId: string,
  memberUid: string,
  role: 'executive' | 'coordinator' | 'member'
): Promise<void> {
  const path = `workspaces/${workspaceId}/members/${memberUid}`;
  try {
    await updateDoc(doc(db, 'workspaces', workspaceId, 'members', memberUid), {
      role,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function removeWorkspaceMember(workspaceId: string, memberUid: string): Promise<void> {
  const path = `workspaces/${workspaceId}/members/${memberUid}`;
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'workspaces', workspaceId, 'members', memberUid));
    batch.delete(doc(db, 'users', memberUid, 'memberships', workspaceId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export interface SaveItemInput {
  type: ItemType;
  title: string;
  description: string;
  jalaliDate: string;
  startTime: string;
  endTime: string;
  location: string;
  meetingLink: string;
  priority: ItemPriority;
  status: ItemStatus;
  assigneeEmail: string;
  assigneeName: string;
  assigneeUid: string;
  agenda: string;
  minutes: string;
  checklist: ChecklistItem[];
  notifyMembers: boolean;
  reminderMinutes: number;
}

export async function saveWorkspaceItem(
  workspace: Workspace,
  members: WorkspaceMember[],
  currentUser: User,
  input: SaveItemInput,
  existingItem?: WorkspaceItem | null
): Promise<string> {
  const itemId = existingItem?.id ?? generateSafeId('itm');
  const path = `workspaces/${workspace.id}/items/${itemId}`;
  const gregorianDate = jalaliToGregorianStr(input.jalaliDate);
  const sanitizedChecklist = input.checklist.slice(0, SCHEMA_LIMITS.CHECKLIST_MAX).map((c) => ({
    id: clampStr(c.id, 64),
    text: clampStr(c.text, SCHEMA_LIMITS.CHECKLIST_TEXT_MAX),
    done: Boolean(c.done),
  }));

  const creatorEmail = clampStr((currentUser.email ?? '').toLowerCase(), SCHEMA_LIMITS.EMAIL_MAX);
  const creatorName = clampStr(
    currentUser.displayName || creatorEmail.split('@')[0],
    SCHEMA_LIMITS.NAME_MAX
  );

  try {
    if (existingItem) {
      await updateDoc(doc(db, 'workspaces', workspace.id, 'items', itemId), {
        type: input.type,
        title: clampStr(input.title, SCHEMA_LIMITS.TITLE_MAX),
        description: clampStr(input.description, SCHEMA_LIMITS.DESC_MAX),
        jalaliDate: input.jalaliDate,
        gregorianDate,
        startTime: clampStr(input.startTime, 5),
        endTime: clampStr(input.endTime, 5),
        location: clampStr(input.location, SCHEMA_LIMITS.LOCATION_MAX),
        meetingLink: clampStr(input.meetingLink, SCHEMA_LIMITS.LINK_MAX),
        priority: input.priority,
        status: input.status,
        assigneeEmail: clampStr(input.assigneeEmail, SCHEMA_LIMITS.EMAIL_MAX),
        assigneeName: clampStr(input.assigneeName, SCHEMA_LIMITS.NAME_MAX),
        assigneeUid: clampStr(input.assigneeUid, SCHEMA_LIMITS.ID_MAX),
        agenda: clampStr(input.agenda, SCHEMA_LIMITS.AGENDA_MAX),
        minutes: clampStr(input.minutes, SCHEMA_LIMITS.MINUTES_MAX),
        checklist: sanitizedChecklist,
        notifyMembers: input.notifyMembers,
        reminderMinutes: Math.max(0, Math.min(1440, Math.round(input.reminderMinutes))),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'workspaces', workspace.id, 'items', itemId), {
        id: itemId,
        workspaceId: workspace.id,
        type: input.type,
        title: clampStr(input.title, SCHEMA_LIMITS.TITLE_MAX),
        description: clampStr(input.description, SCHEMA_LIMITS.DESC_MAX),
        jalaliDate: input.jalaliDate,
        gregorianDate,
        startTime: clampStr(input.startTime, 5),
        endTime: clampStr(input.endTime, 5),
        location: clampStr(input.location, SCHEMA_LIMITS.LOCATION_MAX),
        meetingLink: clampStr(input.meetingLink, SCHEMA_LIMITS.LINK_MAX),
        priority: input.priority,
        status: input.status,
        assigneeEmail: clampStr(input.assigneeEmail, SCHEMA_LIMITS.EMAIL_MAX),
        assigneeName: clampStr(input.assigneeName, SCHEMA_LIMITS.NAME_MAX),
        assigneeUid: clampStr(input.assigneeUid, SCHEMA_LIMITS.ID_MAX),
        agenda: clampStr(input.agenda, SCHEMA_LIMITS.AGENDA_MAX),
        minutes: clampStr(input.minutes, SCHEMA_LIMITS.MINUTES_MAX),
        checklist: sanitizedChecklist,
        confirmedUids: [currentUser.uid],
        declinedUids: [],
        notifyMembers: input.notifyMembers,
        reminderMinutes: Math.max(0, Math.min(1440, Math.round(input.reminderMinutes))),
        createdByUid: currentUser.uid,
        createdByName: creatorName,
        createdByEmail: creatorEmail,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    if (input.notifyMembers) {
      const otherMembers = members.filter((m) => m.uid !== currentUser.uid);
      if (otherMembers.length > 0) {
        const typeLabel = ITEM_TYPE_LABELS[input.type];
        const verb = existingItem ? 'به‌روزرسانی شد' : 'ثبت شد';
        const timeText = input.startTime ? ` · ساعت ${toPersianDigits(input.startTime)}` : '';
        const notifTitle = clampStr(
          `${typeLabel} جدید: ${input.title}`,
          SCHEMA_LIMITS.NOTIF_TITLE_MAX
        );
        const notifBody = clampStr(
          `${creatorName} این ${typeLabel} را برای تاریخ ${toPersianDigits(input.jalaliDate)}${timeText} ${verb}.${input.location ? ` محل: ${input.location}` : ''}`,
          SCHEMA_LIMITS.NOTIF_BODY_MAX
        );

        const batch = writeBatch(db);
        for (const member of otherMembers) {
          const notifId = generateSafeId('ntf');
          batch.set(doc(db, 'users', member.uid, 'notifications', notifId), {
            id: notifId,
            workspaceId: workspace.id,
            workspaceName: clampStr(workspace.name, SCHEMA_LIMITS.NAME_MAX),
            itemId,
            itemType: input.type,
            title: notifTitle,
            body: notifBody,
            senderUid: currentUser.uid,
            senderName: creatorName,
            senderEmail: creatorEmail,
            read: false,
            actionStatus: 'pending',
            createdAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }
    }

    return itemId;
  } catch (error) {
    handleFirestoreError(error, existingItem ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function updateItemStatus(
  workspace: Workspace,
  members: WorkspaceMember[],
  currentUser: User,
  item: WorkspaceItem,
  status: ItemStatus
): Promise<void> {
  const path = `workspaces/${workspace.id}/items/${item.id}`;
  try {
    await updateDoc(doc(db, 'workspaces', workspace.id, 'items', item.id), {
      status,
      updatedAt: serverTimestamp(),
    });

    if (status === 'completed' || status === 'cancelled') {
      const others = members.filter((m) => m.uid !== currentUser.uid);
      if (others.length > 0) {
        const actorName = clampStr(
          currentUser.displayName || currentUser.email?.split('@')[0] || 'همکار',
          SCHEMA_LIMITS.NAME_MAX
        );
        const actorEmail = clampStr((currentUser.email ?? '').toLowerCase(), SCHEMA_LIMITS.EMAIL_MAX);
        const stateLabel = status === 'completed' ? 'تکمیل شد' : 'لغو شد';
        const batch = writeBatch(db);
        for (const m of others) {
          const notifId = generateSafeId('ntf');
          batch.set(doc(db, 'users', m.uid, 'notifications', notifId), {
            id: notifId,
            workspaceId: workspace.id,
            workspaceName: clampStr(workspace.name, SCHEMA_LIMITS.NAME_MAX),
            itemId: item.id,
            itemType: item.type,
            title: clampStr(`${item.title} — ${stateLabel}`, SCHEMA_LIMITS.NOTIF_TITLE_MAX),
            body: clampStr(`${actorName} وضعیت این مورد را به «${stateLabel}» تغییر داد.`, SCHEMA_LIMITS.NOTIF_BODY_MAX),
            senderUid: currentUser.uid,
            senderName: actorName,
            senderEmail: actorEmail,
            read: false,
            actionStatus: status === 'completed' ? 'done' : 'none',
            createdAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function respondToItemAttendance(
  workspace: Workspace,
  members: WorkspaceMember[],
  currentUser: User,
  item: WorkspaceItem,
  response: 'accepted' | 'declined'
): Promise<void> {
  const path = `workspaces/${workspace.id}/items/${item.id}`;
  const confirmed = new Set(item.confirmedUids || []);
  const declined = new Set(item.declinedUids || []);

  if (response === 'accepted') {
    confirmed.add(currentUser.uid);
    declined.delete(currentUser.uid);
  } else {
    declined.add(currentUser.uid);
    confirmed.delete(currentUser.uid);
  }

  try {
    await updateDoc(doc(db, 'workspaces', workspace.id, 'items', item.id), {
      confirmedUids: Array.from(confirmed).slice(0, SCHEMA_LIMITS.UID_LIST_MAX),
      declinedUids: Array.from(declined).slice(0, SCHEMA_LIMITS.UID_LIST_MAX),
      updatedAt: serverTimestamp(),
    });

    if (item.createdByUid !== currentUser.uid && members.some((m) => m.uid === item.createdByUid)) {
      const actorName = clampStr(
        currentUser.displayName || currentUser.email?.split('@')[0] || 'همکار',
        SCHEMA_LIMITS.NAME_MAX
      );
      const actorEmail = clampStr((currentUser.email ?? '').toLowerCase(), SCHEMA_LIMITS.EMAIL_MAX);
      const notifId = generateSafeId('ntf');
      const verb = response === 'accepted' ? 'حضور و رؤیت را تأیید کرد' : 'عدم امکان حضور را اعلام کرد';
      await setDoc(doc(db, 'users', item.createdByUid, 'notifications', notifId), {
        id: notifId,
        workspaceId: workspace.id,
        workspaceName: clampStr(workspace.name, SCHEMA_LIMITS.NAME_MAX),
        itemId: item.id,
        itemType: item.type,
        title: clampStr(`پاسخ ${actorName} به «${item.title}»`, SCHEMA_LIMITS.NOTIF_TITLE_MAX),
        body: clampStr(`${actorName} ${verb}.`, SCHEMA_LIMITS.NOTIF_BODY_MAX),
        senderUid: currentUser.uid,
        senderName: actorName,
        senderEmail: actorEmail,
        read: false,
        actionStatus: response === 'accepted' ? 'confirmed' : 'declined',
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function toggleItemChecklist(
  workspaceId: string,
  item: WorkspaceItem,
  checklistId: string
): Promise<void> {
  const path = `workspaces/${workspaceId}/items/${item.id}`;
  const updated = item.checklist.map((entry) =>
    entry.id === checklistId ? { ...entry, done: !entry.done } : entry
  );
  try {
    await updateDoc(doc(db, 'workspaces', workspaceId, 'items', item.id), {
      checklist: updated,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateItemMinutes(
  workspaceId: string,
  itemId: string,
  minutes: string
): Promise<void> {
  const path = `workspaces/${workspaceId}/items/${itemId}`;
  try {
    await updateDoc(doc(db, 'workspaces', workspaceId, 'items', itemId), {
      minutes: clampStr(minutes, SCHEMA_LIMITS.MINUTES_MAX),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteWorkspaceItem(workspaceId: string, itemId: string): Promise<void> {
  const path = `workspaces/${workspaceId}/items/${itemId}`;
  try {
    await deleteDoc(doc(db, 'workspaces', workspaceId, 'items', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function markNotificationRead(
  userId: string,
  notificationId: string,
  actionStatus?: NotificationActionStatus
): Promise<void> {
  const path = `users/${userId}/notifications/${notificationId}`;
  try {
    const payload: { read: boolean; actionStatus?: NotificationActionStatus } = { read: true };
    if (actionStatus) payload.actionStatus = actionStatus;
    await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteNotification(userId: string, notificationId: string): Promise<void> {
  const path = `users/${userId}/notifications/${notificationId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'notifications', notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function getRoleDisplayLabel(role: WorkspaceRole): string {
  switch (role) {
    case 'owner':
      return 'مالک و مدیر گروه';
    case 'executive':
      return 'رییس / مدیر ارشد';
    case 'coordinator':
      return 'مسئول دفتر / هماهنگ‌کننده';
    default:
      return 'عضو تیم';
  }
}
