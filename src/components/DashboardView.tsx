import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  BellRing,
  CalendarOff,
  CalendarPlus,
  Clock,
  MapPin,
  Plus,
  UserPlus,
  Video,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  formatJalaliPretty,
  getJalaliWeekStrip,
  getTodayJalaliStr,
  PERSIAN_WEEKDAYS_FULL,
  toPersianDigits,
} from '../lib/jalali';
import { getIranHoliday } from '../lib/iranHolidays';
import { ITEM_TYPE_LABELS, WorkspaceItem } from '../types/hamahangi';
import { ItemCard } from './ItemCard';
import { respondToItemAttendance, updateItemStatus } from '../services/firestoreService';

interface DashboardViewProps {
  onCreateNew: (defaultDate?: string) => void;
  onOpenItem: (item: WorkspaceItem) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onCreateNew,
  onOpenItem,
}) => {
  const {
    user,
    activeWorkspace,
    members,
    items,
    itemsLoading,
    unreadCount,
    notifPermission,
    enableDeviceNotifications,
    setActiveTab,
  } = useApp();

  const todayStr = getTodayJalaliStr();
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const weekStrip = useMemo(() => getJalaliWeekStrip(selectedDate), [selectedDate]);
  const todayHoliday = useMemo(() => getIranHoliday(todayStr), [todayStr]);
  const selectedHoliday = useMemo(() => getIranHoliday(selectedDate), [selectedDate]);

  const dayItems = useMemo(
    () => items.filter((item) => item.jalaliDate === selectedDate),
    [items, selectedDate]
  );

  const todayMeetingsCount = useMemo(
    () =>
      items.filter(
        (i) => i.jalaliDate === todayStr && i.type === 'meeting' && i.status !== 'cancelled'
      ).length,
    [items, todayStr]
  );

  const openTasksCount = useMemo(
    () =>
      items.filter(
        (i) => i.type === 'task' && i.status !== 'completed' && i.status !== 'cancelled'
      ).length,
    [items]
  );

  const nextSpotlight = useMemo(() => {
    const now = new Date();
    const curMin = now.getHours() * 60 + now.getMinutes();
    return items.find((i) => {
      if (i.status === 'completed' || i.status === 'cancelled') return false;
      if (i.jalaliDate > todayStr) return true;
      if (i.jalaliDate === todayStr) {
        if (!i.startTime) return true;
        const [hh, mm] = i.startTime.split(':').map(Number);
        return hh * 60 + mm >= curMin - 30;
      }
      return false;
    });
  }, [items, todayStr]);

  if (!user || !activeWorkspace) return null;

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
            {activeWorkspace.name} · {toPersianDigits(members.length)} عضو متصل
          </p>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
            {formatJalaliPretty(todayStr)}
          </h1>
          {todayHoliday && (
            <p className="text-xs font-semibold text-red-600 dark:text-red-400 mt-1 flex items-center gap-1.5">
              <CalendarOff className="w-3.5 h-3.5" />
              تعطیل رسمی امروز: {todayHoliday.title}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {members.length <= 1 && (
            <button
              onClick={() => setActiveTab('team')}
              className="inline-flex items-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-3.5 py-2.5 text-xs font-bold hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors min-h-[42px] whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              دعوت همکار با ایمیل
            </button>
          )}
          <button
            onClick={() => onCreateNew(selectedDate)}
            className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-xs font-bold transition-colors min-h-[42px] whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            ثبت جلسه یا کار جدید
          </button>
        </div>
      </div>

      {/* Android/Browser Notification Prompt if not yet granted */}
      {notifPermission === 'default' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                فعال‌سازی اعلان‌های گوشی
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                با فعال‌سازی اعلان، به محض ثبت جلسه یا کار جدید توسط همکارتان روی گوشی مطلع می‌شوید.
              </p>
            </div>
          </div>
          <button
            onClick={enableDeviceNotifications}
            className="rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white px-4 py-2.5 text-xs font-bold min-h-[40px] whitespace-nowrap shrink-0"
          >
            فعال کردن اعلان
          </button>
        </div>
      )}

      {/* 3 Compact Tabular KPI Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">جلسات امروز</p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
            {toPersianDigits(todayMeetingsCount)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">کارهای در جریان</p>
          <p className="text-2xl font-extrabold text-slate-900 dark:text-white tabular-nums mt-1">
            {toPersianDigits(openTasksCount)}
          </p>
        </div>
        <button
          onClick={() => setActiveTab('notifications')}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-right hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400">اعلان خوانده‌نشده</p>
          <p
            className={`text-2xl font-extrabold tabular-nums mt-1 ${
              unreadCount > 0
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-slate-900 dark:text-white'
            }`}
          >
            {toPersianDigits(unreadCount)}
          </p>
        </button>
      </div>

      {/* Main 2-Column Responsive Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Right/Main Column: Date Scroller + Day Schedule */}
        <div className="lg:col-span-8 space-y-4">
          {/* Horizontal Shamsi 7-Day Scroller */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-1">
            {weekStrip.map((cell) => {
              const isSelected = cell.jalaliDate === selectedDate;
              const holiday = getIranHoliday(cell.jalaliDate);
              const isHolidayOrFriday = cell.isFriday || Boolean(holiday);
              const count = items.filter(
                (i) => i.jalaliDate === cell.jalaliDate && i.status !== 'cancelled'
              ).length;
              return (
                <button
                  key={cell.jalaliDate}
                  onClick={() => setSelectedDate(cell.jalaliDate)}
                  title={holiday ? holiday.title : undefined}
                  className={`flex-1 min-w-[64px] rounded-2xl py-2.5 px-2 flex flex-col items-center gap-1 transition-colors border min-h-[72px] ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : cell.isToday
                      ? 'bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900 text-slate-900 dark:text-slate-100'
                      : holiday
                      ? 'bg-red-50/60 dark:bg-red-950/20 border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <span
                    className={`text-[11px] font-medium ${
                      isSelected
                        ? 'text-blue-100'
                        : isHolidayOrFriday
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {PERSIAN_WEEKDAYS_FULL[cell.weekdayIdx].slice(0, 6)}
                  </span>
                  <span className="text-base font-extrabold tabular-nums">
                    {toPersianDigits(cell.jd)}
                  </span>
                  <span
                    className={`text-[10px] tabular-nums ${
                      isSelected ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {count > 0 ? `${toPersianDigits(count)} مورد` : holiday ? 'تعطیل' : 'آزاد'}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              برنامه {selectedDate === todayStr ? 'امروز' : formatJalaliPretty(selectedDate)}
            </h2>
            {selectedDate !== todayStr && (
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                بازگشت به امروز
              </button>
            )}
          </div>

          {selectedHoliday && (
            <div className="rounded-xl border border-red-200 dark:border-red-900/70 bg-red-50/80 dark:bg-red-950/30 px-4 py-2.5 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
              <CalendarOff className="w-4 h-4 shrink-0" />
              <span>
                <strong className="font-bold">تعطیل رسمی ایران:</strong> {selectedHoliday.title}
              </span>
            </div>
          )}

          {itemsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div
                  key={n}
                  className="h-28 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse"
                />
              ))}
            </div>
          ) : dayItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/50 p-8 text-center space-y-3">
              <CalendarPlus className="w-9 h-9 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  برای این روز موردی ثبت نشده است
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  جلسه، کار یا رویداد جدیدی ثبت کنید تا برای سایر اعضای گروه اعلان ارسال شود.
                </p>
              </div>
              <button
                onClick={() => onCreateNew(selectedDate)}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-xs font-bold min-h-[42px]"
              >
                <Plus className="w-4 h-4" />
                ثبت در این تاریخ
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {dayItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  currentUid={user.uid}
                  onOpen={onOpenItem}
                  onToggleComplete={(it) =>
                    updateItemStatus(
                      activeWorkspace,
                      members,
                      user,
                      it,
                      it.status === 'completed' ? 'scheduled' : 'completed'
                    )
                  }
                  onConfirmAttendance={(it, st) =>
                    respondToItemAttendance(activeWorkspace, members, user, it, st)
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Left/Secondary Column: Next Spotlight + Quick Links */}
        <div className="lg:col-span-4 space-y-4">
          {nextSpotlight && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-900 dark:bg-slate-900 text-white p-5 space-y-3">
              <div className="flex items-center justify-between text-xs text-blue-300">
                <span className="font-semibold">برنامه پیش‌رو</span>
                <span>{ITEM_TYPE_LABELS[nextSpotlight.type]}</span>
              </div>
              <h3 className="text-base font-extrabold leading-snug">{nextSpotlight.title}</h3>
              <div className="space-y-1.5 text-xs text-slate-300">
                <p className="tabular-nums">{formatJalaliPretty(nextSpotlight.jalaliDate)}</p>
                {nextSpotlight.startTime && (
                  <p className="flex items-center gap-1.5 tabular-nums">
                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                    ساعت {toPersianDigits(nextSpotlight.startTime)}
                  </p>
                )}
                {nextSpotlight.location && (
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    {nextSpotlight.location}
                  </p>
                )}
              </div>
              <button
                onClick={() => onOpenItem(nextSpotlight)}
                className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white py-2.5 px-4 text-xs font-bold transition-colors min-h-[42px]"
              >
                <Video className="w-4 h-4" />
                مشاهده جزئیات
              </button>
            </div>
          )}

          {/* Connected Team Quick Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                اعضای متصل با ایمیل
              </h3>
              <button
                onClick={() => setActiveTab('team')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 inline-flex items-center gap-1 hover:underline"
              >
                مدیریت
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {members.slice(0, 4).map((m) => (
                <div key={m.uid} className="py-2.5 flex items-center gap-2.5">
                  {m.photoURL ? (
                    <img
                      src={m.photoURL}
                      alt={m.displayName}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold shrink-0">
                      {m.displayName.slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                      {m.displayName}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate" dir="ltr">
                      {m.email}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
