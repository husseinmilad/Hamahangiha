import React, { useEffect, useState } from 'react';
import {
  CalendarOff,
  Check,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  MapPin,
  Save,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  ITEM_TYPE_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  WorkspaceItem,
} from '../types/hamahangi';
import { formatJalaliPretty, toPersianDigits } from '../lib/jalali';
import { getIranHoliday } from '../lib/iranHolidays';
import { useApp } from '../context/AppContext';
import { checkWorkspacePermission } from '../services/supabaseService';
import {
  deleteWorkspaceItem,
  respondToItemAttendance,
  toggleItemChecklist,
  updateItemMinutes,
  updateItemStatus,
} from '../services/supabaseService';

interface ItemDetailModalProps {
  item: WorkspaceItem;
  onClose: () => void;
  onEdit: (item: WorkspaceItem) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  onClose,
  onEdit,
}) => {
  const { activeWorkspace, members, user, removeItemLocally } = useApp();
  const [minutesDraft, setMinutesDraft] = useState(item.minutes || '');
  const [savingMinutes, setSavingMinutes] = useState(false);
  const [minutesSaved, setMinutesSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [canDeleteItems, setCanDeleteItems] = useState(false);

  useEffect(() => {
    if (!activeWorkspace || !user) { setCanDeleteItems(false); return; }
    let alive = true;
    checkWorkspacePermission(activeWorkspace.id, 'delete_items')
      .then(allowed => { if (alive) setCanDeleteItems(allowed); })
      .catch(() => { if (alive) setCanDeleteItems(false); });
    return () => { alive = false; };
  }, [activeWorkspace?.id, user?.uid]);

  if (!activeWorkspace || !user) return null;

  const isConfirmedByMe = (item.confirmedUids || []).includes(user.uid);
  const isDeclinedByMe = (item.declinedUids || []).includes(user.uid);
  const holiday = getIranHoliday(item.jalaliDate);


  const handleSaveMinutes = async () => {
    setSavingMinutes(true);
    try {
      await updateItemMinutes(activeWorkspace.id, item.id, minutesDraft);
      setMinutesSaved(true);
      setTimeout(() => setMinutesSaved(false), 2500);
    } finally {
      setSavingMinutes(false);
    }
  };

  const handleDelete = async () => {
    await deleteWorkspaceItem(activeWorkspace.id, item.id);
    removeItemLocally(item.id);
    onClose();
  };

  const confirmedMembers = members.filter((m) => (item.confirmedUids || []).includes(m.uid));
  const declinedMembers = members.filter((m) => (item.declinedUids || []).includes(m.uid));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-sheet overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-bold text-blue-600 dark:text-blue-400">
              {ITEM_TYPE_LABELS[item.type]}
            </span>
            <span aria-hidden="true">·</span>
            <span>{PRIORITY_LABELS[item.priority]}</span>
            <span aria-hidden="true">·</span>
            <span>{STATUS_LABELS[item.status]}</span>
          </div>

          <div className="flex items-center gap-1">
            {item.status !== 'cancelled' && (
              <button
                onClick={() => onEdit(item)}
                className="min-h-[40px] px-3 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
              >
                <Edit3 className="w-4 h-4" />
                ویرایش
              </button>
            )}
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="بستن"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="space-y-2">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-white leading-snug">
              {item.title}
            </h2>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
              <span className="font-medium tabular-nums">
                {formatJalaliPretty(item.jalaliDate)}
              </span>
              {item.startTime ? (
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Clock className="w-4 h-4 text-slate-400" />
                  {item.type === 'task'
                    ? `مهلت تا ساعت ${toPersianDigits(item.startTime)}`
                    : `${toPersianDigits(item.startTime)}${
                        item.endTime ? ` تا ${toPersianDigits(item.endTime)}` : ''
                      }`}
                </span>
              ) : (
                item.type === 'event' && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">تمام‌روز</span>
                )
              )}
              {item.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {item.location}
                </span>
              )}
            </div>

            {holiday && (
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400">
                <CalendarOff className="w-3.5 h-3.5" />
                <span>تعطیل رسمی ایران: {holiday.title}</span>
              </div>
            )}
          </div>

          {item.meetingLink && (
            <a
              href={item.meetingLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 px-4 py-2.5 text-xs font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60"
            >
              <ExternalLink className="w-4 h-4" />
              {item.type === 'event' ? 'مشاهده لینک اطلاعات یا ثبت‌نام رویداد' : 'ورود به لینک جلسه آنلاین'}
            </a>
          )}

          {/* Attendance & Status Actions */}
          <div className="flex flex-wrap items-center gap-2 py-3 border-y border-slate-200 dark:border-slate-800">
            <button
              onClick={() =>
                updateItemStatus(
                  activeWorkspace,
                  members,
                  user,
                  item,
                  item.status === 'completed' ? 'scheduled' : 'completed'
                )
              }
              className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 min-h-[40px] transition-colors ${
                item.status === 'completed'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-emerald-600 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {item.status === 'completed' ? 'تکمیل شده (بازگشت)' : 'علامت تکمیل‌شده'}
            </button>

            {item.type !== 'task' && (
              <>
                <button
                  onClick={() =>
                    respondToItemAttendance(activeWorkspace, members, user, item, 'accepted')
                  }
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 min-h-[40px] transition-colors ${
                    isConfirmedByMe
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-blue-600 hover:text-white'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  {isConfirmedByMe ? 'حضور شما تأیید شد' : 'تأیید حضور / رؤیت'}
                </button>

                <button
                  onClick={() =>
                    respondToItemAttendance(activeWorkspace, members, user, item, 'declined')
                  }
                  className={`px-3.5 py-2 rounded-xl text-xs font-medium min-h-[40px] transition-colors ${
                    isDeclinedByMe
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-red-50 hover:text-red-700'
                  }`}
                >
                  عدم امکان حضور
                </button>
              </>
            )}
          </div>

          {/* Agenda / Description */}
          {(item.agenda || item.description) && (
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {item.type === 'meeting'
                  ? 'دستور جلسه'
                  : item.type === 'task'
                  ? 'شرح کار'
                  : 'برنامه و جزئیات رویداد'}
              </h3>
              <p className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {item.agenda || item.description}
              </p>
            </div>
          )}

          {/* Checklist */}
          {item.checklist.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {item.type === 'task' ? 'مراحل انجام کار' : 'چک‌لیست پیگیری'}
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {item.checklist.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleItemChecklist(activeWorkspace.id, item, c.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 text-right hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors min-h-[44px]"
                  >
                    <span
                      className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                        c.done
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {c.done && <Check className="w-3.5 h-3.5" />}
                    </span>
                    <span
                      className={`text-sm ${
                        c.done
                          ? 'line-through text-slate-400 dark:text-slate-500'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {c.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Live Minutes — Meeting focused */}
          {item.type === 'meeting' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  صورت‌جلسه و یادداشت‌های نتیجه
                </h3>
                {minutesSaved && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    ذخیره شد
                  </span>
                )}
              </div>
              <textarea
                rows={3}
                value={minutesDraft}
                onChange={(e) => setMinutesDraft(e.target.value)}
                placeholder="مصوبات، تصمیمات و نکات مهم جلسه را اینجا یادداشت کنید..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={handleSaveMinutes}
                disabled={savingMinutes}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 text-xs font-semibold min-h-[38px]"
              >
                <Save className="w-3.5 h-3.5" />
                ذخیره صورت‌جلسه
              </button>
            </div>
          )}

          {/* Confirmations / Who saw it */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">
              اطلاعات ثبت و پاسخ اعضا
            </h3>
            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
              {item.type !== 'task' && (
                <p className="flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" />
                  <span>تأیید کرده‌اند:</span>
                  <span className="font-medium">
                    {confirmedMembers.length > 0
                      ? confirmedMembers.map((m) => m.displayName).join('، ')
                      : 'هنوز تأییدی ثبت نشده'}
                  </span>
                </p>
              )}
              {declinedMembers.length > 0 && (
                <p className="text-red-600 dark:text-red-400">
                  عدم حضور: {declinedMembers.map((m) => m.displayName).join('، ')}
                </p>
              )}
              {item.assigneeName && (
                <p className="text-slate-600 dark:text-slate-300">
                  مسئول: {item.assigneeName} ({item.assigneeEmail})
                </p>
              )}
              <p className="text-slate-500 dark:text-slate-400">
                ثبت‌کننده: {item.createdByName} ({item.createdByEmail})
              </p>
            </div>
          </div>

          {/* Delete */}
          {canDeleteItems && <div className="pt-2 flex items-center justify-between">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="inline-flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:underline py-2"
              >
                <Trash2 className="w-4 h-4" />
                حذف این مورد
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-semibold">مطمئن هستید؟</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold"
                >
                  بله، حذف شود
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs"
                >
                  انصراف
                </button>
              </div>
            )}
          </div>}
        </div>
      </div>
    </div>
  );
};
