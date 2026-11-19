import React, { useEffect, useState } from 'react';
import { BellRing, CalendarDays, CheckCircle2, Loader2, Mail, MessageCircle, ShieldCheck, Users, LockKeyhole } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';
import welcomeDeskImage from '../assets/images/hamahangi_welcome_desk_1794938541772.jpg';

type Mode = 'signin' | 'signup' | 'reset' | 'update';
export const LoginScreen: React.FC = () => {
  const { signInWithEmail, signUpWithEmail, resetPassword, updatePassword, passwordRecovery, authLoading, authError } = useApp();
  const [mode, setMode] = useState<Mode>(() => passwordRecovery || (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) ? 'update' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [imgError, setImgError] = useState(false);

  useEffect(() => { if (passwordRecovery) setMode('update'); }, [passwordRecovery]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setMessage('');
    if (mode !== 'update' && !email.trim()) { setError('ایمیل را وارد کنید.'); return; }
    if (mode !== 'reset' && password.length < 6) { setError('رمز عبور باید حداقل ۶ نویسه باشد.'); return; }
    try {
      if (mode === 'signin') await signInWithEmail(email, password);
      else if (mode === 'update') { await updatePassword(password); setMessage('رمز عبور با موفقیت تغییر کرد.'); }
      else if (mode === 'signup') {
        await signUpWithEmail(email, password, displayName);
        setMessage('درخواست ثبت‌نام ارسال شد. اگر تأیید ایمیل فعال است، صندوق ورودی و پوشه هرزنامه را بررسی کنید.');
      } else {
        await resetPassword(email);
        setMessage('در صورت وجود حساب، لینک بازیابی رمز برای ایمیل شما ارسال می‌شود. ارسال ایمیل نیازمند تنظیم SMTP در Supabase است.');
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'عملیات انجام نشد. دوباره تلاش کنید.'); }
  };
  const title = mode === 'signin' ? 'ورود به هماهنگی' : mode === 'signup' ? 'ساخت حساب کاربری' : mode === 'update' ? 'تعیین رمز عبور جدید' : 'بازیابی رمز عبور';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between">
      <header className="w-full max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="نشان هماهنگی" className="w-9 h-9 rounded-xl shrink-0" />
          <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">هماهنگی</span>
        </div>
        <PWAInstallButton variant="compact" />
      </header>
      <main className="w-full max-w-6xl mx-auto px-5 py-6 lg:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white leading-tight">هماهنگی لحظه‌ای میان مدیر و همکاران</h1>
            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              گروه کاری بسازید، همکاران را با نشانی ایمیل دعوت کنید و جلسات، کارها و رویدادها را در تقویم شمسی ثبت نمایید.
            </p>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
            <div className="py-3.5 flex items-start gap-3"><Mail className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" /><div><h2 className="text-sm font-bold">حساب کاربری با ایمیل و رمز عبور</h2></div></div>
            <div className="py-3.5 flex items-start gap-3"><BellRing className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" /><div><h2 className="text-sm font-bold">قابلیت اعلان‌های لحظه‌ای و یادآوری</h2></div></div>
            <div className="py-3.5 flex items-start gap-3"><CalendarDays className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" /><div><h2 className="text-sm font-bold">تقویم شمسی و مدیریت گروه</h2><p className="text-xs text-slate-500 mt-0.5">ثبت جلسات، کارها و پیگیری‌ها در یک فضای مشترک.</p></div></div>
          </div>
          <form onSubmit={submit} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3 shadow-sm">
            <div className="flex items-center justify-between gap-3"><h2 className="font-extrabold text-lg">{title}</h2><LockKeyhole className="w-5 h-5 text-blue-600" /></div>
            {(mode === 'signup') && <label className="block space-y-1"><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">نام نمایشی</span><input value={displayName} onChange={e=>setDisplayName(e.target.value)} autoComplete="name" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-3 text-sm" placeholder="نام و نام خانوادگی" /></label>}
            <label className="block space-y-1"><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">آدرس ایمیل</span><input type="email" required={mode !== "update"} value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" dir="ltr" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-3 text-sm text-left" placeholder="name@example.com" /></label>
            {mode !== 'reset' && <label className="block space-y-1"><span className="text-xs font-semibold text-slate-600 dark:text-slate-300">رمز عبور</span><input type="password" required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} dir="ltr" className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-3 text-sm text-left" placeholder="حداقل ۶ نویسه" /></label>}
            {(error || authError) && <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3 text-xs text-red-700 dark:text-red-300">{error || authError}</p>}
            {message && <p role="status" className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 p-3 text-xs text-emerald-700 dark:text-emerald-300">{message}</p>}
            <button type="submit" disabled={authLoading} className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-5 py-3 text-sm font-bold">
              {authLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'signin' ? 'ورود' : mode === 'signup' ? 'ثبت‌نام' : mode === 'update' ? 'ذخیره رمز جدید' : 'ارسال لینک بازیابی'}
            </button>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              {mode === 'signin' && <button type="button" onClick={()=>{setMode('reset');setError('');setMessage('');}} className="text-blue-600 hover:underline">رمز عبور را فراموش کرده‌ام</button>}
              {mode !== 'signin' && <button type="button" onClick={()=>{setMode('signin');setError('');setMessage('');}} className="text-blue-600 hover:underline">بازگشت به ورود</button>}
              {mode !== 'signup' && mode !== 'update' && <button type="button" onClick={()=>{setMode('signup');setError('');setMessage('');}} className="text-blue-600 hover:underline">ایجاد حساب جدید</button>}
              {mode === 'signup' && <button type="button" onClick={()=>{setMode('signin');setError('');setMessage('');}} className="text-blue-600 hover:underline">قبلاً حساب ساخته‌ام</button>}
            </div>
          </form>
          <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" /><span>اطلاعات با کنترل دسترسی و سیاست‌های امنیتی پایگاه داده محافظت می‌شود.</span></div>
          <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div><h2 className="text-xs font-bold">ارتباط با سازنده و گزارش بازخورد</h2><p className="text-xs text-slate-500 mt-1">نسخه آزمایشی · ساخته‌شده توسط سید حسین موسوی</p></div>
            <a href="https://ble.ir/gomnam74" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 px-4 py-2.5 text-xs font-bold"><MessageCircle className="w-4 h-4" />ارتباط در بله</a>
          </section>
        </div>
        <div className="lg:col-span-6 flex">
          <div className="relative w-full rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 min-h-[280px] lg:min-h-[500px] flex items-end">
            {!imgError ? <img src={welcomeDeskImage} alt="میز برنامه‌ریزی و تقویم شمسی هماهنگی" onError={()=>setImgError(true)} className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950 flex items-center justify-center"><Users className="w-20 h-20 text-blue-300/40" /></div>}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />
            <div className="relative z-10 p-6 sm:p-8 text-white space-y-2 w-full"><div className="flex items-center gap-2 text-xs text-blue-200 font-medium"><CheckCircle2 className="w-4 h-4" /><span>نمونه کاربرد واقعی</span><span>·</span><span>رییس و مسئول دفتر</span></div><p className="text-base sm:text-lg font-bold leading-snug">«جلسات، کارها و پیگیری‌ها را در یک تقویم مشترک مدیریت کنید.»</p></div>
          </div>
        </div>
      </main>
      <footer className="w-full max-w-6xl mx-auto px-5 py-4 text-xs text-slate-500 border-t border-slate-200/70 dark:border-slate-800/70 flex justify-between gap-2"><span>هماهنگی (نسخه آزمایشی) · ساخته‌شده توسط سید حسین موسوی</span><span>نسخه آزمایشی Supabase</span></footer>
    </div>
  );
};
