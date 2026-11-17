import React from 'react';
import {
  addDaysToJalali,
  formatJalaliPretty,
  formatJalaliStr,
  getJalaliMonthLength,
  getTodayJalaliParts,
  getTodayJalaliStr,
  parseJalaliStr,
  PERSIAN_MONTHS,
  toPersianDigits,
} from '../lib/jalali';

interface JalaliDatePickerProps {
  value: string;
  onChange: (jalaliDate: string) => void;
}

export const JalaliDatePicker: React.FC<JalaliDatePickerProps> = ({ value, onChange }) => {
  const { jy, jm, jd } = parseJalaliStr(value);
  const todayParts = getTodayJalaliParts();
  const years = [
    todayParts.jy - 1,
    todayParts.jy,
    todayParts.jy + 1,
    todayParts.jy + 2,
  ];
  const maxDays = getJalaliMonthLength(jy, jm);
  const days = Array.from({ length: maxDays }, (_, idx) => idx + 1);

  const todayStr = getTodayJalaliStr();
  const tomorrowStr = addDaysToJalali(todayStr, 1);
  const dayAfterStr = addDaysToJalali(todayStr, 2);

  const handlePartsChange = (newY: number, newM: number, newD: number) => {
    const validMax = getJalaliMonthLength(newY, newM);
    const clampedD = Math.min(newD, validMax);
    onChange(formatJalaliStr(newY, newM, clampedD));
  };

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          تاریخ شمسی: <span className="text-blue-600 dark:text-blue-400">{formatJalaliPretty(value)}</span>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onChange(todayStr)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors min-h-[32px] ${
              value === todayStr
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            امروز
          </button>
          <button
            type="button"
            onClick={() => onChange(tomorrowStr)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors min-h-[32px] ${
              value === tomorrowStr
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            فردا
          </button>
          <button
            type="button"
            onClick={() => onChange(dayAfterStr)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors min-h-[32px] ${
              value === dayAfterStr
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            پس‌فردا
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <select
          aria-label="روز شمسی"
          value={jd}
          onChange={(e) => handlePartsChange(jy, jm, Number(e.target.value))}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
        >
          {days.map((d) => (
            <option key={d} value={d}>
              {toPersianDigits(d)}
            </option>
          ))}
        </select>

        <select
          aria-label="ماه شمسی"
          value={jm}
          onChange={(e) => handlePartsChange(jy, Number(e.target.value), jd)}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
        >
          {PERSIAN_MONTHS.map((name, idx) => (
            <option key={name} value={idx + 1}>
              {name}
            </option>
          ))}
        </select>

        <select
          aria-label="سال شمسی"
          value={jy}
          onChange={(e) => handlePartsChange(Number(e.target.value), jm, jd)}
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {toPersianDigits(y)}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};
