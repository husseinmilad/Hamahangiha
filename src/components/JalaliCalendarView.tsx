import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  formatJalaliPretty,
  getJalaliMonthGrid,
  getTodayJalaliParts,
  getTodayJalaliStr,
  PERSIAN_MONTHS,
  PERSIAN_WEEKDAYS_SHORT,
  toPersianDigits,
} from '../lib/jalali';
import { WorkspaceItem } from '../types/hamahangi';
import { ItemCard } from './ItemCard';
import { respondToItemAttendance, updateItemStatus } from '../services/firestoreService';

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

  const [viewYear, setViewYear] = useState(todayParts.jy);
  const [viewMonth, setViewMonth] = useState(todayParts.jm);
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const cells = useMemo(() => getJalaliMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

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
    setViewYear(t.jy);
    setViewMonth(t.jm);
    setSelectedDate(getTodayJalaliStr());
  };

  if (!user || !activeWorkspace) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            تقویم کامل شمسی
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            برای مشاهده یا ثبت جلسه و رویداد، هر روز را لمس کنید
          </p>
        </div>

        <button
          onClick={goToday}
          className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 min-h-[40px]"
        >
          برو به امروز
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Monthly Shamsi Calendar Grid */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4">
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
              const hasMeeting = dayList.some((i) => i.type === 'meeting');
              const hasTask = dayList.some((i) => i.type === 'task');
              const hasEvent = dayList.some((i) => i.type === 'event');

              return (
                <button
                  key={cell.jalaliDate}
                  onClick={() => setSelectedDate(cell.jalaliDate)}
                  className={`min-h-[52px] sm:min-h-[60px] rounded-xl p-1.5 flex flex-col items-center justify-between transition-colors border ${
                    isSelected
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : cell.isToday
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                      : cell.isCurrentMonth
                      ? 'bg-slate-50/60 dark:bg-slate-800/40 border-transparent hover:border-slate-300 dark:hover:border-slate-700 text-slate-900 dark:text-slate-100'
                      : 'bg-transparent border-transparent text-slate-400 dark:text-slate-600'
                  }`}
                >
                  <span
                    className={`text-xs sm:text-sm font-bold tabular-nums ${
                      !isSelected && cell.isFriday && cell.isCurrentMonth
                        ? 'text-red-500'
                        : ''
                    }`}
                  >
                    {toPersianDigits(cell.jd)}
                  </span>

                  {/* Subtle Event Type Dots */}
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

          {selectedDayItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-center space-y-2">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                برنامه‌ای در این تاریخ نیست
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                می‌توانید همین حالا جلسه یا کار جدیدی اضافه کنید.
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
    </div>
  );
};
