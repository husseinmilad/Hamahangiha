import { supabase } from '../lib/supabase';
import {
  AppUser, ChecklistItem, ITEM_TYPE_LABELS, ItemPriority, ItemStatus, ItemType,
  NotificationActionStatus, SCHEMA_LIMITS, Workspace, WorkspaceInvite,
  WorkspaceItem, WorkspaceMember, WorkspaceRole,
} from '../types/hamahangi';
import { jalaliToGregorianStr, toPersianDigits } from '../lib/jalali';

function clampStr(value: string | null | undefined, maxLen: number): string {
  return (value ?? '').trim().slice(0, maxLen);
}
function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}
export function generateSafeId(prefix = 'id'): string {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 16)
    : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}
export async function ensureUserProfile(user: AppUser): Promise<void> {
  const { error } = await supabase.from('profiles').upsert({
    id: user.uid,
    email: clampStr(user.email?.toLowerCase(), SCHEMA_LIMITS.EMAIL_MAX),
    display_name: clampStr(user.displayName, SCHEMA_LIMITS.NAME_MAX),
    photo_url: clampStr(user.photoURL, SCHEMA_LIMITS.PHOTO_MAX),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id', ignoreDuplicates: true });
  throwIfError(error);
}
export async function updateUserDefaultTitle(user: AppUser, defaultTitle: string): Promise<void> {
  const { error } = await supabase.from('profiles').update({
    display_name: clampStr(user.displayName || user.email?.split('@')[0] || 'کاربر', SCHEMA_LIMITS.NAME_MAX),
    photo_url: clampStr(user.photoURL, SCHEMA_LIMITS.PHOTO_MAX),
    default_title: clampStr(defaultTitle, SCHEMA_LIMITS.DEFAULT_TITLE_MAX),
    updated_at: new Date().toISOString(),
  }).eq('id', user.uid);
  throwIfError(error);
}
export async function createWorkspace(_user: AppUser, name: string, description: string): Promise<string> {
  const id = generateSafeId('ws');
  const { data, error } = await supabase.rpc('create_workspace', {
    p_id: id,
    p_name: clampStr(name, SCHEMA_LIMITS.NAME_MAX),
    p_description: clampStr(description, SCHEMA_LIMITS.WORKSPACE_DESC_MAX),
  });
  throwIfError(error);
  return (data as string) || id;
}
export type ConfigurableWorkspaceRole = 'executive' | 'coordinator' | 'member';
export type WorkspacePermissionKey = 'manage_items' | 'delete_items' | 'invite_members' | 'manage_members' | 'edit_workspace';
export type WorkspacePermissionMatrix = Record<ConfigurableWorkspaceRole, Record<WorkspacePermissionKey, boolean>>;
export const WORKSPACE_PERMISSION_OPTIONS: { key: WorkspacePermissionKey; label: string; description: string }[] = [
  { key: 'manage_items', label: 'ثبت و ویرایش کارها و جلسات', description: 'ایجاد و تغییر موارد گروه' },
  { key: 'delete_items', label: 'حذف کارها و جلسات', description: 'حذف موارد ثبت‌شده' },
  { key: 'invite_members', label: 'دعوت همکاران', description: 'ارسال دعوت‌نامه برای اعضای جدید' },
  { key: 'manage_members', label: 'مدیریت اعضا و نقش‌ها', description: 'تغییر نقش یا حذف اعضا' },
  { key: 'edit_workspace', label: 'ویرایش مشخصات گروه', description: 'تغییر نام و توضیحات گروه' },
];
export const DEFAULT_WORKSPACE_PERMISSION_MATRIX: WorkspacePermissionMatrix = {
  executive: { manage_items: true, delete_items: true, invite_members: true, manage_members: true, edit_workspace: false },
  coordinator: { manage_items: true, delete_items: true, invite_members: true, manage_members: false, edit_workspace: false },
  member: { manage_items: false, delete_items: false, invite_members: false, manage_members: false, edit_workspace: false },
};
export async function fetchWorkspacePermissionMatrix(workspaceId: string): Promise<WorkspacePermissionMatrix> {
  const matrix: WorkspacePermissionMatrix = {
    executive: { ...DEFAULT_WORKSPACE_PERMISSION_MATRIX.executive },
    coordinator: { ...DEFAULT_WORKSPACE_PERMISSION_MATRIX.coordinator },
    member: { ...DEFAULT_WORKSPACE_PERMISSION_MATRIX.member },
  };
  const { data, error } = await supabase.from('workspace_role_permissions')
    .select('role,permission_key,allowed').eq('workspace_id', workspaceId);
  throwIfError(error);
  for (const row of data || []) {
    const role = row.role as ConfigurableWorkspaceRole;
    const key = row.permission_key as WorkspacePermissionKey;
    if (role in matrix && key in matrix[role]) matrix[role][key] = Boolean(row.allowed);
  }
  return matrix;
}
export async function saveWorkspaceRolePermission(
  workspaceId: string, role: ConfigurableWorkspaceRole, permissionKey: WorkspacePermissionKey, allowed: boolean
): Promise<void> {
  const { error } = await supabase.from('workspace_role_permissions').upsert({
    workspace_id: workspaceId, role, permission_key: permissionKey, allowed, updated_at: new Date().toISOString(),
  }, { onConflict: 'workspace_id,role,permission_key' });
  throwIfError(error);
}
export async function updateWorkspace(workspaceId: string, ownerUid: string, name: string, description: string): Promise<void> {
  const { data, error } = await supabase.from('workspaces').update({
    name: clampStr(name, SCHEMA_LIMITS.NAME_MAX),
    description: clampStr(description, SCHEMA_LIMITS.WORKSPACE_DESC_MAX),
    updated_at: new Date().toISOString(),
  }).eq('id', workspaceId).eq('owner_uid', ownerUid).select('id').maybeSingle();
  throwIfError(error);
  if (!data?.id) throw new Error('ویرایش گروه انجام نشد؛ فقط مالک گروه می‌تواند آن را ویرایش کند.');
}
export async function deleteWorkspace(workspaceId: string, ownerUid: string): Promise<void> {
  const { data, error } = await supabase.from('workspaces').delete()
    .eq('id', workspaceId).eq('owner_uid', ownerUid).select('id').maybeSingle();
  throwIfError(error);
  if (!data?.id) throw new Error('حذف گروه انجام نشد؛ فقط مالک گروه می‌تواند آن را حذف کند.');
}
export async function inviteMemberByEmail(
  workspace: Workspace, inviter: AppUser, invitedEmailRaw: string,
  role: 'executive' | 'coordinator' | 'member'
): Promise<string> {
  const id = generateSafeId('inv');
  const { error } = await supabase.from('workspace_invites').insert({
    id, workspace_id: workspace.id, workspace_name: clampStr(workspace.name, SCHEMA_LIMITS.NAME_MAX),
    invited_email: clampStr(invitedEmailRaw.toLowerCase(), SCHEMA_LIMITS.EMAIL_MAX),
    invited_by_uid: inviter.uid,
    invited_by_name: clampStr(inviter.displayName || inviter.email?.split('@')[0], SCHEMA_LIMITS.NAME_MAX),
    invited_by_email: clampStr(inviter.email?.toLowerCase(), SCHEMA_LIMITS.EMAIL_MAX),
    role, status: 'pending',
  });
  throwIfError(error);
  return id;
}
export async function acceptWorkspaceInvite(user: AppUser, invite: WorkspaceInvite): Promise<void> {
  const { error } = await supabase.rpc('accept_workspace_invite', { p_invite_id: invite.id });
  throwIfError(error);
  const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.uid).maybeSingle();
  const { data: workspace } = await supabase.from('workspaces').select('owner_uid').eq('id', invite.workspaceId).maybeSingle();
  if (workspace?.owner_uid) {
    await insertNotification({
      userId: invite.invitedByUid, workspaceId: invite.workspaceId,
      workspaceName: invite.workspaceName, itemId: invite.id, itemType: 'invite',
      title: `${profile?.display_name || user.displayName} به گروه «${invite.workspaceName}» پیوست`,
      body: `دعوت‌نامه ایمیل (${user.email || ''}) پذیرفته شد.`,
      sender: user, actionStatus: 'confirmed',
    }).catch(() => undefined);
  }
}
export async function declineWorkspaceInvite(inviteId: string): Promise<void> {
  const { error } = await supabase.rpc('decline_workspace_invite', { p_invite_id: inviteId });
  throwIfError(error);
}
export async function updateMemberRole(workspaceId: string, memberUid: string, role: 'executive' | 'coordinator' | 'member'): Promise<void> {
  const { error } = await supabase.rpc('update_workspace_member_role', {
    p_workspace_id: workspaceId, p_user_id: memberUid, p_role: role,
  });
  throwIfError(error);
}
export async function removeWorkspaceMember(workspaceId: string, memberUid: string): Promise<void> {
  const { error } = await supabase.rpc('remove_workspace_member', {
    p_workspace_id: workspaceId, p_user_id: memberUid,
  });
  throwIfError(error);
}
export interface SaveItemInput {
  type: ItemType; title: string; description: string; jalaliDate: string;
  startTime: string; endTime: string; location: string; meetingLink: string;
  priority: ItemPriority; status: ItemStatus; assigneeEmail: string; assigneeName: string;
  assigneeUid: string; agenda: string; minutes: string; checklist: ChecklistItem[];
  notifyMembers: boolean; reminderMinutes: number;
}
function itemPayload(workspace: Workspace, input: SaveItemInput) {
  return {
    workspace_id: workspace.id, type: input.type,
    title: clampStr(input.title, SCHEMA_LIMITS.TITLE_MAX),
    description: clampStr(input.description, SCHEMA_LIMITS.DESC_MAX),
    jalali_date: input.jalaliDate, gregorian_date: jalaliToGregorianStr(input.jalaliDate),
    start_time: clampStr(input.startTime, 5), end_time: clampStr(input.endTime, 5),
    location: clampStr(input.location, SCHEMA_LIMITS.LOCATION_MAX),
    meeting_link: clampStr(input.meetingLink, SCHEMA_LIMITS.LINK_MAX),
    priority: input.priority, status: input.status,
    assignee_email: clampStr(input.assigneeEmail, SCHEMA_LIMITS.EMAIL_MAX),
    assignee_name: clampStr(input.assigneeName, SCHEMA_LIMITS.NAME_MAX),
    assignee_uid: clampStr(input.assigneeUid, SCHEMA_LIMITS.ID_MAX),
    agenda: clampStr(input.agenda, SCHEMA_LIMITS.AGENDA_MAX),
    minutes: clampStr(input.minutes, SCHEMA_LIMITS.MINUTES_MAX),
    checklist: input.checklist.slice(0, SCHEMA_LIMITS.CHECKLIST_MAX).map(c => ({
      id: clampStr(c.id, 64), text: clampStr(c.text, SCHEMA_LIMITS.CHECKLIST_TEXT_MAX), done: Boolean(c.done),
    })),
    notify_members: input.notifyMembers,
    reminder_minutes: Math.max(0, Math.min(1440, Math.round(input.reminderMinutes))),
    updated_at: new Date().toISOString(),

  };
}
async function insertNotification(args: {
  userId: string; workspaceId: string; workspaceName: string; itemId: string;
  itemType: ItemType | 'invite' | 'system'; title: string; body: string;
  sender: AppUser; actionStatus?: NotificationActionStatus;
}) {
  const { error } = await supabase.from('user_notifications').insert({
    id: generateSafeId('ntf'), user_id: args.userId,
    workspace_id: args.workspaceId, workspace_name: clampStr(args.workspaceName, SCHEMA_LIMITS.NAME_MAX),
    item_id: args.itemId, item_type: args.itemType,
    title: clampStr(args.title, SCHEMA_LIMITS.NOTIF_TITLE_MAX),
    body: clampStr(args.body, SCHEMA_LIMITS.NOTIF_BODY_MAX),
    sender_uid: args.sender.uid, sender_name: clampStr(args.sender.displayName, SCHEMA_LIMITS.NAME_MAX),
    sender_email: clampStr(args.sender.email?.toLowerCase(), SCHEMA_LIMITS.EMAIL_MAX),
    read: false, action_status: args.actionStatus || 'pending',
  });
  throwIfError(error);
}
export async function saveWorkspaceItem(
  workspace: Workspace, members: WorkspaceMember[], currentUser: AppUser,
  input: SaveItemInput, existingItem?: WorkspaceItem | null
): Promise<string> {
  const id = existingItem?.id ?? generateSafeId('itm');
  const email = clampStr(currentUser.email?.toLowerCase(), SCHEMA_LIMITS.EMAIL_MAX);
  const name = clampStr(currentUser.displayName || email.split('@')[0], SCHEMA_LIMITS.NAME_MAX);
  const payload = itemPayload(workspace, input);
  if (existingItem) {
    const updatePayload = Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'workspace_id'));
    const { error } = await supabase.from('workspace_items').update(updatePayload).eq('id', id).eq('workspace_id', workspace.id);
    throwIfError(error);
  } else {
    const { error } = await supabase.from('workspace_items').insert({
      id, ...payload, confirmed_uids: [currentUser.uid], declined_uids: [],
      created_by_uid: currentUser.uid, created_by_name: name, created_by_email: email,
    });
    throwIfError(error);
  }
  if (input.notifyMembers) {
    const label = ITEM_TYPE_LABELS[input.type];
    const time = input.startTime ? ` · ساعت ${toPersianDigits(input.startTime)}` : '';
    await Promise.all(members.filter(m => m.uid !== currentUser.uid).map(m =>
      insertNotification({
        userId: m.uid, workspaceId: workspace.id, workspaceName: workspace.name,
        itemId: id, itemType: input.type,
        title: `${label} جدید: ${input.title}`,
        body: `${name} این ${label} را برای تاریخ ${toPersianDigits(input.jalaliDate)}${time} ${existingItem ? 'به‌روزرسانی کرد' : 'ثبت کرد'}.${input.location ? ` محل: ${input.location}` : ''}`,
        sender: currentUser,
      })
    ));
  }
  return id;
}
export async function updateItemStatus(workspace: Workspace, members: WorkspaceMember[], user: AppUser, item: WorkspaceItem, status: ItemStatus): Promise<void> {
  const { error } = await supabase.from('workspace_items').update({ status, updated_at: new Date().toISOString() }).eq('id', item.id).eq('workspace_id', workspace.id);
  throwIfError(error);
  if (status === 'completed' || status === 'cancelled') {
    const label = status === 'completed' ? 'تکمیل شد' : 'لغو شد';
    await Promise.all(members.filter(m => m.uid !== user.uid).map(m => insertNotification({
      userId: m.uid, workspaceId: workspace.id, workspaceName: workspace.name,
      itemId: item.id, itemType: item.type, title: `${item.title} — ${label}`,
      body: `${user.displayName || 'همکار'} وضعیت این مورد را به «${label}» تغییر داد.`,
      sender: user, actionStatus: status === 'completed' ? 'done' : 'none',
    })));
  }
}
export async function respondToItemAttendance(
  workspace: Workspace, members: WorkspaceMember[], user: AppUser,
  item: WorkspaceItem, response: 'accepted' | 'declined'
): Promise<void> {
  const { error } = await supabase.rpc('respond_to_workspace_item', {
    p_workspace_id: workspace.id, p_item_id: item.id, p_response: response,
  });
  throwIfError(error);
  if (item.createdByUid !== user.uid && members.some(m => m.uid === item.createdByUid)) {
    await insertNotification({
      userId: item.createdByUid, workspaceId: workspace.id, workspaceName: workspace.name,
      itemId: item.id, itemType: item.type,
      title: `پاسخ ${user.displayName || 'همکار'} به «${item.title}»`,
      body: response === 'accepted' ? 'حضور و رؤیت را تأیید کرد.' : 'عدم امکان حضور را اعلام کرد.',
      sender: user, actionStatus: response === 'accepted' ? 'confirmed' : 'declined',
    });
  }
}
export async function toggleItemChecklist(workspaceId: string, item: WorkspaceItem, checklistId: string): Promise<void> {
  const checklist = item.checklist.map(entry => entry.id === checklistId ? { ...entry, done: !entry.done } : entry);
  const { error } = await supabase.from('workspace_items').update({ checklist, updated_at: new Date().toISOString() }).eq('id', item.id).eq('workspace_id', workspaceId);
  throwIfError(error);
}
export async function updateItemMinutes(workspaceId: string, itemId: string, minutes: string): Promise<void> {
  const { error } = await supabase.from('workspace_items').update({
    minutes: clampStr(minutes, SCHEMA_LIMITS.MINUTES_MAX), updated_at: new Date().toISOString(),
  }).eq('id', itemId).eq('workspace_id', workspaceId);
  throwIfError(error);
}
export async function deleteWorkspaceItem(workspaceId: string, itemId: string): Promise<void> {
  const { data, error } = await supabase.from('workspace_items')
    .delete().eq('id', itemId).eq('workspace_id', workspaceId).select('id').maybeSingle();
  throwIfError(error);
  if (!data?.id) throw new Error('این مورد حذف نشد؛ ممکن است دسترسی حذف نداشته باشید یا مورد قبلاً حذف شده باشد.');
}
export async function markNotificationRead(userId: string, notificationId: string, actionStatus?: NotificationActionStatus): Promise<void> {
  const payload: { read: boolean; action_status?: NotificationActionStatus } = { read: true };
  if (actionStatus) payload.action_status = actionStatus;
  const { error } = await supabase.from('user_notifications').update(payload).eq('user_id', userId).eq('id', notificationId);
  throwIfError(error);
}
export async function deleteNotification(userId: string, notificationId: string): Promise<void> {
  const { error } = await supabase.from('user_notifications').delete().eq('user_id', userId).eq('id', notificationId);
  throwIfError(error);
}
export function getRoleDisplayLabel(role: WorkspaceRole): string {
  switch (role) {
    case 'owner': return 'مالک و مدیر گروه';
    case 'executive': return 'رییس / مدیر ارشد';
    case 'coordinator': return 'مسئول دفتر / هماهنگ‌کننده';
    default: return 'عضو تیم';
  }
}
