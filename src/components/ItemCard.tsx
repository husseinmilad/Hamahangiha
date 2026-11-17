import React from 'react';
import {
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  MapPin,
  Sparkles,
  UserCheck,
  Video,
} from 'lucide-react';
import {
  ITEM_TYPE_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  WorkspaceItem,
} from '../types/hamahangi';
import { formatJalaliShort, toPersianDigits } from '../lib/jalali';

interface ItemCardProps {
  item: WorkspaceItem;
  currentUid: string;
  onOpen: (item: WorkspaceItem) => void;
  onToggleComplete: (item: WorkspaceItem) => void;
  onConfirmAttendance: (item: WorkspaceItem, status: 'accepted' | 'declined') => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  currentUid,
  onOpen,
  onToggleComplete,
  onConfirmAttendance,
}) => {
  const isCompleted = item.status === 'completed';
  const isCancelled = item.status === 'cancelled';
  const isConfirmedByMe = (item.confirmedUids || []).includes(currentUid);
  const isDeclinedByMe = (item.declinedUids || []).includes(currentUid);

  const checklistDone = item.checklist.filter((c) => c.done).length;
  const checklistTotal = item.checklist.length;

  const TypeIcon =
    item.type === 'meeting' ? Video : item.type === 'task' ? CheckSquare : Sparkles;

  const statusColorClass =
    item.status === 'completed'
      ? 'text-emerald-700 dark:text-emerald-400'
      : item.status === 'cancelled'
      ? 'text-slate-400 dark:text-slate-500'
      : item.priority === 'urgent'
      ? 'text-red-600 dark:text-red-400'
      : item.priority === 'high'
      ? 'text-amber-700 dark:text-amber-400'
      : 'text-blue-700 dark:text-blue-400';

  return (
    <div
      className={`group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 transition-colors hover:border-slate-300 dark:hover:border-slate-700 ${
        isCancelled ? 'opacity-65' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Complete / Status Toggle Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (!isCancelled) onToggleComplete(item);
          }}
          disabled={isCancelled}
          aria-label={isCompleted ? 'بازگرداندن به حالت فعال' : 'علامت زدن به عنوان تکمیل‌شده'}
          className={`mt-0.5 min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center transition-colors shrink-0 ${
            isCompleted
              ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-950/50 dark:hover:text-blue-400'
          }`}
        >
          {isCompleted ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <TypeIcon className="w-5 h-5" />
          )}
        </button>

        {/* Main Content Clickable */}
        <div
          onClick={() => onOpen(item)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onOpen(item);
            }
          }}
          className="flex-1 min-w-0 cursor-pointer text-right space-y-1.5"
        >
          {/* Quiet Unboxed Metadata Line (Zero-Pill Rule) */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 dark:text-slate-400">
            <span className={`font-semibold ${statusColorClass}`}>
              {ITEM_TYPE_LABELS[item.type]}
            </span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{formatJalaliShort(item.jalaliDate)}</span>
            {item.startTime && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="w-3.5 h-3.5" />
                  {toPersianDigits(item.startTime)}
                  {item.endTime ? ` تا ${toPersianDigits(item.endTime)}` : ''}
                </span>
              </>
            )}
            {item.priority !== 'normal' && (
              <>
                <span aria-hidden="true">·</span>
                <span className={statusColorClass}>{PRIORITY_LABELS[item.priority]}</span>
              </>
            )}
          </div>

          {/* Primary Title */}
          <h3
            className={`text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 leading-snug ${
              isCompleted || isCancelled ? 'line-through text-slate-500 dark:text-slate-500' : ''
            }`}
          >
            {item.title}
          </h3>

          {/* Secondary Details Line */}
          {(item.location || item.assigneeName || checklistTotal > 0 || item.description) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 dark:text-slate-400 pt-0.5">
              {item.location && (
                <span className="inline-flex items-center gap-1 truncate max-w-[220px]">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{item.location}</span>
                </span>
              )}
              {item.assigneeName && (
                <span className="inline-flex items-center gap-1">
                  <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>مسئول: {item.assigneeName}</span>
                </span>
              )}
              {checklistTotal > 0 && (
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span>
                    چک‌لیست: {toPersianDigits(checklistDone)}/{toPersianDigits(checklistTotal)}
                  </span>
                </span>
              )}
              {!item.location && !item.assigneeName && checklistTotal === 0 && item.description && (
                <span className="truncate max-w-full">{item.description}</span>
              )}
            </div>
          )}

          {/* Footer Meta + Quick Attendance Confirm for Meetings/Events */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>ثبت: {item.createdByName}</span>
              <span aria-hidden="true">·</span>
              <span>{STATUS_LABELS[item.status]}</span>
              {(item.confirmedUids?.length ?? 0) > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {toPersianDigits(item.confirmedUids.length)} تأیید
                  </span>
                </>
              )}
            </div>

            {!isCompleted && !isCancelled && item.type !== 'task' && (
              <div
                className="flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => onConfirmAttendance(item, 'accepted')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[34px] whitespace-nowrap ${
                    isConfirmedByMe
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700'
                  }`}
                >
                  {isConfirmedByMe ? 'تأیید شده' : 'تأیید حضور'}
                </button>
                {!isConfirmedByMe && (
                  <button
                    onClick={() => onConfirmAttendance(item, 'declined')}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[34px] whitespace-nowrap ${
                      isDeclinedByMe
                        ? 'bg-red-600 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-950/50 hover:text-red-700'
                    }`}
                  >
                    {isDeclinedByMe ? 'عدم حضور' : 'لغو حضور'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
