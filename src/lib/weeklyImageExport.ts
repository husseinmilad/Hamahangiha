import { ITEM_TYPE_LABELS, WorkspaceItem } from '../types/hamahangi';
import {
  formatJalaliShort,
  JalaliCalendarCell,
  PERSIAN_WEEKDAYS_FULL,
  toPersianDigits,
} from './jalali';
import { getIranHoliday } from './iranHolidays';

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 0 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

export async function renderWeeklySchedulePng(
  workspaceName: string,
  weekDays: JalaliCalendarCell[],
  items: WorkspaceItem[]
): Promise<Blob> {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const dayGroups = weekDays.map((day) => {
    const dayItems = items.filter(
      (i) => i.jalaliDate === day.jalaliDate && i.status !== 'cancelled'
    );
    const holiday = getIranHoliday(day.jalaliDate);
    return { day, dayItems, holiday };
  });

  const width = 1200;
  const paddingX = 44;
  const headerHeight = 148;
  const footerHeight = 64;
  const rowGap = 14;
  const rowHeaderH = 44;
  const itemRowH = 42;

  const rowHeights = dayGroups.map(({ dayItems }) => {
    const count = Math.max(1, dayItems.length);
    return rowHeaderH + count * itemRowH + 16;
  });

  const totalBodyH = rowHeights.reduce((sum, h) => sum + h, 0) + rowGap * (dayGroups.length - 1);
  const height = headerHeight + 28 + totalBodyH + 24 + footerHeight;

  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.scale(scale, scale);
  ctx.direction = 'rtl';
  ctx.textBaseline = 'middle';

  // Canvas background
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, width, height);

  // Header Banner
  const grad = ctx.createLinearGradient(0, 0, width, headerHeight);
  grad.addColorStop(0, '#1E3A8A');
  grad.addColorStop(1, '#2563EB');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, headerHeight);

  // Header texts (RTL: draw from right edge)
  const rightX = width - paddingX;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#BFDBFE';
  ctx.font = '600 18px Vazirmatn, sans-serif';
  ctx.fillText(`برنامه هفتگی · ${workspaceName}`, rightX, 42);

  const firstDay = weekDays[0];
  const lastDay = weekDays[6];
  const weekRangeLabel = `از ${PERSIAN_WEEKDAYS_FULL[firstDay.weekdayIdx]} ${formatJalaliShort(
    firstDay.jalaliDate
  )} تا ${PERSIAN_WEEKDAYS_FULL[lastDay.weekdayIdx]} ${formatJalaliShort(lastDay.jalaliDate)}`;

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 30px Vazirmatn, sans-serif';
  ctx.fillText(weekRangeLabel, rightX, 92);

  // Total count on left of header
  const totalWeekItems = dayGroups.reduce((sum, g) => sum + g.dayItems.length, 0);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#E0E7FF';
  ctx.font = '700 20px Vazirmatn, sans-serif';
  ctx.fillText(`${toPersianDigits(totalWeekItems)} برنامه ثبت‌شده`, paddingX, 92);

  // Render each day card
  let cursorY = headerHeight + 28;
  const cardW = width - paddingX * 2;

  dayGroups.forEach(({ day, dayItems, holiday }, idx) => {
    const cardH = rowHeights[idx];
    const isHolidayOrFriday = day.isFriday || Boolean(holiday);

    // Card surface
    drawRoundedRect(ctx, paddingX, cursorY, cardW, cardH, 16);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = day.isToday
      ? '#2563EB'
      : isHolidayOrFriday
      ? '#FECACA'
      : '#E2E8F0';
    ctx.stroke();

    // Day Header Strip
    drawRoundedRect(ctx, paddingX + 1, cursorY + 1, cardW - 2, rowHeaderH, 14);
    ctx.fillStyle = day.isToday
      ? '#EFF6FF'
      : isHolidayOrFriday
      ? '#FEF2F2'
      : '#F1F5F9';
    ctx.fill();

    // Weekday + Shamsi Date (Right)
    ctx.textAlign = 'right';
    ctx.fillStyle = isHolidayOrFriday ? '#DC2626' : day.isToday ? '#1D4ED8' : '#0F172A';
    ctx.font = '800 18px Vazirmatn, sans-serif';
    const dayTitle = `${PERSIAN_WEEKDAYS_FULL[day.weekdayIdx]} — ${formatJalaliShort(
      day.jalaliDate
    )}${day.isToday ? ' (امروز)' : ''}`;
    ctx.fillText(dayTitle, rightX - 18, cursorY + rowHeaderH / 2 + 1);

    // Holiday / Item count (Left)
    ctx.textAlign = 'left';
    if (holiday) {
      ctx.fillStyle = '#DC2626';
      ctx.font = '700 15px Vazirmatn, sans-serif';
      ctx.fillText(`تعطیل رسمی: ${holiday.title}`, paddingX + 18, cursorY + rowHeaderH / 2 + 1);
    } else if (dayItems.length > 0) {
      ctx.fillStyle = '#64748B';
      ctx.font = '600 15px Vazirmatn, sans-serif';
      ctx.fillText(`${toPersianDigits(dayItems.length)} مورد`, paddingX + 18, cursorY + rowHeaderH / 2 + 1);
    }

    // Items inside the day
    if (dayItems.length === 0) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 16px Vazirmatn, sans-serif';
      ctx.fillText(
        holiday ? 'تعطیل رسمی — بدون برنامه ثبت‌شده' : 'برنامه‌ای ثبت نشده است',
        rightX - 18,
        cursorY + rowHeaderH + itemRowH / 2 + 4
      );
    } else {
      dayItems.forEach((item, itemIdx) => {
        const rowY = cursorY + rowHeaderH + 8 + itemIdx * itemRowH;
        const typeColor =
          item.type === 'meeting'
            ? '#2563EB'
            : item.type === 'task'
            ? '#059669'
            : '#D97706';

        // Small color indicator dot on right
        ctx.beginPath();
        ctx.arc(rightX - 24, rowY + itemRowH / 2, 5, 0, Math.PI * 2);
        ctx.fillStyle = item.status === 'completed' ? '#94A3B8' : typeColor;
        ctx.fill();

        // Time + Type + Title
        const timeStr = item.startTime
          ? `${toPersianDigits(item.startTime)}${item.endTime ? ` تا ${toPersianDigits(item.endTime)}` : ''}`
          : item.type === 'event'
          ? 'تمام‌روز'
          : 'بدون ساعت';

        ctx.textAlign = 'right';
        ctx.fillStyle = typeColor;
        ctx.font = '700 15px Vazirmatn, sans-serif';
        const prefix = `${ITEM_TYPE_LABELS[item.type]} · ${timeStr}`;
        ctx.fillText(prefix, rightX - 40, rowY + itemRowH / 2);

        const prefixW = ctx.measureText(prefix).width;
        ctx.fillStyle = item.status === 'completed' ? '#64748B' : '#0F172A';
        ctx.font = '700 17px Vazirmatn, sans-serif';
        const titleMaxW = cardW - prefixW - 260;
        const titleText = truncateText(
          ctx,
          `${item.title}${item.status === 'completed' ? ' (تکمیل‌شده)' : ''}`,
          Math.max(240, titleMaxW)
        );
        ctx.fillText(titleText, rightX - 40 - prefixW - 18, rowY + itemRowH / 2);

        // Location or Assignee on left
        const metaRight = item.location || (item.assigneeName ? `مسئول: ${item.assigneeName}` : '');
        if (metaRight) {
          ctx.textAlign = 'left';
          ctx.fillStyle = '#64748B';
          ctx.font = '500 14px Vazirmatn, sans-serif';
          ctx.fillText(truncateText(ctx, metaRight, 210), paddingX + 18, rowY + itemRowH / 2);
        }
      });
    }

    cursorY += cardH + rowGap;
  });

  // Footer
  ctx.textAlign = 'right';
  ctx.fillStyle = '#64748B';
  ctx.font = '500 15px Vazirmatn, sans-serif';
  ctx.fillText('اپلیکیشن هماهنگی · مدیریت هوشمند جلسات، کارها و رویدادها', rightX, height - 30);

  ctx.textAlign = 'left';
  ctx.fillText('نسخه آزمایشی · سید حسین موسوی', paddingX, height - 30);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('خطا در تولید تصویر برنامه هفتگی'));
    }, 'image/png');
  });
}

