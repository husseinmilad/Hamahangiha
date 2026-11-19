import React from 'react';
import {
  Bell,
  BellRing,
  Check,
  CheckCheck,
  ExternalLink,
  Info,
  MessageCircle,
  Moon,
  Smartphone,
  Sun,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { formatRelativeTimePersian, toPersianDigits } from '../lib/jalali';
import { deleteNotification, markNotificationRead } from '../services/supabaseService';
import { showDeviceNotification } from '../lib/notifications';
import { PWAInstallButton } from './PWAInstallButton';

interface NotificationsViewProps {
  onOpenItemById: (itemId: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onOpenItemById }) => {
  const {
    user,
    notifications,
    notifPermission,
    enableDeviceNotifications,
    theme,
    toggleTheme,
  } = useApp();

  if (!user) return null;

  const unreadList = notifications.filter((n) => !n.read);

  const handleMarkAllRead = async () => {
    await Promise.all(
      unreadList.map((n) => markNotificationRead(user.uid, n.id))
    );
  };

  const handleTestNotification = async () => {
    const perm = notifPermission === 'granted' ? 'granted' : await enableDeviceNotifications();
    if (perm === 'granted') {
      await showDeviceNotification(
        'اعلان آزمایشی هماهنگی',
        'اعلان‌های گوشی شما با موفقیت فعال است و پیام‌های هم‌گروهی‌ها بلافاصله نمایش داده می‌شوند.',
        'test_notif'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            اعلان‌ها و تنظیمات گوشی
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
            {toPersianDigits(unreadList.length)} اعلان خوانده‌نشده
          </p>
        </div>

        {unreadList.length > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 min-h-[40px]"
          >
            <CheckCheck className="w-4 h-4 text-blue-600" />
            خواندن همه
          </button>
        )}
      </div>

      {/* Android App & Device Notifications Controls */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <BellRing className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              اعلان‌های گوشی و مرورگر
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            وضعیت فعلی:{' '}
            <span className="font-bold text-slate-900 dark:text-slate-100">
              {notifPermission === 'granted'
                ? 'فعال'
                : notifPermission === 'denied'
                ? 'مسدود در مرورگر'
                : notifPermission === 'unsupported'
                ? 'پشتیبانی نمی‌شود'
                : 'نیاز به تأیید'}
            </span>
          </p>
          <button
            onClick={handleTestNotification}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-3 text-xs font-bold min-h-[42px]"
          >
            {notifPermission === 'granted' ? 'ارسال اعلان آزمایشی' : 'فعال‌سازی اعلان گوشی'}
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              نصب نسخه اندروید
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            نسخه مستقل اندروید با APK نصب می‌شود؛ نسخه وب نیز از طریق مرورگر قابل افزودن به صفحه اصلی است.
          </p>
          <PWAInstallButton variant="full" />
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            {theme === 'dark' ? (
              <Moon className="w-5 h-5 text-blue-400 shrink-0" />
            ) : (
              <Sun className="w-5 h-5 text-amber-500 shrink-0" />
            )}
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              ظاهر برنامه
            </h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            حالت فعلی: {theme === 'dark' ? 'تاریک (شبانه)' : 'روشن (روزانه)'}
          </p>
          <button
            onClick={toggleTheme}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 py-2.5 px-3 text-xs font-bold min-h-[42px]"
          >
            تغییر به حالت {theme === 'dark' ? 'روشن' : 'تاریک'}
          </button>
        </div>
      </div>

      {/* Beta Version & Creator Info */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              درباره این نسخه
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              این نسخه از برنامه آزمایشی است و توسط <strong className="text-slate-900 dark:text-slate-100">سید حسین موسوی</strong> ساخته شده است.
            </p>
          </div>
        </div>
        <a
          href="https://ble.ir/gomnam74"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-4 py-2.5 text-xs font-bold min-h-[42px] whitespace-nowrap shrink-0"
        >
          <MessageCircle className="w-4 h-4" />
          <span>ارتباط با سازنده (بله)</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </section>

      {/* Notifications List */}
      {notifications.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center space-y-2">
          <Bell className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
            هنوز اعلانی دریافت نکرده‌اید
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            وقتی همکارتان جلسه‌ای ثبت کند یا پاسخ دهد، اینجا و روی گوشی شما نمایش داده می‌شود.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 flex items-start justify-between gap-3 transition-colors ${
                !n.read ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
              }`}
            >
              <button
                onClick={async () => {
                  if (!n.read) await markNotificationRead(user.uid, n.id);
                  if (n.itemType !== 'invite' && n.itemType !== 'system') {
                    onOpenItemById(n.itemId);
                  }
                }}
                className="flex-1 text-right space-y-1 min-w-0"
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {n.workspaceName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{n.senderName}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {formatRelativeTimePersian(n.createdAt ? new Date(n.createdAt) : undefined)}
                  </span>
                  {!n.read && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">جدید</span>
                    </>
                  )}
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  {n.title}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {n.body}
                </p>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                {!n.read && (
                  <button
                    onClick={() => markNotificationRead(user.uid, n.id)}
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/40"
                    aria-label="علامت خوانده‌شده"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => deleteNotification(user.uid, n.id)}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  aria-label="حذف اعلان"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
