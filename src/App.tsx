import React, { useMemo, useState } from 'react';
import {
  Bell,
  CalendarDays,
  CheckSquare,
  Home,
  Loader2,
  LogOut,
  Moon,
  Plus,
  Sun,
  Users,
} from 'lucide-react';
import { ActiveTab, AppProvider, useApp } from './context/AppContext';
import { LoginScreen } from './components/LoginScreen';
import { WorkspaceSetupBanner } from './components/WorkspaceSetupBanner';
import { DashboardView } from './components/DashboardView';
import { JalaliCalendarView } from './components/JalaliCalendarView';
import { ItemsListView } from './components/ItemsListView';
import { TeamWorkspaceView } from './components/TeamWorkspaceView';
import { NotificationsView } from './components/NotificationsView';
import { ItemFormModal } from './components/ItemFormModal';
import { ItemDetailModal } from './components/ItemDetailModal';
import { LiveToast } from './components/LiveToast';
import { OfflineIndicator } from './components/OfflineIndicator';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ItemType, WorkspaceItem } from './types/hamahangi';
import { toPersianDigits } from './lib/jalali';

const MainShell: React.FC = () => {
  const {
    user,
    authReady,
    memberships,
    activeWorkspaceId,
    setActiveWorkspaceId,
    activeWorkspace,
    items,
    incomingInvites,
    activeTab,
    setActiveTab,
    theme,
    toggleTheme,
    signOutUser,
    passwordRecovery,
  } = useApp();

  const [formOpen, setFormOpen] = useState(false);
  const [formInitialDate, setFormInitialDate] = useState<string | undefined>(undefined);
  const [formInitialType, setFormInitialType] = useState<ItemType>('meeting');
  const [editingItem, setEditingItem] = useState<WorkspaceItem | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const selectedItem = useMemo(
    () => items.find((i) => i.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
          در حال اتصال به هماهنگی...
        </p>
      </div>
    );
  }

  if (passwordRecovery) return <LoginScreen />;

  if (!user) {
    return <LoginScreen />;
  }

  const openCreateModal = (defaultDate?: string, defaultType: ItemType = 'meeting') => {
    setEditingItem(null);
    setFormInitialDate(defaultDate);
    setFormInitialType(defaultType);
    setFormOpen(true);
  };

  const openEditModal = (item: WorkspaceItem) => {
    setSelectedItemId(null);
    setEditingItem(item);
    setFormOpen(true);
  };

  const navItems: {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: 'today', label: 'امروز', icon: Home },
    { id: 'calendar', label: 'تقویم شمسی', icon: CalendarDays },
    { id: 'items', label: 'کارها و جلسات', icon: CheckSquare },
    { id: 'team', label: 'گروه کاری', icon: Users, badge: incomingInvites.length },
    { id: 'notifications', label: 'تنظیمات', icon: Bell },
  ];

  const hasWorkspace = memberships.length > 0 && activeWorkspace;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex">
      {/* Desktop RTL Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 lg:right-0 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 z-30">
        <div className="h-16 px-5 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2.5">
          <img
            src={`${import.meta.env.BASE_URL}icon.svg`}
            alt="نشان هماهنگی"
            className="w-8 h-8 rounded-xl shrink-0"
            referrerPolicy="no-referrer"
          />
          <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            هماهنگی
          </span>
        </div>

        <div className="p-4 flex-1 flex flex-col justify-between gap-6 overflow-y-auto">
          <div className="space-y-5">
            {memberships.length > 0 && (
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-1">
                  گروه کاری فعال
                </label>
                <select
                  value={activeWorkspaceId ?? ''}
                  onChange={(e) => setActiveWorkspaceId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold text-slate-900 dark:text-slate-100 min-h-[40px]"
                >
                  {memberships.map((m) => (
                    <option key={m.workspaceId} value={m.workspaceId}>
                      {m.workspaceName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <nav className="space-y-1">
              {navItems.map((nav) => {
                const Icon = nav.icon;
                const active = activeTab === nav.id;
                return (
                  <button
                    key={nav.id}
                    onClick={() => setActiveTab(nav.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors min-h-[44px] ${
                      active
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="whitespace-nowrap">{nav.label}</span>
                    </span>
                    {nav.badge !== undefined && nav.badge > 0 && (
                      <span className="min-w-[22px] h-[22px] px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center tabular-nums">
                        {toPersianDigits(nav.badge)}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2.5 px-1">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName ?? 'کاربر'}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold shrink-0">
                  {(user.displayName || user.email || 'ک').slice(0, 1)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {user.displayName || 'کاربر هماهنگی'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" dir="ltr">
                  {user.email}
                </p>
              </div>
              <button
                onClick={signOutUser}
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                aria-label="خروج از حساب"
                title="خروج از حساب"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            <p className="px-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              نسخه آزمایشی · ساخته‌شده توسط سید حسین موسوی
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 lg:pr-64 flex flex-col min-w-0">
        {/* Top Bar (Compact 48px mobile / 64px desktop) */}
        <header className="sticky top-0 z-20 h-12 lg:h-16 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={`${import.meta.env.BASE_URL}icon.svg`}
              alt="نشان هماهنگی"
              className="w-7 h-7 rounded-lg lg:hidden shrink-0"
              referrerPolicy="no-referrer"
            />
            <span className="text-sm lg:text-base font-extrabold text-slate-900 dark:text-white truncate">
              {activeWorkspace ? activeWorkspace.name : 'هماهنگی'}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleTheme}
              className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="تغییر تم روشن و تاریک"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={signOutUser}
              className="lg:hidden min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="خروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 w-full max-w-6xl mx-auto px-4 lg:px-8 py-5 pb-24 lg:pb-10">
          {!hasWorkspace ? (
            <WorkspaceSetupBanner />
          ) : (
            <>
              {activeTab === 'today' && (
                <DashboardView
                  onCreateNew={(d) => openCreateModal(d, 'meeting')}
                  onOpenItem={(it) => setSelectedItemId(it.id)}
                />
              )}
              {activeTab === 'calendar' && (
                <JalaliCalendarView
                  onCreateNew={(d) => openCreateModal(d, 'meeting')}
                  onOpenItem={(it) => setSelectedItemId(it.id)}
                />
              )}
              {activeTab === 'items' && (
                <ItemsListView
                  onCreateNew={(d, t) => openCreateModal(d, t)}
                  onOpenItem={(it) => setSelectedItemId(it.id)}
                />
              )}
              {activeTab === 'team' && <TeamWorkspaceView />}
              {activeTab === 'notifications' && (
                <NotificationsView />
              )}
            </>
          )}

          <footer className="mt-10 pt-4 border-t border-slate-200/70 dark:border-slate-800/70 text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <span>این نسخه از برنامه آزمایشی است و توسط سید حسین موسوی ساخته شده است.</span>
            <a
              href="https://ble.ir/gomnam74"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              ارتباط با سازنده
            </a>
          </footer>
        </main>
      </div>

      {/* Mobile Floating Action Button (FAB) in Thumb Zone */}
      {hasWorkspace && (
        <button
          onClick={() => openCreateModal(undefined, 'meeting')}
          className="lg:hidden fixed bottom-18 left-4 z-30 w-13 h-13 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center transition-transform"
          aria-label="ثبت جلسه یا کار جدید"
        >
          <Plus className="w-6 h-6" />
        </button>
      )}

      {/* Mobile Fixed Bottom Navigation Bar (compact 56px + safe-area) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 pb-safe">
        <div className="grid grid-cols-5 h-14 items-center">
          {navItems.map((nav) => {
            const Icon = nav.icon;
            const active = activeTab === nav.id;
            return (
              <button
                key={nav.id}
                onClick={() => setActiveTab(nav.id)}
                className={`relative flex flex-col items-center justify-center h-full gap-0.5 transition-colors ${
                  active
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {nav.badge !== undefined && nav.badge > 0 && (
                    <span className="absolute -top-1.5 -left-2 min-w-[16px] h-[16px] px-1 rounded-full bg-red-600 text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                      {toPersianDigits(nav.badge)}
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-semibold whitespace-nowrap">{nav.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals & Live Notifications */}
      {formOpen && (
        <ItemFormModal
          initialDate={formInitialDate}
          initialType={formInitialType}
          editingItem={editingItem}
          onClose={() => setFormOpen(false)}
        />
      )}

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItemId(null)}
          onEdit={openEditModal}
        />
      )}

      <LiveToast onOpenItem={(id) => setSelectedItemId(id)} />
      <OfflineIndicator />
    </div>
  );
};

export function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <MainShell />
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;
