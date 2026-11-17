import React from 'react';
import { BellRing, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const LiveToast: React.FC<{ onOpenItem?: (itemId: string) => void }> = ({
  onOpenItem,
}) => {
  const { liveToast, dismissLiveToast, setActiveTab } = useApp();

  if (!liveToast) return null;

  return (
    <div className="fixed top-3 left-3 right-3 sm:left-auto sm:right-6 sm:w-96 z-50 animate-toast">
      <div className="rounded-2xl bg-slate-900 dark:bg-slate-800 text-white border border-slate-700 p-3.5 shadow-xl flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
          <BellRing className="w-4 h-4" />
        </div>
        <button
          onClick={() => {
            if (liveToast.itemId && onOpenItem) {
              onOpenItem(liveToast.itemId);
            } else {
              setActiveTab('notifications');
            }
            dismissLiveToast();
          }}
          className="flex-1 text-right min-w-0"
        >
          <p className="text-xs font-bold text-white truncate">{liveToast.title}</p>
          <p className="text-xs text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
            {liveToast.body}
          </p>
        </button>
        <button
          onClick={dismissLiveToast}
          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 shrink-0"
          aria-label="بستن اعلان"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
