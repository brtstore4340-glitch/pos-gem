import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { X, Calendar, Printer, Search, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '../utils/cn';
import { posService } from '../services/posService';

function formatDate(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export default function DailyReportModal({ isOpen, onClose, storeId }) {
  const [selectedDate, setSelectedDate] = useState(() => formatDate(new Date()));
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [expanded, setExpanded] = useState(false);

  // ✅ ย้าย loadData มาไว้ก่อน useEffect เพื่อไม่ให้เกิด ReferenceError/TDZ ระหว่าง render
  const loadData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const start = new Date(`${selectedDate}T${startTime}:00`);
      const end = new Date(`${selectedDate}T${endTime}:59`);

      const rows = await posService.getDailyReport({
        storeId,
        start,
        end,
      });

      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      console.error(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, startTime, endTime, storeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return items;

    return items.filter((r) => {
      const blob = JSON.stringify(r ?? {}).toLowerCase();
      return blob.includes(q);
    });
  }, [items, keyword]);

  const total = useMemo(() => {
    return filtered.reduce((sum, r) => sum + Number(r?.total ?? 0), 0);
  }, [filtered]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-5xl rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Daily Report</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-black/5"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="grid gap-1 text-sm">
              <span className="text-black/70">Date</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="rounded-xl border px-3 py-2"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-black/70">Start</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="rounded-xl border px-3 py-2"
              />
            </label>

            <label className="grid gap-1 text-sm">
              <span className="text-black/70">End</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="rounded-xl border px-3 py-2"
              />
            </label>

            <div className="flex items-end gap-2">
              <button
                type="button"
                onClick={loadData}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border px-3 py-2 hover:bg-black/5"
              >
                <Search className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-1 items-center gap-2">
              <Search className="h-4 w-4 text-black/60" />
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Search..."
                className="w-full rounded-xl border px-3 py-2"
              />
              <button
                type="button"
                onClick={() => setKeyword('')}
                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-black/5"
              >
                <Trash2 className="h-4 w-4" />
                Clear
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 hover:bg-black/5"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>

          <div className="mt-4 rounded-xl border p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm text-black/70">
                Rows: <span className="font-semibold text-black">{filtered.length}</span>
              </div>
              <div className="text-sm text-black/70">
                Total: <span className="font-semibold text-black">{total.toFixed(2)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-black/5"
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expanded ? 'Hide details' : 'Show details'}
            </button>

            {expanded && (
              <pre className={cn('mt-3 max-h-80 overflow-auto rounded-xl bg-black/5 p-3 text-xs')}>
                {JSON.stringify(filtered, null, 2)}
              </pre>
            )}

            {loading && <div className="mt-3 text-sm text-black/60">Loading...</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
