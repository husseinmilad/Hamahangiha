import React, { useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  Loader2,
  Mail,
  Plus,
  Send,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  acceptWorkspaceInvite,
  createWorkspace,
  deleteWorkspace,
  updateWorkspace,
  declineWorkspaceInvite,
  getRoleDisplayLabel,
  inviteMemberByEmail,
  removeWorkspaceMember,
  updateMemberRole,
} from '../services/supabaseService';
import { SCHEMA_LIMITS } from '../types/hamahangi';
import { toPersianDigits } from '../lib/jalali';

export const TeamWorkspaceView: React.FC = () => {
  const {
    user,
    memberships,
    activeWorkspaceId,
    setActiveWorkspaceId,
    activeWorkspace,
    members,
    incomingInvites,
    outgoingInvites,
  } = useApp();

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'executive' | 'coordinator' | 'member'>('executive');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  const [showNewWsForm, setShowNewWsForm] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsDesc, setNewWsDesc] = useState('');
  const [creatingWs, setCreatingWs] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState(false);
  const [workspaceNameDraft, setWorkspaceNameDraft] = useState('');
  const [workspaceDescDraft, setWorkspaceDescDraft] = useState('');
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  if (!user) return null;

  const isOwnerOrAdmin = members.some(
    (m) =>
      m.uid === user.uid &&
      (m.role === 'owner' || m.role === 'executive' || m.role === 'coordinator')
  );
  const isOwner = activeWorkspace?.ownerUid === user.uid;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace) return;
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setInviteError('لطفاً یک آدرس ایمیل (ایمیل) معتبر وارد کنید.');
      return;
    }
    if (members.some((m) => m.email.toLowerCase() === cleanEmail)) {
      setInviteError('این همکار هم‌اکنون عضو این گروه کاری است.');
      return;
    }

    setInviting(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      await inviteMemberByEmail(activeWorkspace, user, cleanEmail, inviteRole);
      setInviteSuccess(
        `دعوت‌نامه برای «${cleanEmail}» ثبت شد. به محض ورود همکارتان با این ایمیل، گروه «${activeWorkspace.name}» و اعلان‌های آن فعال می‌شود.`
      );
      setInviteEmail('');
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'خطا در ارسال دعوت‌نامه');
    } finally {
      setInviting(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;
    setCreatingWs(true);
    try {
      const wsId = await createWorkspace(user, newWsName.trim(), newWsDesc.trim());
      setActiveWorkspaceId(wsId);
      setNewWsName('');
      setNewWsDesc('');
      setShowNewWsForm(false);
    } finally {
      setCreatingWs(false);
    }
  };

  const handleUpdateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !user || !workspaceNameDraft.trim()) return;
    setWorkspaceBusy(true); setWorkspaceError(null);
    try {
      await updateWorkspace(activeWorkspace.id, user.uid, workspaceNameDraft.trim(), workspaceDescDraft.trim());
      setEditingWorkspace(false);
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : 'ویرایش گروه انجام نشد.');
    } finally { setWorkspaceBusy(false); }
  };

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspace || !user) return;
    if (!window.confirm(`گروه «${activeWorkspace.name}» و تمام کارها، جلسات و اعضای آن حذف شود؟ این کار برگشت‌پذیر نیست.`)) return;
    setWorkspaceBusy(true); setWorkspaceError(null);
    try {
      await deleteWorkspace(activeWorkspace.id, user.uid);
      const next = memberships.find(m => m.workspaceId !== activeWorkspace.id);
      setActiveWorkspaceId(next?.workspaceId || '');
      setEditingWorkspace(false);
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : 'حذف گروه انجام نشد.');
    } finally { setWorkspaceBusy(false); }
  };

  const handleCopyInviteText = async (invId: string, wsName: string, email: string) => {
    const shareUrl = window.location.origin;
    const text = `سلام! شما به گروه کاری «${wsName}» در اپلیکیشن هماهنگی دعوت شدید.\nلطفاً با ایمیل (${email}) وارد لینک زیر شوید:\n${shareUrl}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedInviteId(invId);
      setTimeout(() => setCopiedInviteId(null), 2500);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const pendingOutgoingForWs = outgoingInvites.filter(
    (i) => i.workspaceId === activeWorkspace?.id && i.status === 'pending'
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            گروه کاری و اتصال با ایمیل
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            همکاران خود (رییس، مسئول دفتر یا اعضای تیم) را با ایمیل به یکدیگر متصل کنید
          </p>
        </div>

        <button
          onClick={() => setShowNewWsForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 min-h-[42px]"
        >
          <Plus className="w-4 h-4 text-blue-600" />
          ساخت گروه جدید
        </button>
      </div>

      {/* Incoming Pending Invites */}
      {incomingInvites.length > 0 && (
        <section className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600" />
            دعوت‌نامه‌های دریافتی برای {user.email}
          </h2>
          <div className="space-y-2.5">
            {incomingInvites.map((inv) => (
              <div
                key={inv.id}
                className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {inv.workspaceName}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    دعوت از {inv.invitedByName} ({inv.invitedByEmail}) · نقش:{' '}
                    {getRoleDisplayLabel(inv.role)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={async () => {
                      await acceptWorkspaceInvite(user, inv);
                      setActiveWorkspaceId(inv.workspaceId);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-xs font-bold min-h-[40px]"
                  >
                    <Check className="w-4 h-4" />
                    پذیرش و اتصال
                  </button>
                  <button
                    onClick={() => declineWorkspaceInvite(inv.id)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 min-h-[40px]"
                  >
                    <X className="w-4 h-4" />
                    رد
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Create New Workspace Collapsible */}
      {showNewWsForm && (
        <form
          onSubmit={handleCreateWorkspace}
          className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            ایجاد گروه کاری جدید
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              maxLength={SCHEMA_LIMITS.NAME_MAX}
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              placeholder="نام گروه (مثلاً: دفتر پروژه نیاوران)"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm min-h-[44px]"
            />
            <input
              type="text"
              maxLength={SCHEMA_LIMITS.WORKSPACE_DESC_MAX}
              value={newWsDesc}
              onChange={(e) => setNewWsDesc(e.target.value)}
              placeholder="توضیح کوتاه (اختیاری)"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm min-h-[44px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={creatingWs}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-xs font-bold min-h-[42px]"
            >
              {creatingWs && <Loader2 className="w-4 h-4 animate-spin" />}
              ایجاد گروه
            </button>
            <button
              type="button"
              onClick={() => setShowNewWsForm(false)}
              className="rounded-xl px-4 py-2.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[42px]"
            >
              انصراف
            </button>
          </div>
        </form>
      )}

      {/* Workspace Selector Strip */}
      {memberships.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {memberships.map((m) => (
            <button
              key={m.workspaceId}
              onClick={() => setActiveWorkspaceId(m.workspaceId)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors border min-h-[42px] ${
                m.workspaceId === activeWorkspaceId
                  ? 'bg-slate-900 dark:bg-blue-600 border-slate-900 dark:border-blue-600 text-white'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
              }`}
            >
              {m.workspaceName}
            </button>
          ))}
        </div>
      )}

      {activeWorkspace && isOwner && (
        <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">مدیریت گروه کاری</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">این بخش فقط برای مالک گروه قابل مشاهده است.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => {
                setWorkspaceNameDraft(activeWorkspace.name);
                setWorkspaceDescDraft(activeWorkspace.description || '');
                setWorkspaceError(null); setEditingWorkspace(v => !v);
              }} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold">
                <Edit3 className="w-3.5 h-3.5" /> ویرایش گروه
              </button>
              <button type="button" disabled={workspaceBusy} onClick={handleDeleteWorkspace}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 px-3 py-2 text-xs font-semibold disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" /> حذف گروه
              </button>
            </div>
          </div>
          {workspaceError && <p role="alert" className="text-xs text-red-600">{workspaceError}</p>}
          {editingWorkspace && (
            <form onSubmit={handleUpdateWorkspace} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input required maxLength={SCHEMA_LIMITS.NAME_MAX} value={workspaceNameDraft}
                onChange={e => setWorkspaceNameDraft(e.target.value)} placeholder="نام گروه"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm min-h-[42px]" />
              <input maxLength={SCHEMA_LIMITS.WORKSPACE_DESC_MAX} value={workspaceDescDraft}
                onChange={e => setWorkspaceDescDraft(e.target.value)} placeholder="توضیحات گروه"
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm min-h-[42px]" />
              <div className="sm:col-span-2 flex gap-2">
                <button disabled={workspaceBusy} type="submit" className="rounded-lg bg-blue-600 text-white px-4 py-2 text-xs font-bold disabled:opacity-50">{workspaceBusy ? 'در حال ذخیره...' : 'ذخیره تغییرات'}</button>
                <button type="button" onClick={() => setEditingWorkspace(false)} className="rounded-lg px-4 py-2 text-xs">انصراف</button>
              </div>
            </form>
          )}
        </section>
      )}

      {activeWorkspace && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Invite by Email Form */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  اتصال همکار جدید با ایمیل
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ایمیل رییس یا مسئول دفتر را وارد کنید
                </p>
              </div>
            </div>

            {inviteError && (
              <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300">
                {inviteError}
              </div>
            )}

            {inviteSuccess && (
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 py-2.5 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                {inviteSuccess}
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  آدرس ایمیل همکار *
                </label>
                <input
                  type="email"
                  dir="ltr"
                  required
                  maxLength={SCHEMA_LIMITS.EMAIL_MAX}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@email.com"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  نقش در گروه کاری
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) =>
                    setInviteRole(e.target.value as 'executive' | 'coordinator' | 'member')
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
                >
                  <option value="executive">رییس / مدیر ارشد</option>
                  <option value="coordinator">مسئول دفتر / هماهنگ‌کننده</option>
                  <option value="member">عضو تیم</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={inviting}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-3 px-4 text-xs font-bold transition-colors min-h-[46px]"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                ارسال دعوت‌نامه ایمیل
              </button>
            </form>
          </div>

          {/* Members & Outgoing Invites */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  اعضای گروه «{activeWorkspace.name}» ({toPersianDigits(members.length)})
                </h2>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {members.map((m) => (
                  <div
                    key={m.uid}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {m.photoURL ? (
                        <img
                          src={m.photoURL}
                          alt={m.displayName}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center text-sm font-bold shrink-0">
                          {m.displayName.slice(0, 1)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                          {m.displayName} {m.uid === user.uid ? '(شما)' : ''}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate" dir="ltr">
                          {m.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isOwnerOrAdmin && m.role !== 'owner' ? (
                        <select
                          value={m.role}
                          onChange={(e) =>
                            updateMemberRole(
                              activeWorkspace.id,
                              m.uid,
                              e.target.value as 'executive' | 'coordinator' | 'member'
                            )
                          }
                          className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 min-h-[36px]"
                        >
                          <option value="executive">رییس / مدیر ارشد</option>
                          <option value="coordinator">مسئول دفتر</option>
                          <option value="member">عضو تیم</option>
                        </select>
                      ) : (
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {getRoleDisplayLabel(m.role)}
                        </span>
                      )}

                      {isOwner && m.uid !== user.uid && (
                        <button
                          onClick={() => removeWorkspaceMember(activeWorkspace.id, m.uid)}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 min-h-[36px] min-w-[36px] flex items-center justify-center"
                          aria-label="حذف عضو"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {pendingOutgoingForWs.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  دعوت‌نامه‌های در انتظار ورود همکار
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pendingOutgoingForWs.map((inv) => (
                    <div
                      key={inv.id}
                      className="py-3 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate" dir="ltr">
                          {inv.invitedEmail}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          نقش: {getRoleDisplayLabel(inv.role)} · در انتظار ورود با ایمیل
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleCopyInviteText(inv.id, inv.workspaceName, inv.invitedEmail)
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[36px]"
                        >
                          {copiedInviteId === inv.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              کپی شد
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              کپی پیام دعوت
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => declineWorkspaceInvite(inv.id)}
                          className="text-xs text-red-600 hover:underline px-2 py-1"
                        >
                          لغو
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
