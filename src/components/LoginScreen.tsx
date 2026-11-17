import React, { useState } from 'react';
import { BellRing, CalendarDays, CheckCircle2, Loader2, Mail, ShieldCheck, Users } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { PWAInstallButton } from './PWAInstallButton';

export const LoginScreen: React.FC = () => {
  const { signInWithGoogle, authLoading, authError } = useApp();
  const [imgError, setImgError] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between">
      {/* Minimal Top Bar */}
      <header className="w-full max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <img
            src="/icon.svg"
            alt="نشان هماهنگی"
            className="w-9 h-9 rounded-xl shrink-0"
            referrerPolicy="no-referrer"
          />
          <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            هماهنگی
          </span>
        </div>
        <PWAInstallButton variant="compact" />
      </header>

      {/* Main Split Content */}
      <main className="w-full max-w-6xl mx-auto px-5 py-6 lg:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
        {/* Right Column (RTL first): Value Prop + Google Sign In */}
        <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
              مدیریت اجرایی جلسات، کارها و رویدادهای شمسی
            </p>
            <h1
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white leading-tight"
              style={{ textWrap: 'balance' }}
            >
              هماهنگی لحظه‌ای میان مدیر و همکاران، مستقیم با جیمیل
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              گروه کاری بسازید، همکار یا مسئول دفتر خود را با جیمیل متصل کنید و جلسات و کارها را روی تقویم کامل شمسی ثبت نمایید تا اعلان فوری روی گوشی همگروهی‌ها نمایش داده شود.
            </p>
          </div>

          {/* 3 Concrete Capabilities without card clutter */}
          <div className="divide-y divide-slate-200 dark:divide-slate-800 border-y border-slate-200 dark:border-slate-800">
            <div className="py-3.5 flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  ورود با جیمیل و اتصال مستقیم همکاران
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  تنها با وارد کردن آدرس جیمیل همکار (مثلاً رییس یا مسئول دفتر)، تقویم و کارهای مشترک یکپارچه می‌شوند.
                </p>
              </div>
            </div>

            <div className="py-3.5 flex items-start gap-3">
              <BellRing className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  اعلان فوری و تأیید حضور روی گوشی
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  با ثبت هر جلسه یا پیگیری، اعلان آنی برای اعضای گروه ارسال شده و تأیید رؤیت و حضور به اطلاع شما می‌رسد.
                </p>
              </div>
            </div>

            <div className="py-3.5 flex items-start gap-3">
              <CalendarDays className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  تقویم کامل شمسی و نصب روی اندروید
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  طراحی‌شده با فونت وزیر، تاریخ دقیق هجری شمسی و قابلیت نصب به‌صورت اپلیکیشن مستقل اندروید.
                </p>
              </div>
            </div>
          </div>

          {authError && (
            <div className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-xs text-red-700 dark:text-red-300">
              {authError}
            </div>
          )}

          <div className="space-y-3 pt-1">
            <button
              onClick={signInWithGoogle}
              disabled={authLoading}
              className="w-full sm:w-auto min-w-[280px] inline-flex items-center justify-center gap-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60 text-white px-6 py-3.5 text-sm font-bold transition-all min-h-[48px] shadow-sm"
            >
              {authLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
                  />
                </svg>
              )}
              <span>ورود با حساب گوگل (Gmail)</span>
            </button>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>اطلاعات شما در فضای اختصاصی گروه کاری خودتان رمزنگاری و محافظت می‌شود.</span>
            </div>
          </div>
        </div>

        {/* Left Column: High-Craft Editorial Visual */}
        <div className="lg:col-span-6 flex">
          <div className="relative w-full rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 min-h-[280px] lg:min-h-[480px] flex items-end">
            {!imgError ? (
              <img
                src="/src/assets/images/hamahangi_welcome_desk_1794938541772.jpg"
                alt="میز برنامه‌ریزی و تقویم شمسی هماهنگی"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950 flex items-center justify-center">
                <Users className="w-20 h-20 text-blue-300/40" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-transparent" />
            <div className="relative z-10 p-6 sm:p-8 text-white space-y-2 w-full">
              <div className="flex items-center gap-2 text-xs text-blue-200 font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>نمونه کاربرد واقعی</span>
                <span aria-hidden="true">·</span>
                <span>رییس و مسئول دفتر</span>
              </div>
              <p className="text-base sm:text-lg font-bold leading-snug">
                «مسئول دفتر جلسه هیئت‌مدیره را ثبت می‌کند؛ همان لحظه اعلان روی گوشی رییس می‌نشیند و با یک لمس تأیید می‌شود.»
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full max-w-6xl mx-auto px-5 py-4 text-xs text-slate-500 dark:text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span>اپلیکیشن مدیریت جلسات، کارها و رویدادها — هماهنگی</span>
        <span>پشتیبانی کامل از تقویم هجری شمسی و نصب اندروید</span>
      </footer>
    </div>
  );
};
