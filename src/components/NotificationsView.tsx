import React from 'react';
import {
  BellRing, ExternalLink, Info, MessageCircle, Moon, Sun,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { showDeviceNotification } from '../lib/notifications';

export const NotificationsView: React.FC = () => {
  const { notifPermission, enableDeviceNotifications, theme, toggleTheme } = useApp();

  const handleTestNotification = async () => {
    const permission = notifPermission === 'granted' ? 'granted' : await enableDeviceNotifications();
    if (permission === 'granted') {
      await showDeviceNotification(
        'اعلان آزمایشی هماهنگی',
        'اعلان‌های دستگاه شما فعال است.',
        'test_notif'
      );
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">اعلان‌ها و تنظیمات گوشی</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          اعلان‌های لحظه‌ای و یادآوری‌های دستگاه
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            <BellRing className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">اعلان‌های گوشی و مرورگر</h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            وضعیت فعلی: <span className="font-bold text-slate-900 dark:text-slate-100">
              {notifPermission === 'granted' ? 'فعال' : notifPermission === 'denied' ? 'مسدود در تنظیمات دستگاه' : notifPermission === 'unsupported' ? 'پشتیبانی نمی‌شود' : 'نیاز به تأیید'}
            </span>
          </p>
          <button onClick={handleTestNotification}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-3 text-xs font-bold min-h-[42px]">
            {notifPermission === 'granted' ? 'ارسال اعلان آزمایشی' : 'فعال‌سازی اعلان گوشی'}
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-center gap-2.5">
            {theme === 'dark' ? <Moon className="w-5 h-5 text-blue-400 shrink-0" /> : <Sun className="w-5 h-5 text-amber-500 shrink-0" />}
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">ظاهر برنامه</h2>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            حالت فعلی: {theme === 'dark' ? 'تاریک (شبانه)' : 'روشن (روزانه)'}
          </p>
          <button onClick={toggleTheme}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 py-2.5 px-3 text-xs font-bold min-h-[42px]">
            تغییر به حالت {theme === 'dark' ? 'روشن' : 'تاریک'}
          </button>
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">درباره این نسخه</h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              این نسخه از برنامه آزمایشی است و توسط <strong className="text-slate-900 dark:text-slate-100">سید حسین موسوی</strong> ساخته شده است.
            </p>
          </div>
        </div>
        <a href="https://ble.ir/gomnam74" target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-4 py-2.5 text-xs font-bold min-h-[42px] whitespace-nowrap shrink-0">
          <MessageCircle className="w-4 h-4" />
          <span>ارتباط با سازنده (بله)</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </section>
    </div>
  );
};
