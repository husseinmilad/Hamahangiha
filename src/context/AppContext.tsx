/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase row adapters are isolated here; runtime row shape is defined by versioned SQL migrations. */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AppUser, UserMembership, UserNotification, UserProfile, Workspace, WorkspaceInvite, WorkspaceItem, WorkspaceMember } from '../types/hamahangi';
import {
  getNotificationPermission, refreshNotificationPermission, NotificationPermissionState,
  requestNotificationPermission, showDeviceNotification, isNativePlatform, scheduleNativeReminders,
} from '../lib/notifications';
import { getTodayJalaliStr, toPersianDigits } from '../lib/jalali';

export type ActiveTab = 'today' | 'calendar' | 'items' | 'team' | 'notifications';
interface LiveToastMessage { id: string; title: string; body: string; itemId?: string }
interface AppContextValue {
  user: AppUser | null; authReady: boolean; authLoading: boolean; authError: string | null;
  profile: UserProfile | null; memberships: UserMembership[]; activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string) => void; activeWorkspace: Workspace | null;
  members: WorkspaceMember[]; items: WorkspaceItem[]; itemsLoading: boolean;
  removeItemLocally: (itemId: string) => void;
  notifications: UserNotification[]; unreadCount: number;
  incomingInvites: WorkspaceInvite[]; outgoingInvites: WorkspaceInvite[];
  activeTab: ActiveTab; setActiveTab: (tab: ActiveTab) => void;
  theme: 'light' | 'dark'; toggleTheme: () => void;
  notifPermission: NotificationPermissionState; enableDeviceNotifications: () => Promise<NotificationPermissionState>;
  liveToast: LiveToastMessage | null; dismissLiveToast: () => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  passwordRecovery: boolean;
  signOutUser: () => Promise<void>;
}
const AppContext = createContext<AppContextValue | null>(null);

function authMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'ایمیل یا رمز عبور صحیح نیست.';
  if (m.includes('user already registered')) return 'این ایمیل قبلاً ثبت‌نام کرده است؛ وارد حساب شوید.';
  if (m.includes('password should be at least')) return 'رمز عبور باید حداقل ۶ نویسه باشد.';
  if (m.includes('email not confirmed')) return 'ایمیل حساب هنوز تأیید نشده است.';
  if (m.includes('rate limit')) return 'تعداد درخواست‌ها زیاد است؛ کمی بعد دوباره تلاش کنید.';
  if (m.includes('network') || m.includes('fetch')) return 'ارتباط با سرور برقرار نشد؛ اینترنت و تنظیمات Supabase را بررسی کنید.';
  return message || 'خطای نامشخص در ارتباط با حساب کاربری.';
}
const mapProfile = (r: any): UserProfile => ({
  uid: r.id, email: r.email || '', displayName: r.display_name || '',
  photoURL: r.photo_url || '', defaultTitle: r.default_title || 'عضو تیم',
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapWorkspace = (r: any): Workspace => ({
  id: r.id, name: r.name, description: r.description || '', ownerUid: r.owner_uid,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapMember = (r: any): WorkspaceMember => ({
  uid: r.user_id, email: r.email, displayName: r.display_name, photoURL: r.photo_url || '',
  role: r.role, inviteId: r.invite_id || '', joinedAt: r.joined_at,
});
const mapItem = (r: any): WorkspaceItem => ({
  id: r.id, workspaceId: r.workspace_id, type: r.type, title: r.title, description: r.description || '',
  jalaliDate: r.jalali_date, gregorianDate: r.gregorian_date, startTime: r.start_time || '',
  endTime: r.end_time || '', location: r.location || '', meetingLink: r.meeting_link || '',
  priority: r.priority, status: r.status, assigneeEmail: r.assignee_email || '',
  assigneeName: r.assignee_name || '', assigneeUid: r.assignee_uid || '', agenda: r.agenda || '',
  minutes: r.minutes || '', checklist: r.checklist || [], confirmedUids: r.confirmed_uids || [],
  declinedUids: r.declined_uids || [], notifyMembers: r.notify_members,
  reminderMinutes: r.reminder_minutes ?? 15, createdByUid: r.created_by_uid,
  createdByName: r.created_by_name, createdByEmail: r.created_by_email,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapInvite = (r: any): WorkspaceInvite => ({
  id: r.id, workspaceId: r.workspace_id, workspaceName: r.workspace_name,
  invitedEmail: r.invited_email, invitedByUid: r.invited_by_uid, invitedByName: r.invited_by_name,
  invitedByEmail: r.invited_by_email, role: r.role, status: r.status,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const mapNotification = (r: any): UserNotification => ({
  id: r.id, workspaceId: r.workspace_id, workspaceName: r.workspace_name, itemId: r.item_id || '',
  itemType: r.item_type, title: r.title, body: r.body || '', senderUid: r.sender_uid || '',
  senderName: r.sender_name || '', senderEmail: r.sender_email || '', read: r.read,
  actionStatus: r.action_status || 'none', createdAt: r.created_at,
});

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(() => typeof window !== 'undefined' && window.location.hash.includes('type=recovery'));
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() => localStorage.getItem('hamahangi_active_ws'));
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<WorkspaceInvite[]>([]);
  const [outgoingInvites, setOutgoingInvites] = useState<WorkspaceInvite[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => localStorage.getItem('hamahangi_theme') === 'dark' ? 'dark' : 'light');
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>(() => getNotificationPermission());
  const [liveToast, setLiveToast] = useState<LiveToastMessage | null>(null);
  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const initialNotifBatchRef = useRef(true);
  const firedReminderKeysRef = useRef<Set<string>>(new Set());

  const removeItemLocally = useCallback((itemId: string) => {
    setItems(current => current.filter(item => item.id !== itemId));
  }, []);

  const setActiveWorkspaceId = useCallback((id: string | null) => {
    setActiveWorkspaceIdState(id || null);
    if (id) localStorage.setItem('hamahangi_active_ws', id);
    else localStorage.removeItem('hamahangi_active_ws');
  }, []);
  const toggleTheme = useCallback(() => setTheme(p => p === 'dark' ? 'light' : 'dark'), []);
  const dismissLiveToast = useCallback(() => setLiveToast(null), []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('hamahangi_theme', theme);
  }, [theme]);
  useEffect(() => {
    let alive = true;
    void refreshNotificationPermission().then(p => { if (alive) setNotifPermission(p); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    const applySession = (sessionUser: any, event?: string) => {
      if (event === 'PASSWORD_RECOVERY' || (typeof window !== 'undefined' && window.location.hash.includes('type=recovery'))) setPasswordRecovery(true);
      if (!alive) return;
      setUser(sessionUser ? {
        uid: sessionUser.id, email: sessionUser.email || null,
        displayName: sessionUser.user_metadata?.display_name || sessionUser.email?.split('@')[0] || 'کاربر',
        photoURL: sessionUser.user_metadata?.avatar_url || '',
      } : null);
      setAuthReady(true);
      seenNotifIdsRef.current.clear();
      initialNotifBatchRef.current = true;
    };
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error) setAuthError(authMessage(error.message));
      applySession(data.session?.user);
    }).catch(e => { if (alive) { setAuthError(authMessage(String(e))); setAuthReady(true); } });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => applySession(session?.user, event));
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null); setMemberships([]); setActiveWorkspace(null); setMembers([]);
      setItems([]); setNotifications([]); setIncomingInvites([]); setOutgoingInvites([]);
      setActiveWorkspaceId(null); void scheduleNativeReminders([]);
      return;
    }
    let alive = true;
    const load = async () => {
      const [p, m, n, incoming, outgoing] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.uid).maybeSingle(),
        supabase.from('workspace_members').select('workspace_id,role,joined_at').eq('user_id', user.uid),
        supabase.from('user_notifications').select('*').eq('user_id', user.uid).order('created_at', { ascending: false }).limit(50),
        supabase.from('workspace_invites').select('*').eq('status', 'pending').ilike('invited_email', user.email || ''),
        supabase.from('workspace_invites').select('*').eq('invited_by_uid', user.uid).order('created_at', { ascending: false }),
      ]);
      for (const result of [p,m,n,incoming,outgoing]) if (result.error) throw result.error;
      const wsIds = (m.data || []).map((x: any) => x.workspace_id);
      const workspacesResult = wsIds.length
        ? await supabase.from('workspaces').select('*').in('id', wsIds)
        : { data: [], error: null };
      if (workspacesResult.error) throw workspacesResult.error;
      const wsById = new Map((workspacesResult.data || []).map((w: any) => [w.id, w]));
      const membershipRows: UserMembership[] = (m.data || []).flatMap((x: any) => {
        const w: any = wsById.get(x.workspace_id);
        return w ? [{ workspaceId: w.id, workspaceName: w.name, role: x.role, ownerUid: w.owner_uid, joinedAt: x.joined_at }] : [];
      });
      if (!alive) return;
      setProfile(p.data ? mapProfile(p.data) : null);
      setMemberships(membershipRows);
      setNotifications((n.data || []).map(mapNotification));
      setIncomingInvites((incoming.data || []).map(mapInvite));
      setOutgoingInvites((outgoing.data || []).map(mapInvite));
      setActiveWorkspaceIdState(prev => {
        const next = prev && membershipRows.some(x => x.workspaceId === prev) ? prev : membershipRows[0]?.workspaceId || null;
        if (next) localStorage.setItem('hamahangi_active_ws', next);
        else localStorage.removeItem('hamahangi_active_ws');
        return next;
      });
      if (initialNotifBatchRef.current) {
        (n.data || []).forEach((x: any) => seenNotifIdsRef.current.add(x.id));
        initialNotifBatchRef.current = false;
      } else {
        const fresh = (n.data || []).filter((x: any) => !x.read && !seenNotifIdsRef.current.has(x.id));
        (n.data || []).forEach((x: any) => seenNotifIdsRef.current.add(x.id));
        if (fresh.length) {
          const latest = fresh[0];
          setLiveToast({ id: latest.id, title: latest.title, body: latest.body, itemId: latest.item_id });
          if (!isNativePlatform()) void showDeviceNotification(latest.title, latest.body, latest.id);
        }
      }
    };
    void load().catch(e => console.error('Supabase data load failed', e));
    const channel = supabase.channel(`user-data-${user.uid}`)
      .on('postgres_changes', { event: '*', schema: 'public' }, () => { void load().catch(e => console.error(e)); })
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [user, setActiveWorkspaceId]);

  useEffect(() => {
    if (!user || !activeWorkspaceId) {
      setActiveWorkspace(null); setMembers([]); setItems([]); setItemsLoading(false);
      return;
    }
    let alive = true;
    setItemsLoading(true);
    const loadWorkspace = async () => {
      const [w, m, i] = await Promise.all([
        supabase.from('workspaces').select('*').eq('id', activeWorkspaceId).maybeSingle(),
        supabase.from('workspace_members').select('*').eq('workspace_id', activeWorkspaceId),
        supabase.from('workspace_items').select('*').eq('workspace_id', activeWorkspaceId).order('gregorian_date', { ascending: true }),
      ]);
      for (const r of [w,m,i]) if (r.error) throw r.error;
      if (!alive) return;
      setActiveWorkspace(w.data ? mapWorkspace(w.data) : null);
      setMembers((m.data || []).map(mapMember));
      const mapped = (i.data || []).map(mapItem).sort((a,b) =>
        a.gregorianDate.localeCompare(b.gregorianDate) || (a.startTime || '99:99').localeCompare(b.startTime || '99:99'));
      setItems(mapped); setItemsLoading(false);
    };
    void loadWorkspace().catch(e => { console.error('Workspace load failed', e); if (alive) setItemsLoading(false); });
    const channel = supabase.channel(`workspace-data-${activeWorkspaceId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces', filter: `id=eq.${activeWorkspaceId}` }, () => { void loadWorkspace(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${activeWorkspaceId}` }, () => { void loadWorkspace(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_items', filter: `workspace_id=eq.${activeWorkspaceId}` }, () => { void loadWorkspace(); })
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [user, activeWorkspaceId]);

  useEffect(() => {
    if (!isNativePlatform()) return;
    if (!user || memberships.length === 0) { void scheduleNativeReminders([]); return; }
    let alive = true;
    const sync = async () => {
      const ids = memberships.map(m => m.workspaceId);
      const { data, error } = await supabase.from('workspace_items').select('*').in('workspace_id', ids);
      if (error) throw error;
      if (alive) await scheduleNativeReminders((data || []).map(mapItem));
    };
    void sync().catch(e => console.error('Local reminder sync failed', e));
    const channel = supabase.channel(`reminders-${user.uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_items' }, () => { void sync(); })
      .subscribe();
    return () => { alive = false; void supabase.removeChannel(channel); };
  }, [user, memberships]);

  useEffect(() => {
    if (isNativePlatform() || !user || !items.length) return;
    const check = () => {
      const today = getTodayJalaliStr(), now = new Date(), minutes = now.getHours() * 60 + now.getMinutes();
      for (const item of items) {
        if (item.jalaliDate !== today || ['completed','cancelled'].includes(item.status) || !item.startTime || item.reminderMinutes <= 0) continue;
        const [h,m] = item.startTime.split(':').map(Number);
        if (Number.isNaN(h) || Number.isNaN(m)) continue;
        const diff = h * 60 + m - minutes, key = `${item.id}_${item.jalaliDate}_${item.startTime}`;
        if (diff >= 0 && diff <= item.reminderMinutes && !firedReminderKeysRef.current.has(key)) {
          firedReminderKeysRef.current.add(key);
          const body = diff === 0 ? `هم‌اکنون ساعت ${toPersianDigits(item.startTime)} آغاز می‌شود.` : `${toPersianDigits(diff)} دقیقه تا شروع (ساعت ${toPersianDigits(item.startTime)})`;
          setLiveToast({ id: `rem_${key}`, title: `یادآوری: ${item.title}`, body, itemId: item.id });
          void showDeviceNotification(`یادآوری: ${item.title}`, body, `rem_${key}`);
        }
      }
    };
    check(); const timer = window.setInterval(check, 45000);
    return () => window.clearInterval(timer);
  }, [user, items]);
  useEffect(() => {
    if (!liveToast) return;
    const timer = window.setTimeout(() => setLiveToast(null), 6500);
    return () => window.clearTimeout(timer);
  }, [liveToast]);

  const withAuth = useCallback(async (fn: () => Promise<void>) => {
    setAuthLoading(true); setAuthError(null);
    try { await fn(); }
    catch (e) { const message = e instanceof Error ? e.message : String(e); setAuthError(authMessage(message)); throw e; }
    finally { setAuthLoading(false); }
  }, []);
  const signInWithEmail = useCallback((email: string, password: string) => withAuth(async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error) throw error;
  }), [withAuth]);
  const signUpWithEmail = useCallback((email: string, password: string, displayName: string) => withAuth(async () => {
    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { data: { display_name: displayName.trim() || email.split('@')[0] } },
    });
    if (error) throw error;
  }), [withAuth]);
  const resetPassword = useCallback((email: string) => withAuth(async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
    });
    if (error) throw error;
  }), [withAuth]);
  const updatePassword = useCallback((password: string) => withAuth(async () => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setPasswordRecovery(false);
    if (typeof window !== 'undefined') window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  }), [withAuth]);
  const signOutUser = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);
  const enableDeviceNotifications = useCallback(async () => {
    const permission = await requestNotificationPermission();
    setNotifPermission(permission);
    if (permission === 'granted' && isNativePlatform() && memberships.length > 0) {
      const { data, error } = await supabase.from('workspace_items').select('*').in('workspace_id', memberships.map(m => m.workspaceId));
      if (error) console.error('Could not refresh local reminders after permission grant', error);
      else await scheduleNativeReminders((data || []).map(mapItem));
    }
    return permission;
  }, [memberships]);
  const unreadCount = useMemo(() => incomingInvites.length, [incomingInvites]);
  const value: AppContextValue = {
    user, authReady, authLoading, authError, profile, memberships, activeWorkspaceId,
    setActiveWorkspaceId, activeWorkspace, members, items, itemsLoading, removeItemLocally, notifications,
    unreadCount, incomingInvites, outgoingInvites, activeTab, setActiveTab, theme, toggleTheme,
    notifPermission, enableDeviceNotifications, liveToast, dismissLiveToast,
    signInWithEmail, signUpWithEmail, resetPassword, updatePassword, passwordRecovery, signOutUser,
  };
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
