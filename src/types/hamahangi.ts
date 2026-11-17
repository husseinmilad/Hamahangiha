import { Timestamp } from 'firebase/firestore';

export type WorkspaceRole = 'owner' | 'executive' | 'coordinator' | 'member';
export type ItemType = 'meeting' | 'task' | 'event';
export type ItemPriority = 'urgent' | 'high' | 'normal' | 'low';
export type ItemStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type InviteStatus = 'pending' | 'accepted' | 'declined';
export type NotificationActionStatus = 'none' | 'pending' | 'confirmed' | 'declined' | 'done';

export const SCHEMA_LIMITS = {
  ID_MAX: 128,
  NAME_MAX: 100,
  EMAIL_MAX: 200,
  TITLE_MAX: 180,
  NOTIF_TITLE_MAX: 160,
  NOTIF_BODY_MAX: 500,
  DESC_MAX: 2000,
  WORKSPACE_DESC_MAX: 300,
  AGENDA_MAX: 2000,
  MINUTES_MAX: 3000,
  LOCATION_MAX: 200,
  LINK_MAX: 400,
  DEFAULT_TITLE_MAX: 80,
  CHECKLIST_MAX: 20,
  CHECKLIST_TEXT_MAX: 200,
  UID_LIST_MAX: 25,
  PHOTO_MAX: 500,
} as const;

export const ID_REGEX = /^[a-zA-Z0-9_-]+$/;
export const JALALI_DATE_REGEX = /^\d{4}\/\d{2}\/\d{2}$/;
export const GREGORIAN_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  defaultTitle: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserMembership {
  workspaceId: string;
  workspaceName: string;
  role: WorkspaceRole;
  ownerUid: string;
  joinedAt?: Timestamp;
}

export interface UserNotification {
  id: string;
  workspaceId: string;
  workspaceName: string;
  itemId: string;
  itemType: ItemType | 'invite' | 'system';
  title: string;
  body: string;
  senderUid: string;
  senderName: string;
  senderEmail: string;
  read: boolean;
  actionStatus: NotificationActionStatus;
  createdAt?: Timestamp;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  ownerUid: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface WorkspaceMember {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: WorkspaceRole;
  inviteId: string;
  joinedAt?: Timestamp;
}

export interface WorkspaceItem {
  id: string;
  workspaceId: string;
  type: ItemType;
  title: string;
  description: string;
  jalaliDate: string;
  gregorianDate: string;
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
  confirmedUids: string[];
  declinedUids: string[];
  notifyMembers: boolean;
  reminderMinutes: number;
  createdByUid: string;
  createdByName: string;
  createdByEmail: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface WorkspaceInvite {
  id: string;
  workspaceId: string;
  workspaceName: string;
  invitedEmail: string;
  invitedByUid: string;
  invitedByName: string;
  invitedByEmail: string;
  role: 'executive' | 'coordinator' | 'member';
  status: InviteStatus;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: 'مالک و مدیر گروه',
  executive: 'رییس / مدیر ارشد',
  coordinator: 'مسئول دفتر / هماهنگ‌کننده',
  member: 'عضو تیم',
};

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  meeting: 'جلسه',
  task: 'کار و پیگیری',
  event: 'رویداد',
};

export const PRIORITY_LABELS: Record<ItemPriority, string> = {
  urgent: 'فوری',
  high: 'مهم',
  normal: 'عادی',
  low: 'کم‌اولویت',
};

export const STATUS_LABELS: Record<ItemStatus, string> = {
  scheduled: 'برنامه‌ریزی‌شده',
  in_progress: 'در حال انجام',
  completed: 'تکمیل‌شده',
  cancelled: 'لغوشده',
};
