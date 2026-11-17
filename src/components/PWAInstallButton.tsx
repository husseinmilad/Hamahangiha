import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ variant?: 'compact' | 'full' }> = ({
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={
          variant === 'full'
            ? 'w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 text-sm font-semibold transition-colors min-h-[44px] whitespace-nowrap shrink-0'
            : 'flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 text-xs font-semibold transition-colors min-h-[40px] whitespace-nowrap shrink-0'
        }
      >
        <Download className="w-4 h-4" />
        <span>نصب اپ اندروید</span>
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowGuide(true)}
        className={
          variant === 'full'
            ? 'w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 px-4 py-3 text-sm font-medium transition-colors min-h-[44px] whitespace-nowrap shrink-0'
            : 'flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-2 text-xs font-medium transition-colors min-h-[40px] whitespace-nowrap shrink-0'
        }
      >
        <Smartphone className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        <span>نصب روی گوشی</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4"
          onClick={() => setShowGuide(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 animate-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                نصب اپلیکیشن هماهنگی روی گوشی
              </h3>
              <button
                onClick={() => setShowGuide(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="بستن"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed list-decimal list-inside">
                <li>در مرورگر Safari دکمه اشتراک‌گذاری (Share) را لمس کنید.</li>
                <li>گزینه «Add to Home Screen» را انتخاب نمایید.</li>
                <li>اپلیکیشن همانند یک برنامه مستقل به صفحه اصلی اضافه می‌شود.</li>
              </ol>
            ) : (
              <ol className="space-y-2.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed list-decimal list-inside">
                <li>این صفحه را با مرورگر Chrome در گوشی اندروید خود باز کنید.</li>
                <li>از منوی سه‌نقطه بالای مرورگر گزینه «Install app» یا «Add to Home screen» را بزنید.</li>
                <li>اپلیکیشن هماهنگی با آیکون اختصاصی، حالت تمام‌صفحه و دریافت اعلان روی گوشی شما نصب می‌شود.</li>
              </ol>
            )}

            <button
              onClick={() => setShowGuide(false)}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white py-3 text-sm font-semibold transition-colors min-h-[44px]"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}
    </>
  );
};
