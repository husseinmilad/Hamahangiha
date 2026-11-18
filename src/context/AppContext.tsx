import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  UserMembership,
  UserNotification,
  UserProfile,
  Workspace,
  WorkspaceInvite,
  WorkspaceItem,
  WorkspaceMember,
} from '../types/hamahangi';
import { ensureUserProfile } from '../services/firestoreService';
import {
  getNotificationPermission,
  refreshNotificationPermission,
  NotificationPermissionState,
  requestNotificationPermission,
  showDeviceNotification,
  isNativePlatform,
  setupDevicePush,
  enableRemotePush,
  scheduleNativeReminders,
} from '../lib/notifications';
import { getTodayJalaliStr, toPersianDigits } from '../lib/jalali';

export type ActiveTab = 'today' | 'calendar' | 'items' | 'team' | 'notifications';

interface LiveToastMessage {
  id: string;
  title: string;
  body: string;
  itemId?: string;
}

interface AppContextValue {
  user: User | null;
  authReady: boolean;
  authLoading: boolean;
  authError: string | null;
  profile: UserProfile | null;
  memberships: UserMembership[];
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string) => void;
  activeWorkspace: Workspace | null;
  members: WorkspaceMember[];
  items: WorkspaceItem[];
  itemsLoading: boolean;
  notifications: UserNotification[];
  unreadCount: number;
  incomingInvites: WorkspaceInvite[];
  outgoingInvites: WorkspaceInvite[];
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  notifPermission: NotificationPermissionState;
  enableDeviceNotifications: () => Promise<NotificationPermissionState>;
  liveToast: LiveToastMessage | null;
  dismissLiveToast: () => void;
  signInWithGoogle: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [memberships, setMemberships] = useState<UserMembership[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() =>
    localStorage.getItem('hamahangi_active_ws')
  );
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<WorkspaceInvite[]>([]);
  const [outgoingInvites, setOutgoingInvites] = useState<WorkspaceInvite[]>([]);

  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('hamahangi_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [notifPermission, setNotifPermission] = useState<NotificationPermissionState>(() =>
    getNotificationPermission()
  );
  const [liveToast, setLiveToast] = useState<LiveToastMessage | null>(null);

  const seenNotifIdsRef = useRef<Set<string>>(new Set());
  const isInitialNotifBatchRef = useRef(true);
  const firedReminderKeysRef = useRef<Set<string>>(new Set());
  const reminderItemsByWorkspaceRef = useRef<Map<string, WorkspaceItem[]>>(new Map());

  useEffect(() => {
    let active = true;
    void refreshNotificationPermission().then((permission) => {
      if (active) setNotifPermission(permission);
    });
    return () => { active = false; };
  }, []);

  // Sync theme to document.documentElement
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('hamahangi_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setActiveWorkspaceId = useCallback((id: string) => {
    setActiveWorkspaceIdState(id);
    localStorage.setItem('hamahangi_active_ws', id);
  }, []);

  const enableDeviceNotifications = useCallback(async () => {
    const res = await requestNotificationPermission();
    setNotifPermission(res);
    if (res === 'granted' && user) {
      const pushReady = await enableRemotePush(user.uid);
      if (!pushReady) {
        console.warn('Remote push is not fully configured; local Android reminders remain available.');
      }
    }
    return res;
  }, [user]);

  const dismissLiveToast = useCallback(() => {
    setLiveToast(null);
  }, []);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      seenNotifIdsRef.current.clear();
      isInitialNotifBatchRef.current = true;

      if (currentUser) {
        try {
          await ensureUserProfile(currentUser);
        } catch (err) {
          console.error(err);
        }
      } else {
        setProfile(null);
        setMemberships([]);
        setActiveWorkspace(null);
        setMembers([]);
        setItems([]);
        setNotifications([]);
        setIncomingInvites([]);
        setOutgoingInvites([]);
      }
    });
    return () => unsub();
  }, []);

  // Register FCM listeners for this signed-in device. Permission is requested only after user action.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    void setupDevicePush(user.uid)
      .then((dispose) => {
        if (cancelled) dispose();
        else cleanup = dispose;
      })
      .catch((error) => console.error('Push listener setup failed', error));
    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [user]);

  // User profile, memberships, notifications, invites listeners
  useEffect(() => {
    if (!authReady || !user) return;
    const emailLower = (user.email ?? '').toLowerCase();

    const unsubProfile = onSnapshot(
      doc(db, 'users', user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `users/${user.uid}`)
    );

    const unsubMemberships = onSnapshot(
      collection(db, 'users', user.uid, 'memberships'),
      (snap) => {
        const list = snap.docs.map((d) => d.data() as UserMembership);
        setMemberships(list);
        setActiveWorkspaceIdState((prev) => {
          if (prev && list.some((m) => m.workspaceId === prev)) {
            return prev;
          }
          const nextId = list[0]?.workspaceId ?? null;
          if (nextId) localStorage.setItem('hamahangi_active_ws', nextId);
          return nextId;
        });
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/memberships`)
    );

    const notifQuery = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    const unsubNotifications = onSnapshot(
      notifQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as UserNotification);
        setNotifications(list);

        if (isInitialNotifBatchRef.current) {
          list.forEach((n) => seenNotifIdsRef.current.add(n.id));
          isInitialNotifBatchRef.current = false;
        } else {
          const newUnread = list.filter((n) => !n.read && !seenNotifIdsRef.current.has(n.id));
          list.forEach((n) => seenNotifIdsRef.current.add(n.id));
          if (newUnread.length > 0) {
            const latest = newUnread[0];
            setLiveToast({
              id: latest.id,
              title: latest.title,
              body: latest.body,
              itemId: latest.itemId,
            });
            if (!isNativePlatform()) {
              void showDeviceNotification(latest.title, latest.body, latest.id);
            }
          }
        }
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/notifications`)
    );

    const inInvQuery = query(
      collection(db, 'workspaceInvites'),
      where('invitedEmail', '==', emailLower)
    );
    const unsubInInv = onSnapshot(
      inInvQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as WorkspaceInvite);
        setIncomingInvites(list.filter((i) => i.status === 'pending'));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'workspaceInvites')
    );

    const outInvQuery = query(
      collection(db, 'workspaceInvites'),
      where('invitedByUid', '==', user.uid)
    );
    const unsubOutInv = onSnapshot(
      outInvQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as WorkspaceInvite);
        setOutgoingInvites(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'workspaceInvites')
    );

    return () => {
      unsubProfile();
      unsubMemberships();
      unsubNotifications();
      unsubInInv();
      unsubOutInv();
    };
  }, [authReady, user]);

  // Keep native reminder schedules in sync across every workspace, not only the selected one.
  useEffect(() => {
    if (!isNativePlatform()) return;
    reminderItemsByWorkspaceRef.current.clear();
    if (!user || memberships.length === 0) {
      void scheduleNativeReminders([]);
      return;
    }
    const unsubscribers = memberships.map((membership) =>
      onSnapshot(
        collection(db, 'workspaces', membership.workspaceId, 'items'),
        (snapshot) => {
          reminderItemsByWorkspaceRef.current.set(
            membership.workspaceId,
            snapshot.docs.map((itemDoc) => itemDoc.data() as WorkspaceItem)
          );
          const allItems = Array.from(reminderItemsByWorkspaceRef.current.values()).flat();
          void scheduleNativeReminders(allItems);
        },
        (error) => console.error('Native reminder sync failed', membership.workspaceId, error)
      )
    );
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      reminderItemsByWorkspaceRef.current.clear();
    };
  }, [user, memberships]);

  // Active workspace, members, and items listeners
  useEffect(() => {
    if (!authReady || !user || !activeWorkspaceId) {
      setActiveWorkspace(null);
      setMembers([]);
      setItems([]);
      setItemsLoading(false);
      return;
    }

    setItemsLoading(true);

    const unsubWs = onSnapshot(
      doc(db, 'workspaces', activeWorkspaceId),
      (snap) => {
        if (snap.exists()) {
          setActiveWorkspace(snap.data() as Workspace);
        } else {
          setActiveWorkspace(null);
        }
      },
      (error) => handleFirestoreError(error, OperationType.GET, `workspaces/${activeWorkspaceId}`)
    );

    const unsubMembers = onSnapshot(
      collection(db, 'workspaces', activeWorkspaceId, 'members'),
      (snap) => {
        setMembers(snap.docs.map((d) => d.data() as WorkspaceMember));
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, `workspaces/${activeWorkspaceId}/members`)
    );

    const itemsQuery = query(
      collection(db, 'workspaces', activeWorkspaceId, 'items'),
      orderBy('gregorianDate', 'asc')
    );
    const unsubItems = onSnapshot(
      itemsQuery,
      (snap) => {
        const list = snap.docs.map((d) => d.data() as WorkspaceItem);
        list.sort((a, b) => {
          const dateCmp = a.gregorianDate.localeCompare(b.gregorianDate);
          if (dateCmp !== 0) return dateCmp;
          return (a.startTime || '99:99').localeCompare(b.startTime || '99:99');
        });
        setItems(list);
        setItemsLoading(false);
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, `workspaces/${activeWorkspaceId}/items`)
    );

    return () => {
      unsubWs();
      unsubMembers();
      unsubItems();
    };
  }, [authReady, user, activeWorkspaceId]);

  // Background meeting reminder checker (every 45s)
  useEffect(() => {
    if (isNativePlatform()) return;
    if (!user || items.length === 0) return;

    const checkReminders = () => {
      const todayJalali = getTodayJalaliStr();
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      for (const item of items) {
        if (
          item.jalaliDate !== todayJalali ||
          item.status === 'completed' ||
          item.status === 'cancelled' ||
          !item.startTime ||
          item.reminderMinutes <= 0
        ) {
          continue;
        }
        const [hh, mm] = item.startTime.split(':').map(Number);
        if (Number.isNaN(hh) || Number.isNaN(mm)) continue;
        const startMin = hh * 60 + mm;
        const diff = startMin - currentMinutes;

        const key = `${item.id}_${item.jalaliDate}_${item.startTime}`;
        if (diff >= 0 && diff <= item.reminderMinutes && !firedReminderKeysRef.current.has(key)) {
          firedReminderKeysRef.current.add(key);
          const msg =
            diff === 0
              ? `هم‌اکنون ساعت ${toPersianDigits(item.startTime)} آغاز می‌شود.`
              : `${toPersianDigits(diff)} دقیقه تا شروع (ساعت ${toPersianDigits(item.startTime)})`;
          setLiveToast({
            id: `rem_${key}`,
            title: `یادآوری: ${item.title}`,
            body: msg,
            itemId: item.id,
          });
          showDeviceNotification(`یادآوری: ${item.title}`, msg, `rem_${key}`);
        }
      }
    };

    checkReminders();
    const timer = setInterval(checkReminders, 45000);
    return () => clearInterval(timer);
  }, [user, items]);

  // Auto-hide toast after 6 seconds
  useEffect(() => {
    if (!liveToast) return;
    const t = setTimeout(() => setLiveToast(null), 6500);
    return () => clearTimeout(t);
  }, [liveToast]);

  const signInWithGoogle = useCallback(async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'خطا در ورود با حساب گوگل';
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length + incomingInvites.length,
    [notifications, incomingInvites]
  );

  const value: AppContextValue = {
    user,
    authReady,
    authLoading,
    authError,
    profile,
    memberships,
    activeWorkspaceId,
    setActiveWorkspaceId,
    activeWorkspace,
    members,
    items,
    itemsLoading,
    notifications,
    unreadCount,
    incomingInvites,
    outgoingInvites,
    activeTab,
    setActiveTab,
    theme,
    toggleTheme,
    notifPermission,
    enableDeviceNotifications,
    liveToast,
    dismissLiveToast,
    signInWithGoogle,
    signOutUser,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
