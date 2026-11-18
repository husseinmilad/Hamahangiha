import jalaali from 'jalaali-js';

export const PERSIAN_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

export const PERSIAN_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const;
export const PERSIAN_WEEKDAYS_FULL = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
] as const;

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export function toPersianDigits(input: string | number): string {
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function formatJalaliStr(jy: number, jm: number, jd: number): string {
  return `${jy}/${pad2(jm)}/${pad2(jd)}`;
}

export function formatGregorianStr(gy: number, gm: number, gd: number): string {
  return `${gy}-${pad2(gm)}-${pad2(gd)}`;
}

export function parseJalaliStr(jStr: string): { jy: number; jm: number; jd: number } {
  const parts = jStr.split('/').map((p) => parseInt(p, 10));
  if (parts.length === 3 && !parts.some(Number.isNaN)) {
    return { jy: parts[0], jm: parts[1], jd: parts[2] };
  }
  return getTodayJalaliParts();
}

export function getTodayJalaliParts(): { jy: number; jm: number; jd: number } {
  const now = new Date();
  return jalaali.toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function getTodayJalaliStr(): string {
  const { jy, jm, jd } = getTodayJalaliParts();
  return formatJalaliStr(jy, jm, jd);
}

export function getTodayGregorianStr(): string {
  const now = new Date();
  return formatGregorianStr(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function jalaliToGregorianStr(jalaliStr: string): string {
  const { jy, jm, jd } = parseJalaliStr(jalaliStr);
  const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
  return formatGregorianStr(gy, gm, gd);
}

export function gregorianDateToJalaliStr(date: Date): string {
  const { jy, jm, jd } = jalaali.toJalaali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );
  return formatJalaliStr(jy, jm, jd);
}

export function addDaysToJalali(jalaliStr: string, offsetDays: number): string {
  const { jy, jm, jd } = parseJalaliStr(jalaliStr);
  const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
  const dt = new Date(gy, gm - 1, gd + offsetDays);
  return gregorianDateToJalaliStr(dt);
}

/**
 * Returns 0 for Saturday (شنبه) ... 6 for Friday (جمعه)
 */
export function getPersianWeekdayIndex(jy: number, jm: number, jd: number): number {
  const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
  const jsDay = new Date(gy, gm - 1, gd).getDay(); // 0=Sun..6=Sat
  return (jsDay + 1) % 7;
}

export function getJalaliMonthLength(jy: number, jm: number): number {
  return jalaali.jalaaliMonthLength(jy, jm);
}

export function isJalaliLeapYear(jy: number): boolean {
  return jalaali.isLeapJalaaliYear(jy);
}

export function formatJalaliPretty(jalaliStr: string): string {
  const { jy, jm, jd } = parseJalaliStr(jalaliStr);
  const weekdayIdx = getPersianWeekdayIndex(jy, jm, jd);
  const weekday = PERSIAN_WEEKDAYS_FULL[weekdayIdx];
  const monthName = PERSIAN_MONTHS[jm - 1] ?? '';
  return `${weekday} ${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`;
}

export function formatJalaliShort(jalaliStr: string): string {
  const { jy, jm, jd } = parseJalaliStr(jalaliStr);
  const monthName = PERSIAN_MONTHS[jm - 1] ?? '';
  return `${toPersianDigits(jd)} ${monthName} ${toPersianDigits(jy)}`;
}

export interface JalaliCalendarCell {
  jalaliDate: string;
  gregorianDate: string;
  jy: number;
  jm: number;
  jd: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isFriday: boolean;
  weekdayIdx: number;
}

export function getJalaliMonthGrid(jy: number, jm: number): JalaliCalendarCell[] {
  const todayStr = getTodayJalaliStr();
  const firstDayWeekday = getPersianWeekdayIndex(jy, jm, 1); // 0=Sat..6=Fri
  const daysInMonth = getJalaliMonthLength(jy, jm);

  const prevMonth = jm === 1 ? 12 : jm - 1;
  const prevYear = jm === 1 ? jy - 1 : jy;
  const daysInPrevMonth = getJalaliMonthLength(prevYear, prevMonth);

  const cells: JalaliCalendarCell[] = [];

  // Leading days from previous month
  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    const jd = daysInPrevMonth - i;
    const jStr = formatJalaliStr(prevYear, prevMonth, jd);
    const weekdayIdx = getPersianWeekdayIndex(prevYear, prevMonth, jd);
    cells.push({
      jalaliDate: jStr,
      gregorianDate: jalaliToGregorianStr(jStr),
      jy: prevYear,
      jm: prevMonth,
      jd,
      isCurrentMonth: false,
      isToday: jStr === todayStr,
      isFriday: weekdayIdx === 6,
      weekdayIdx,
    });
  }

  // Current month days
  for (let jd = 1; jd <= daysInMonth; jd++) {
    const jStr = formatJalaliStr(jy, jm, jd);
    const weekdayIdx = getPersianWeekdayIndex(jy, jm, jd);
    cells.push({
      jalaliDate: jStr,
      gregorianDate: jalaliToGregorianStr(jStr),
      jy,
      jm,
      jd,
      isCurrentMonth: true,
      isToday: jStr === todayStr,
      isFriday: weekdayIdx === 6,
      weekdayIdx,
    });
  }

  // Trailing days to complete weeks (multiple of 7)
  const nextMonth = jm === 12 ? 1 : jm + 1;
  const nextYear = jm === 12 ? jy + 1 : jy;
  let nextDay = 1;
  while (cells.length % 7 !== 0) {
    const jStr = formatJalaliStr(nextYear, nextMonth, nextDay);
    const weekdayIdx = getPersianWeekdayIndex(nextYear, nextMonth, nextDay);
    cells.push({
      jalaliDate: jStr,
      gregorianDate: jalaliToGregorianStr(jStr),
      jy: nextYear,
      jm: nextMonth,
      jd: nextDay,
      isCurrentMonth: false,
      isToday: jStr === todayStr,
      isFriday: weekdayIdx === 6,
      weekdayIdx,
    });
    nextDay++;
  }

  return cells;
}

export function getJalaliWeekStrip(centerJalaliStr: string): JalaliCalendarCell[] {
  const todayStr = getTodayJalaliStr();
  const result: JalaliCalendarCell[] = [];
  for (let offset = -2; offset <= 4; offset++) {
    const jStr = addDaysToJalali(centerJalaliStr, offset);
    const { jy, jm, jd } = parseJalaliStr(jStr);
    const weekdayIdx = getPersianWeekdayIndex(jy, jm, jd);
    result.push({
      jalaliDate: jStr,
      gregorianDate: jalaliToGregorianStr(jStr),
      jy,
      jm,
      jd,
      isCurrentMonth: true,
      isToday: jStr === todayStr,
      isFriday: weekdayIdx === 6,
      weekdayIdx,
    });
  }
  return result;
}

export function getJalaliSaturdayWeek(jalaliStr: string): JalaliCalendarCell[] {
  const { jy, jm, jd } = parseJalaliStr(jalaliStr);
  const weekdayIdx = getPersianWeekdayIndex(jy, jm, jd); // 0=Sat .. 6=Fri
  const saturdayStr = addDaysToJalali(jalaliStr, -weekdayIdx);
  const todayStr = getTodayJalaliStr();
  const result: JalaliCalendarCell[] = [];

  for (let i = 0; i < 7; i++) {
    const jStr = addDaysToJalali(saturdayStr, i);
    const parts = parseJalaliStr(jStr);
    const wd = getPersianWeekdayIndex(parts.jy, parts.jm, parts.jd);
    result.push({
      jalaliDate: jStr,
      gregorianDate: jalaliToGregorianStr(jStr),
      jy: parts.jy,
      jm: parts.jm,
      jd: parts.jd,
      isCurrentMonth: true,
      isToday: jStr === todayStr,
      isFriday: wd === 6,
      weekdayIdx: wd,
    });
  }

  return result;
}

export function formatRelativeTimePersian(date: Date | undefined): string {
  if (!date) return 'هم‌اکنون';
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 45) return 'هم‌اکنون';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${toPersianDigits(diffMin)} دقیقه پیش`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${toPersianDigits(diffHr)} ساعت پیش`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'دیروز';
  if (diffDay < 30) return `${toPersianDigits(diffDay)} روز پیش`;
  return formatJalaliShort(gregorianDateToJalaliStr(date));
}
