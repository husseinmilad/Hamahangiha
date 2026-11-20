import React, { useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import {
  CalendarDays,
  CalendarOff,
  CalendarRange,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Loader2,
  MapPin,
  Plus,
  Share2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  addDaysToJalali,
  formatJalaliPretty,
  formatJalaliShort,
  getJalaliMonthGrid,
  getJalaliSaturdayWeek,
  getTodayJalaliParts,
  getTodayJalaliStr,
  PERSIAN_MONTHS,
  PERSIAN_WEEKDAYS_FULL,
  PERSIAN_WEEKDAYS_SHORT,
  toPersianDigits,
} from '../lib/jalali';
import {
  formatHolidayDayLabel,
  getIranHoliday,
  getMonthIranHolidays,
} from '../lib/iranHolidays';
import {
  buildWeeklyTextSummary,
  renderWeeklySchedulePng,
} from '../lib/weeklyImageExport';
import { ITEM_TYPE_LABELS, WorkspaceItem } from '../types/hamahangi';
import { ItemCard } from './ItemCard';
import { respondToItemAttendance, updateItemStatus } from '../services/supabaseService';

interface JalaliCalendarViewProps {
  onCreateNew: (defaultDate?: string) => void;
  onOpenItem: (item: WorkspaceItem) => void;
}

export const JalaliCalendarView: React.FC<JalaliCalendarViewProps> = ({
  onCreateNew,
  onOpenItem,
}) => {
  const { user, activeWorkspace, members, items } = useApp();
  const todayParts = getTodayJalaliParts();
  const todayStr = getTodayJalaliStr();

  const [calendarMode, setCalendarMode] = useState<'monthly' | 'weekly'>('monthly');
  const [viewYear, setViewYear] = useState(todayParts.jy);
  const [viewMonth, setViewMonth] = useState(todayParts.jm);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [weekAnchorDate, setWeekAnchorDate] = useState(todayStr);

  const [exportingImage, setExportingImage] = useState(false);
  const [sharingWeek, setSharingWeek] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const cells = useMemo(() => getJalaliMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const monthHolidays = useMemo(
    () => getMonthIranHolidays(viewYear, viewMonth),
    [viewYear, viewMonth]
  );
  const selectedHoliday = useMemo(() => getIranHoliday(selectedDate), [selectedDate]);
  const weekDays = useMemo(() => getJalaliSaturdayWeek(weekAnchorDate), [weekAnchorDate]);

  const itemsByDate = useMemo(() => {
    const map = new Map<string, WorkspaceItem[]>();
    for (const item of items) {
      if (item.status === 'cancelled') continue;
      const list = map.get(item.jalaliDate) ?? [];
      list.push(item);
      map.set(item.jalaliDate, list);
    }
    return map;
  }, [items]);

  const selectedDayItems = useMemo(
    () => items.filter((i) => i.jalaliDate === selectedDate),
    [items, selectedDate]
  );

  const goPrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    const t = getTodayJalaliParts();
    const today = getTodayJalaliStr();
    setViewYear(t.jy);
    setViewMonth(t.jm);
    setSelectedDate(today);
    setWeekAnchorDate(today);
  };

  const showFeedback = (msg: string) => {
    setActionFeedback(msg);
    setTimeout(() => setActionFeedback(null), 3500);
  };

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('خواندن فایل تصویر ناموفق بود.'));
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result !== 'string') return reject(new Error('تبدیل تصویر ناموفق بود.'));
        resolve(result.split(',')[1] || '');
      };
      reader.readAsDataURL(blob);
    });

  const saveOrShareNativeImage = async (blob: Blob, filename: string, share: boolean, summaryText?: string) => {
    const base64 = await blobToBase64(blob);
    const saved = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    if (share) {
      await Share.share({
        title: `برنامه هفتگی ${activeWorkspace?.name ?? ''}`,
        text: summaryText,
        files: [saved.uri],
        dialogTitle: 'اشتراک‌گذاری تصویر برنامه هفتگی',
      });
    } else {
      await Filesystem.writeFile({
        path: `Hamahangiha/${filename}`,
        data: base64,
        directory: Directory.Documents,
        recursive: true,
      });
      showFeedback('تصویر در پوشه Documents/Hamahangiha ذخیره شد.');
    }
  };

  const triggerBlobDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Keep the object URL alive longer for Android WebView download handling.
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleDownloadWeeklyPng = async () => {
    if (!activeWorkspace) return;
    setExportingImage(true);
    try {
      const blob = await renderWeeklySchedulePng(activeWorkspace.name, weekDays, items);
      const filename = `hamahangi-week-${weekDays[0].jalaliDate.replace(/\//g, '-')}.png`;
      if (Capacitor.isNativePlatform()) {
        await saveOrShareNativeImage(blob, filename, false);
      } else {
        triggerBlobDownload(blob, filename);
        showFeedback('تصویر برنامه هفتگی با کیفیت بالا ذخیره شد.');
      }
    } catch {
      showFeedback('خطا در تولید تصویر برنامه هفتگی.');
    } finally {
      setExportingImage(false);
    }
  };

  const handleShareWeekly = async () => {
    if (!activeWorkspace) return;
    setSharingWeek(true);
    try {
      const blob = await renderWeeklySchedulePng(activeWorkspace.name, weekDays, items);
      const filename = `hamahangi-week-${weekDays[0].jalaliDate.replace(/\//g, '-')}.png`;
      const summaryText = buildWeeklyTextSummary(activeWorkspace.name, weekDays, items);

      if (Capacitor.isNativePlatform()) {
        await saveOrShareNativeImage(blob, filename, true, summaryText);
        showFeedback('تصویر برنامه هفتگی برای اشتراک‌گذاری آماده شد.');
      } else {
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: `برنامه هفتگی ${activeWorkspace.name}`,
            text: summaryText,
            files: [file],
          });
          showFeedback('برنامه هفتگی به اشتراک گذاشته شد.');
        } else {
          triggerBlobDownload(blob, filename);
          if (navigator.share) {
            await navigator.share({ title: `برنامه هفتگی ${activeWorkspace.name}`, text: summaryText });
            showFeedback('متن و تصویر برنامه آماده شدند؛ تصویر دانلود شد.');
          } else {
            await navigator.clipboard?.writeText(summaryText).catch(() => {});
            showFeedback('تصویر دانلود و متن خلاصه کپی شد.');
          }
        }
      }
    } catch (err) {
      // Ignore user cancelling native share sheet
      if (err instanceof Error && err.name !== 'AbortError') {
        showFeedback('امکان اشتراک‌گذاری مستقیم نبود؛ از دکمه ذخیره عکس استفاده کنید.');
      }
    } finally {
      setSharingWeek(false);
    }
  };

  if (!user || !activeWorkspace) return null;

  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  return (
    <div className="space-y-6">
      {/* Header + Segmented Switcher (Monthly vs Weekly) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            تقویم کامل شمسی
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            نمای ماهانه و هفتگی همراه با تعطیلات رسمی ایران و خروجی تصویری
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              onClick={() => setCalendarMode('monthly')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[38px] whitespace-nowrap ${
                calendarMode === 'monthly'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              تقویم ماهانه
            </button>
            <button
              onClick={() => setCalendarMode('weekly')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[38px] whitespace-nowrap ${
                calendarMode === 'weekly'
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CalendarRange className="w-4 h-4" />
              تقویم هفتگی
            </button>
          </div>

          <button
            onClick={goToday}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 min-h-[40px]"
          >
            امروز
          </button>
        </div>
      </div>

      {/* ==================== MONTHLY CALENDAR VIEW ==================== */}
      {calendarMode === 'monthly' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Monthly Shamsi Calendar Grid + Month Holidays */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
              {/* Month Controls */}
              <div className="flex items-center justify-between">
                <button
                  onClick={goPrevMonth}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  aria-label="ماه قبل"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {PERSIAN_MONTHS[viewMonth - 1]} {toPersianDigits(viewYear)}
                </h2>
                <button
                  onClick={goNextMonth}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                  aria-label="ماه بعد"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 text-center">
                {PERSIAN_WEEKDAYS_SHORT.map((wd, idx) => (
                  <div
                    key={wd}
                    className={`py-2 text-xs font-bold ${
                      idx === 6 ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {wd}
                  </div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {cells.map((cell) => {
                  const dayList = itemsByDate.get(cell.jalaliDate) ?? [];
                  const isSelected = cell.jalaliDate === selectedDate;
                  const holiday = getIranHoliday(cell.jalaliDate);
                  const isHolidayOrFriday = cell.isFriday || Boolean(holiday);
                  const hasMeeting = dayList.some((i) => i.type === 'meeting');
                  const hasTask = dayList.some((i) => i.type === 'task');
                  const hasEvent = dayList.some((i) => i.type === 'event');

                  return (
                    <button
                      key={cell.jalaliDate}
                      onClick={() => setSelectedDate(cell.jalaliDate)}
                      title={holiday ? `تعطیل رسمی: ${holiday.title}` : undefined}
                      className={`min-h-[54px] sm:min-h-[62px] rounded-xl p-1.5 flex flex-col items-center justify-between transition-colors border ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : cell.isToday
                          ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                          : holiday && cell.isCurrentMonth
                          ? 'bg-red-50/70 dark:bg-red-950/25 border-red-200/70 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:border-red-300'
                          : cell.isCurrentMonth
                          ? 'bg-slate-50/60 dark:bg-slate-800/40 border-transparent hover:border-slate-300 dark:hover:border-slate-700 text-slate-900 dark:text-slate-100'
                          : 'bg-transparent border-transparent text-slate-400 dark:text-slate-600'
                      }`}
                    >
                      <span
                        className={`text-xs sm:text-sm font-bold tabular-nums ${
                          !isSelected && isHolidayOrFriday && cell.isCurrentMonth
                            ? 'text-red-600 dark:text-red-400'
                            : ''
                        }`}
                      >
                        {toPersianDigits(cell.jd)}
                      </span>

                      <div className="flex items-center gap-1 h-2">
                        {hasMeeting && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-white' : 'bg-blue-600 dark:bg-blue-400'
                            }`}
                          />
                        )}
                        {hasTask && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-emerald-200' : 'bg-emerald-600 dark:bg-emerald-400'
                            }`}
                          />
                        )}
                        {hasEvent && (
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isSelected ? 'bg-amber-200' : 'bg-amber-500'
                            }`}
                          />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  جلسه
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  کار و پیگیری
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  رویداد
                </span>
                <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  تعطیل رسمی ایران
                </span>
              </div>
            </div>

            {/* Official Iranian Holidays of this Month */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <CalendarOff className="w-4 h-4 text-red-600 dark:text-red-400" />
                  تعطیلات رسمی {PERSIAN_MONTHS[viewMonth - 1]} {toPersianDigits(viewYear)}
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {toPersianDigits(monthHolidays.length)} مناسبت
                </span>
              </div>

              {monthHolidays.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  در این ماه تعطیل رسمی میان‌هفته (به‌جز جمعه‌ها) ثبت نشده است.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {monthHolidays.map((h) => (
                    <button
                      key={h.jalaliDate}
                      onClick={() => setSelectedDate(h.jalaliDate)}
                      className={`w-full py-2.5 px-2 rounded-lg flex items-center justify-between gap-3 text-right hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                        selectedDate === h.jalaliDate ? 'bg-red-50/70 dark:bg-red-950/30' : ''
                      }`}
                    >
                      <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                        {h.title}
                      </span>
                      <span className="text-xs font-bold text-red-600 dark:text-red-400 tabular-nums shrink-0">
                        {formatHolidayDayLabel(h.jalaliDate)} {PERSIAN_MONTHS[viewMonth - 1]}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected Day Agenda */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                  {formatJalaliPretty(selectedDate)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {toPersianDigits(selectedDayItems.length)} مورد ثبت‌شده
                </p>
              </div>
              <button
                onClick={() => onCreateNew(selectedDate)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-bold min-h-[40px]"
              >
                <Plus className="w-4 h-4" />
                ثبت در این روز
              </button>
            </div>

            {selectedHoliday && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/70 bg-red-50/80 dark:bg-red-950/30 px-4 py-3 flex items-center gap-2.5 text-xs text-red-700 dark:text-red-300">
                <CalendarOff className="w-4 h-4 shrink-0" />
                <div>
                  <span className="font-bold">تعطیل رسمی ایران:</span>{' '}
                  <span>{selectedHoliday.title}</span>
                </div>
              </div>
            )}

            {selectedDayItems.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  برنامه‌ای در این تاریخ نیست
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  می‌توانید همین حالا جلسه، کار یا رویداد جدیدی اضافه کنید.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayItems.map((item) => (
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
        </div>
      )}

      {/* ==================== WEEKLY CALENDAR VIEW + IMAGE EXPORT & SHARE ==================== */}
      {calendarMode === 'weekly' && (
        <div className="space-y-4">
          {/* Week Toolbar */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center justify-between md:justify-start gap-2">
              <button
                onClick={() => setWeekAnchorDate((d) => addDaysToJalali(d, -7))}
                className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="هفته قبل"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <div className="text-center md:text-right px-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">برنامه هفته</p>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white tabular-nums">
                  {formatJalaliShort(weekStart.jalaliDate)} تا {formatJalaliShort(weekEnd.jalaliDate)}
                </h2>
              </div>

              <button
                onClick={() => setWeekAnchorDate((d) => addDaysToJalali(d, 7))}
                className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="هفته بعد"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleDownloadWeeklyPng}
                disabled={exportingImage}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 px-4 py-2.5 text-xs font-bold transition-colors min-h-[42px] whitespace-nowrap"
              >
                {exportingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                )}
                <span>ذخیره به صورت عکس</span>
              </button>

              <button
                onClick={handleShareWeekly}
                disabled={sharingWeek}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-xs font-bold transition-colors min-h-[42px] whitespace-nowrap"
              >
                {sharingWeek ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Share2 className="w-4 h-4" />
                )}
                <span>اشتراک‌گذاری برنامه هفته</span>
              </button>
            </div>
          </div>

          {actionFeedback && (
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5 flex items-center gap-2 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              <Check className="w-4 h-4 shrink-0" />
              <span>{actionFeedback}</span>
            </div>
          )}

          {/* 7-Day Executive Weekly Board (Saturday -> Friday) */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-3">
            {weekDays.map((day) => {
              const dayItems = itemsByDate.get(day.jalaliDate) ?? [];
              const holiday = getIranHoliday(day.jalaliDate);
              const isHolidayOrFriday = day.isFriday || Boolean(holiday);

              return (
                <section
                  key={day.jalaliDate}
                  className={`rounded-2xl border bg-white dark:bg-slate-900 flex flex-col overflow-hidden ${
                    day.isToday
                      ? 'border-blue-500 dark:border-blue-500'
                      : isHolidayOrFriday
                      ? 'border-red-200 dark:border-red-900/60'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {/* Day Column Header */}
                  <div
                    className={`px-3.5 py-3 border-b flex items-center justify-between gap-2 ${
                      day.isToday
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900'
                        : isHolidayOrFriday
                        ? 'bg-red-50/70 dark:bg-red-950/25 border-red-100 dark:border-red-900/40'
                        : 'bg-slate-50/80 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-extrabold ${
                          isHolidayOrFriday
                            ? 'text-red-600 dark:text-red-400'
                            : day.isToday
                            ? 'text-blue-700 dark:text-blue-300'
                            : 'text-slate-900 dark:text-slate-100'
                        }`}
                      >
                        {PERSIAN_WEEKDAYS_FULL[day.weekdayIdx]}
                        {day.isToday ? ' · امروز' : ''}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                        {formatJalaliShort(day.jalaliDate)}
                      </p>
                    </div>

                    <button
                      onClick={() => onCreateNew(day.jalaliDate)}
                      className="min-h-[34px] min-w-[34px] rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-500 hover:text-blue-600 flex items-center justify-center shrink-0"
                      aria-label={`افزودن به ${PERSIAN_WEEKDAYS_FULL[day.weekdayIdx]}`}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Holiday Banner inside day column */}
                  {holiday && (
                    <div className="px-3 py-1.5 bg-red-50/60 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900/30 text-[11px] font-semibold text-red-700 dark:text-red-300 leading-snug">
                      تعطیل: {holiday.title}
                    </div>
                  )}

                  {/* Day Items List */}
                  <div className="p-2.5 flex-1 space-y-2">
                    {dayItems.length === 0 ? (
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center py-4">
                        بدون برنامه
                      </p>
                    ) : (
                      dayItems.map((it) => (
                        <button
                          key={it.id}
                          onClick={() => onOpenItem(it)}
                          className="w-full text-right rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 hover:border-blue-300 dark:hover:border-blue-700 p-2.5 space-y-1 transition-colors"
                        >
                          <div className="flex items-center justify-between gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                            <span
                              className={`font-bold ${
                                it.type === 'meeting'
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : it.type === 'task'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {ITEM_TYPE_LABELS[it.type]}
                            </span>
                            {it.startTime && (
                              <span className="inline-flex items-center gap-0.5 tabular-nums">
                                <Clock className="w-3 h-3" />
                                {toPersianDigits(it.startTime)}
                              </span>
                            )}
                          </div>
                          <p
                            className={`text-xs font-bold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2 ${
                              it.status === 'completed' ? 'line-through text-slate-400' : ''
                            }`}
                          >
                            {it.title}
                          </p>
                          {it.location && (
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <span className="truncate">{it.location}</span>
                            </p>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
