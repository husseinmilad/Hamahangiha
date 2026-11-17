import React, { useState } from 'react';
import { Briefcase, Check, Loader2, Mail, Plus, UserPlus, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  acceptWorkspaceInvite,
  createWorkspace,
  declineWorkspaceInvite,
  getRoleDisplayLabel,
} from '../services/firestoreService';

export const WorkspaceSetupBanner: React.FC = () => {
  const { user, incomingInvites, setActiveWorkspaceId, setActiveTab } = useApp();
  const [name, setName] = useState('دفتر مدیریت و هماهنگی');
  const [description, setDescription] = useState('هماهنگی جلسات، کارها و رویدادهای روزانه');
  const [creating, setCreating] = useState(false);
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!user) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setErrorMsg(null);
    try {
      const wsId = await createWorkspace(user, name.trim(), description.trim());
      setActiveWorkspaceId(wsId);
      setActiveTab('team');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ساخت گروه کاری');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 py-4">
      {/* Pending Invitations First */}
      {incomingInvites.length > 0 && (
        <section className="rounded-2xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              دعوت‌نامه اتصال به گروه کاری برای جیمیل شما
            </h2>
          </div>
          <div className="space-y-3">
            {incomingInvites.map((inv) => (
              <div
                key={inv.id}
                className="rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    {inv.workspaceName}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    دعوت از طرف {inv.invitedByName} ({inv.invitedByEmail}) · نقش شما:{' '}
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {getRoleDisplayLabel(inv.role)}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={processingInviteId === inv.id}
                    onClick={async () => {
                      setProcessingInviteId(inv.id);
                      try {
                        await acceptWorkspaceInvite(user, inv);
                        setActiveWorkspaceId(inv.workspaceId);
                      } finally {
                        setProcessingInviteId(null);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-xs font-bold min-h-[42px]"
                  >
                    {processingInviteId === inv.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    عضویت در گروه
                  </button>
                  <button
                    disabled={processingInviteId === inv.id}
                    onClick={() => declineWorkspaceInvite(inv.id)}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 min-h-[42px]"
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

      {/* Create First Workspace */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 space-y-5">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">
              ساخت اولین گروه کاری مشترک
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
              یک گروه کاری بسازید (مثلاً «دفتر رییس و مسئول دفتر») و سپس همکار خود را با آدرس جیمیل دعوت کنید تا جلسات و کارها به‌صورت لحظه‌ای بین گوشی‌های شما همگام شود.
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              نام گروه کاری *
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              توضیحات کوتاه
            </label>
            <input
              type="text"
              maxLength={300}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-6 py-3 text-sm font-bold transition-colors min-h-[48px]"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>ساخت گروه و ادامه به دعوت همکار</span>
          </button>
        </form>

        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <UserPlus className="w-4 h-4 text-slate-400 shrink-0" />
          <span>اگر همکارتان قبلاً گروهی ساخته، کافی است شما را با جیمیل «{user.email}» دعوت کند تا همین‌جا نمایش داده شود.</span>
        </div>
      </section>
    </div>
  );
};