export function buildWeeklyTextSummary(
  workspaceName: string,
  weekDays: JalaliCalendarCell[],
  items: WorkspaceItem[]
): string {
  const firstDay = weekDays[0];
  const lastDay = weekDays[6];
  const lines: string[] = [
    `برنامه هفتگی «${workspaceName}»`,
    `از ${PERSIAN_WEEKDAYS_FULL[firstDay.weekdayIdx]} ${formatJalaliShort(
      firstDay.jalaliDate
    )} تا ${PERSIAN_WEEKDAYS_FULL[lastDay.weekdayIdx]} ${formatJalaliShort(lastDay.jalaliDate)}`,
    '────────────────────',
  ];

  for (const day of weekDays) {
    const holiday = getIranHoliday(day.jalaliDate);
    const dayItems = items.filter(
      (i) => i.jalaliDate === day.jalaliDate && i.status !== 'cancelled'
    );
    const header = `${PERSIAN_WEEKDAYS_FULL[day.weekdayIdx]} ${formatJalaliShort(day.jalaliDate)}${
      holiday ? ` (${holiday.title})` : ''
    }`;
    lines.push(header);
    if (dayItems.length === 0) {
      lines.push('  • بدون برنامه');
    } else {
      for (const it of dayItems) {
        const time = it.startTime ? `${toPersianDigits(it.startTime)} - ` : '';
        lines.push(`  • [${ITEM_TYPE_LABELS[it.type]}] ${time}${it.title}`);
      }
    }
  }

  return lines.join('\n');
}
