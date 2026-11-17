import React, { useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ItemStatus, ItemType, WorkspaceItem } from '../types/hamahangi';
import { ItemCard } from './ItemCard';
import { respondToItemAttendance, updateItemStatus } from '../services/firestoreService';
import { toPersianDigits } from '../lib/jalali';

interface ItemsListViewProps {
  onCreateNew: (defaultDate?: string, defaultType?: ItemType) => void;
  onOpenItem: (item: WorkspaceItem) => void;
}

export const ItemsListView: React.FC<ItemsListViewProps> = ({
  onCreateNew,
  onOpenItem,
}) => {
  const { user, activeWorkspace, members, items, itemsLoading } = useApp();
  const [typeFilter, setTypeFilter] = useState<'all' | ItemType>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'completed' | 'cancelled' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (statusFilter === 'active' && (item.status === 'completed' || item.status === 'cancelled')) {
        return false;
      }
      if (statusFilter === 'completed' && item.status !== 'completed') return false;
      if (statusFilter === 'cancelled' && item.status !== 'cancelled') return false;

      if (q) {
        const hay = `${item.title} ${item.description} ${item.agenda} ${item.location} ${item.assigneeName} ${item.jalaliDate}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, typeFilter, statusFilter, searchQuery]);

  if (!user || !activeWorkspace) return null;

  const typeTabs: { key: 'all' | ItemType; label: string }[] = [
    { key: 'all', label: 'همه' },
    { key: 'meeting', label: 'جلسات' },
    { key: 'task', label: 'کارها' },
    { key: 'event', label: 'رویدادها' },
  ];

  const statusTabs: { key: 'active' | 'completed' | 'cancelled' | 'all'; label: string }[] = [
    { key: 'active', label: 'در جریان' },
    { key: 'completed', label: 'تکمیل‌شده' },
    { key: 'cancelled', label: 'لغوشده' },
    { key: 'all', label: 'همه' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
            مدیریت جلسات، کارها و رویدادها
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
            نمایش {toPersianDigits(filteredItems.length)} مورد در گروه «{activeWorkspace.name}»
          </p>
        </div>
        <button
          onClick={() => onCreateNew(undefined, typeFilter === 'all' ? 'meeting' : typeFilter)}
          className="hidden sm:inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-xs font-bold min-h-[42px]"
        >
          <Plus className="w-4 h-4" />
          مورد جدید
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو در عنوان، تاریخ شمسی، مکان یا نام همکار..."
            className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 pr-10 pl-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600 min-h-[44px]"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Type Segmented Control */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
            {typeTabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTypeFilter(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[36px] whitespace-nowrap ${
                  typeFilter === t.key
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Status Segmented Control */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
            {statusTabs.map((s) => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px] whitespace-nowrap ${
                  statusFilter === s.key
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      {itemsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-28 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 animate-pulse"
            />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center space-y-3">
          <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
            موردی با این فیلتر پیدا نشد
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            عبارت جستجو را تغییر دهید یا یک جلسه یا کار جدید ثبت نمایید.
          </p>
          <button
            onClick={() => onCreateNew(undefined, typeFilter === 'all' ? 'meeting' : typeFilter)}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-xs font-bold min-h-[42px]"
          >
            <Plus className="w-4 h-4" />
            ثبت مورد جدید
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          {filteredItems.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              currentUid={user.uid}
              onOpen={onOpenItem}
              onToggleComplete={(it) => {
                const nextStatus: ItemStatus =
                  it.status === 'completed' ? 'scheduled' : 'completed';
                updateItemStatus(activeWorkspace, members, user, it, nextStatus);
              }}
              onConfirmAttendance={(it, st) =>
                respondToItemAttendance(activeWorkspace, members, user, it, st)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
