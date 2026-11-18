import React, { useState } from 'react';
import {
  BellRing,
  CheckSquare,
  Globe,
  Loader2,
  MapPin,
  Plus,
  Sparkles,
  Trash2,
  Video,
  X,
} from 'lucide-react';
import {
  ChecklistItem,
  ITEM_TYPE_LABELS,
  ItemPriority,
  ItemStatus,
  ItemType,
  PRIORITY_LABELS,
  SCHEMA_LIMITS,
  STATUS_LABELS,
  WorkspaceItem,
} from '../types/hamahangi';
import { getTodayJalaliStr, toPersianDigits } from '../lib/jalali';
import { JalaliDatePicker } from './JalaliDatePicker';
import { useApp } from '../context/AppContext';
import { generateSafeId, saveWorkspaceItem } from '../services/firestoreService';

interface ItemFormModalProps {
  initialDate?: string;
  initialType?: ItemType;
  editingItem?: WorkspaceItem | null;
  onClose: () => void;
}

type MeetingFormat = 'in_person' | 'online' | 'hybrid';

export const ItemFormModal: React.FC<ItemFormModalProps> = ({
  initialDate,
  initialType = 'meeting',
  editingItem,
  onClose,
}) => {
  const { activeWorkspace, members, user } = useApp();

  const [type, setType] = useState<ItemType>(editingItem?.type ?? initialType);
  const [title, setTitle] = useState(editingItem?.title ?? '');
  const [description, setDescription] = useState(editingItem?.description ?? '');
  const [jalaliDate, setJalaliDate] = useState(
    editingItem?.jalaliDate ?? initialDate ?? getTodayJalaliStr()
  );
  const [startTime, setStartTime] = useState(editingItem?.startTime ?? '10:00');
  const [endTime, setEndTime] = useState(editingItem?.endTime ?? '11:00');
  const [location, setLocation] = useState(editingItem?.location ?? '');
  const [meetingLink, setMeetingLink] = useState(editingItem?.meetingLink ?? '');
  const [priority, setPriority] = useState<ItemPriority>(editingItem?.priority ?? 'normal');
  const [status, setStatus] = useState<ItemStatus>(editingItem?.status ?? 'scheduled');
  const [assigneeUid, setAssigneeUid] = useState(editingItem?.assigneeUid ?? '');
  const [agenda, setAgenda] = useState(editingItem?.agenda ?? '');
  const [minutes, setMinutes] = useState(editingItem?.minutes ?? '');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(editingItem?.checklist ?? []);
  const [newCheckText, setNewCheckText] = useState('');
  const [notifyMembers, setNotifyMembers] = useState(editingItem?.notifyMembers ?? true);
  const [reminderMinutes, setReminderMinutes] = useState(editingItem?.reminderMinutes ?? 15);

  // Tailored UI state per form type
  const [meetingFormat, setMeetingFormat] = useState<MeetingFormat>(() => {
    if (editingItem?.location && editingItem?.meetingLink) return 'hybrid';
    if (editingItem?.meetingLink && !editingItem?.location) return 'online';
    return 'in_person';
  });
  const [taskHasDeadlineTime, setTaskHasDeadlineTime] = useState<boolean>(
    editingItem ? Boolean(editingItem.startTime) : true
  );
  const [eventIsAllDay, setEventIsAllDay] = useState<boolean>(
    editingItem ? !editingItem.startTime : false
  );

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAddChecklist = () => {
    const clean = newCheckText.trim().slice(0, SCHEMA_LIMITS.CHECKLIST_TEXT_MAX);
    if (!clean || checklist.length >= SCHEMA_LIMITS.CHECKLIST_MAX) return;
    setChecklist((prev) => [...prev, { id: generateSafeId('chk'), text: clean, done: false }]);
    setNewCheckText('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !user) return;
    if (!title.trim()) {
      setErrorMsg('لطفاً عنوان را وارد کنید.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    const chosenMember = members.find((m) => m.uid === assigneeUid);

    let finalStartTime = startTime;
    let finalEndTime = endTime;
    let finalLocation = location;
    let finalMeetingLink = meetingLink;
    const finalDescription = type === 'meeting' ? '' : description;
    let finalAgenda = agenda;
    let finalMinutes = minutes;

    if (type === 'meeting') {
      if (meetingFormat === 'in_person') {
        finalMeetingLink = '';
      } else if (meetingFormat === 'online') {
        finalLocation = finalLocation || 'جلسه آنلاین';
      }
    } else if (type === 'task') {
      finalStartTime = taskHasDeadlineTime ? startTime : '';
      finalEndTime = '';
      finalAgenda = '';
      finalMinutes = '';
      finalMeetingLink = '';
    } else if (type === 'event') {
      finalStartTime = eventIsAllDay ? '' : startTime;
      finalEndTime = eventIsAllDay ? '' : endTime;
      finalAgenda = '';
      finalMinutes = '';
    }

    try {
      await saveWorkspaceItem(
        activeWorkspace,
        members,
        user,
        {
          type,
          title: title.trim(),
          description: finalDescription,
          jalaliDate,
          startTime: finalStartTime,
          endTime: finalEndTime,
          location: finalLocation,
          meetingLink: finalMeetingLink,
          priority,
          status,
          assigneeEmail: chosenMember?.email ?? '',
          assigneeName: chosenMember?.displayName ?? '',
          assigneeUid: chosenMember?.uid ?? '',
          agenda: finalAgenda,
          minutes: finalMinutes,
          checklist,
          notifyMembers,
          reminderMinutes,
        },
        editingItem
      );
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ذخیره‌سازی');
    } finally {
      setSaving(false);
    }
  };

  const modalHeading = editingItem
    ? `ویرایش ${ITEM_TYPE_LABELS[type]}`
    : type === 'meeting'
    ? 'ثبت جلسه جدید'
    : type === 'task'
    ? 'تعریف کار و پیگیری جدید'
    : 'ثبت رویداد جدید';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 animate-sheet overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle on mobile */}
        <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
          <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
            {modalHeading}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="بستن"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Segmented Type Control */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            {[
              { key: 'meeting' as ItemType, label: 'جلسه', Icon: Video },
              { key: 'task' as ItemType, label: 'کار و پیگیری', Icon: CheckSquare },
              { key: 'event' as ItemType, label: 'رویداد', Icon: Sparkles },
            ].map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                className={`py-2.5 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-colors min-h-[42px] whitespace-nowrap inline-flex items-center justify-center gap-1.5 ${
                  type === key
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-2.5 text-xs text-red-700 dark:text-red-300">
              {errorMsg}
            </div>
          )}

          {/* ==================== TAILORED FORM 1: MEETING ==================== */}
          {type === 'meeting' && (
            <>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  موضوع / عنوان جلسه *
                </label>
                <input
                  type="text"
                  required
                  maxLength={SCHEMA_LIMITS.TITLE_MAX}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثلاً: جلسه بررسی بودجه فصل پاییز با مدیرعامل"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                />
              </div>

              <JalaliDatePicker
                value={jalaliDate}
                onChange={setJalaliDate}
                label="تاریخ برگزاری جلسه"
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    ساعت شروع جلسه
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    ساعت پایان جلسه
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                  />
                </div>
              </div>

              {/* Meeting Format Selector */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  نحوه برگزاری جلسه
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'in_person' as MeetingFormat, label: 'حضوری', Icon: MapPin },
                    { key: 'online' as MeetingFormat, label: 'آنلاین', Icon: Globe },
                    { key: 'hybrid' as MeetingFormat, label: 'حضوری و آنلاین', Icon: Video },
                  ].map(({ key, label, Icon }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setMeetingFormat(key)}
                      className={`px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors min-h-[42px] ${
                        meetingFormat === key
                          ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(meetingFormat === 'in_person' || meetingFormat === 'hybrid') && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      مکان / اتاق جلسه
                    </label>
                    <input
                      type="text"
                      maxLength={SCHEMA_LIMITS.LOCATION_MAX}
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="مثلاً: اتاق جلسات طبقه ۴"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                    />
                  </div>
                )}

                {(meetingFormat === 'online' || meetingFormat === 'hybrid') && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      لینک جلسه آنلاین (Meet / Skyroom)
                    </label>
                    <input
                      type="url"
                      dir="ltr"
                      maxLength={SCHEMA_LIMITS.LINK_MAX}
                      value={meetingLink}
                      onChange={(e) => setMeetingLink(e.target.value)}
                      placeholder="https://meet.google.com/..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    مخاطب اصلی / دبیر جلسه
                  </label>
                  <select
                    value={assigneeUid}
                    onChange={(e) => setAssigneeUid(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                  >
                    <option value="">همه اعضای گروه</option>
                    {members.map((m) => (
                      <option key={m.uid} value={m.uid}>
                        {m.displayName} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    اهمیت جلسه
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ItemPriority)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                  >
                    {(['urgent', 'high', 'normal', 'low'] as ItemPriority[]).map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  دستور جلسه (Agenda)
                </label>
                <textarea
                  rows={3}
                  maxLength={SCHEMA_LIMITS.AGENDA_MAX}
                  value={agenda}
                  onChange={(e) => setAgenda(e.target.value)}
                  placeholder="محورهای گفتگو، افراد حاضر و پیش‌نیازهای جلسه..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  مصوبات یا یادداشت‌های اولیه (صورت‌جلسه)
                </label>
                <textarea
                  rows={2}
                  maxLength={SCHEMA_LIMITS.MINUTES_MAX}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  placeholder="در صورت نیاز، نکات یا تصمیمات اولیه را وارد کنید..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </>
          )}

          {/* ==================== TAILORED FORM 2: TASK ==================== */}
          {type === 'task' && (
            <>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  عنوان کار یا پیگیری *
                </label>
                <input
                  type="text"
                  required
                  maxLength={SCHEMA_LIMITS.TITLE_MAX}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثلاً: ارسال قرارداد نهایی برای امضای مدیرعامل"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    مسئول انجام کار (واگذاری با جیمیل)
                  </label>
                  <select
                    value={assigneeUid}
                    onChange={(e) => setAssigneeUid(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                  >
                    <option value="">همه اعضای گروه</option>
                    {members.map((m) => (
                      <option key={m.uid} value={m.uid}>
                        {m.displayName} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    اولویت انجام
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ItemPriority)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                  >
                    {(['urgent', 'high', 'normal', 'low'] as ItemPriority[]).map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <JalaliDatePicker
                value={jalaliDate}
                onChange={setJalaliDate}
                label="مهلت (سررسید) انجام کار"
              />

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5 space-y-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    تعیین ساعت مشخص برای سررسید
                  </span>
                  <input
                    type="checkbox"
                    checked={taskHasDeadlineTime}
                    onChange={(e) => setTaskHasDeadlineTime(e.target.checked)}
                    className="w-5 h-5 accent-blue-600 rounded"
                  />
                </label>
                {taskHasDeadlineTime && (
                  <div className="space-y-1">
                    <label className="block text-[11px] text-slate-500 dark:text-slate-400">
                      حداکثر تا ساعت
                    </label>
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full sm:w-48 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 tabular-nums min-h-[42px]"
                    />
                  </div>
                )}
              </div>

              {/* Checklist Builder — Prominent in Task Form */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  مراحل و ریزاقدام‌های کار (چک‌لیست · {toPersianDigits(checklist.length)}/۲۰)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    maxLength={SCHEMA_LIMITS.CHECKLIST_TEXT_MAX}
                    value={newCheckText}
                    onChange={(e) => setNewCheckText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddChecklist();
                      }
                    }}
                    placeholder="مثلاً: دریافت امضای مالی، اسکن و ارسال..."
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                  />
                  <button
                    type="button"
                    onClick={handleAddChecklist}
                    className="px-4 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold hover:bg-slate-800 min-h-[44px] flex items-center gap-1 whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    افزودن
                  </button>
                </div>
                {checklist.length > 0 && (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    {checklist.map((c) => (
                      <li
                        key={c.id}
                        className="px-3.5 py-2.5 flex items-center justify-between gap-2 bg-slate-50/70 dark:bg-slate-800/40 text-sm"
                      >
                        <span className="text-slate-800 dark:text-slate-200 truncate">{c.text}</span>
                        <button
                          type="button"
                          onClick={() => setChecklist((prev) => prev.filter((x) => x.id !== c.id))}
                          className="text-slate-400 hover:text-red-600 p-1"
                          aria-label="حذف مورد"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  شرح کار و نکات اجرایی
                </label>
                <textarea
                  rows={3}
                  maxLength={SCHEMA_LIMITS.DESC_MAX}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="جزئیات یا مدارک مورد نیاز برای انجام این کار..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </>
          )}

          {/* ==================== TAILORED FORM 3: EVENT ==================== */}
          {type === 'event' && (
            <>
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  نام رویداد یا مناسبت *
                </label>
                <input
                  type="text"
                  required
                  maxLength={SCHEMA_LIMITS.TITLE_MAX}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثلاً: همایش سالانه مدیران / بازدید از نمایشگاه"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                />
              </div>

              <JalaliDatePicker
                value={jalaliDate}
                onChange={setJalaliDate}
                label="تاریخ رویداد"
              />

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5 space-y-3">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      رویداد تمام‌روز
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      برای مناسبت‌ها یا برنامه‌های یک‌روزه بدون ساعت شروع و پایان
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={eventIsAllDay}
                    onChange={(e) => setEventIsAllDay(e.target.checked)}
                    className="w-5 h-5 accent-blue-600 rounded"
                  />
                </label>

                {!eventIsAllDay && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700/70">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        از ساعت
                      </label>
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm tabular-nums min-h-[42px]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                        تا ساعت
                      </label>
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm tabular-nums min-h-[42px]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    محل برگزاری رویداد
                  </label>
                  <input
                    type="text"
                    maxLength={SCHEMA_LIMITS.LOCATION_MAX}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="مثلاً: مرکز همایش‌های بین‌المللی"
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    لینک اطلاعات یا ثبت‌نام رویداد
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    maxLength={SCHEMA_LIMITS.LINK_MAX}
                    value={meetingLink}
                    onChange={(e) => setMeetingLink(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    هماهنگ‌کننده رویداد
                  </label>
                  <select
                    value={assigneeUid}
                    onChange={(e) => setAssigneeUid(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                  >
                    <option value="">همه اعضای گروه</option>
                    {members.map((m) => (
                      <option key={m.uid} value={m.uid}>
                        {m.displayName} ({m.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    اهمیت رویداد
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ItemPriority)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                  >
                    {(['urgent', 'high', 'normal', 'low'] as ItemPriority[]).map((p) => (
                      <option key={p} value={p}>
                        {PRIORITY_LABELS[p]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  برنامه و جزئیات رویداد
                </label>
                <textarea
                  rows={3}
                  maxLength={SCHEMA_LIMITS.DESC_MAX}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="توضیحات، کد پوشش، مهمانان ویژه یا نکات تدارکاتی رویداد..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </>
          )}

          {editingItem && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                وضعیت فعلی
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ItemStatus)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
              >
                {(['scheduled', 'in_progress', 'completed', 'cancelled'] as ItemStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Notification & Reminder */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-3.5 space-y-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div className="flex items-center gap-2.5">
                <BellRing className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    ارسال اعلان فوری به گوشی هم‌گروهی‌ها
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    بلافاصله پس از ذخیره، اعلان برای سایر اعضای گروه ارسال می‌شود
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={notifyMembers}
                onChange={(e) => setNotifyMembers(e.target.checked)}
                className="w-5 h-5 accent-blue-600 rounded"
              />
            </label>

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-700/70">
              <span className="text-xs text-slate-700 dark:text-slate-300">
                {type === 'task' ? 'یادآوری پیش از سررسید:' : 'یادآوری خودکار پیش از شروع:'}
              </span>
              <select
                value={reminderMinutes}
                onChange={(e) => setReminderMinutes(Number(e.target.value))}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value={0}>بدون یادآور</option>
                <option value={10}>۱۰ دقیقه قبل</option>
                <option value={15}>۱۵ دقیقه قبل</option>
                <option value={30}>۳۰ دقیقه قبل</option>
                <option value={60}>۱ ساعت قبل</option>
                {type === 'event' && <option value={1440}>۱ روز قبل</option>}
              </select>
            </div>
          </div>

          {/* Footer CTA */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 px-5 text-sm font-bold transition-colors min-h-[48px]"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{editingItem ? 'ذخیره تغییرات' : `ثبت ${ITEM_TYPE_LABELS[type]} و ارسال اعلان`}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-700 px-5 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[48px]"
            >
              انصراف
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
