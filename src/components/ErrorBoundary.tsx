import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'خطای غیرمنتظره رخ داده است.',
    };
  }

  override render() {
    if (this.state.hasError) {
      let friendlyMsg = 'مشکلی در ارتباط با سرور یا پردازش اطلاعات پیش آمد.';
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.error) {
          friendlyMsg = `دسترسی یا عملیات دیتابیس با خطا مواجه شد: ${parsed.error}`;
        }
      } catch {
        friendlyMsg = this.state.message;
      }

      return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              بروز خطا در برنامه هماهنگی
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed break-words">
              {friendlyMsg}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 text-sm font-medium transition-colors min-h-[44px]"
            >
              <RotateCcw className="w-4 h-4" />
              بارگذاری مجدد برنامه
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
