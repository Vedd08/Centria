import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { X, CalendarOff, Trash2 } from 'lucide-react';
import { fmtDate, todayStr } from './packagePlan';

interface Holiday { id: string; date: string; name: string }

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

/** Days the clinic is closed. Package sittings that land on one move to the next open day. */
export const HolidaysModal: React.FC<{ isOpen: boolean; onClose: () => void; onChanged?: () => void }> = ({ isOpen, onClose, onChanged }) => {
  const { apiFetch, hasRole } = useAuth();
  const { addToast } = useToast();
  const canManage = hasRole('DOCTOR', 'MASTER', 'SUPER_ADMIN');
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [date, setDate] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPast, setShowPast] = useState(false);

  const load = async () => {
    try {
      const res = await apiFetch('/api/packages/holidays');
      const d = await res.json();
      if (res.ok) setHolidays(Array.isArray(d) ? d : []);
    } catch {
      addToast('error', 'Could not load holidays');
    }
  };

  useEffect(() => {
    if (isOpen) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const add = async () => {
    if (!date || !name.trim()) return;
    setBusy(true);
    try {
      const res = await apiFetch('/api/packages/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, name: name.trim() }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(Array.isArray(d.message) ? d.message.join(', ') : d.message || 'Could not add the holiday');
      addToast('success', `${fmtDate(date)} added as a holiday`);
      setDate('');
      setName('');
      await load();
      onChanged?.();
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (h: Holiday) => {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/packages/holidays/${h.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not remove the holiday');
      await load();
      onChanged?.();
    } catch (err: any) {
      addToast('error', err.message);
    } finally {
      setBusy(false);
    }
  };

  const today = todayStr();
  const visible = holidays.filter((h) => showPast || h.date >= today);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-brand-deep px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CalendarOff className="w-5 h-5 text-brand-soft" />
            <div>
              <h2 className="text-sm font-bold">Clinic holidays</h2>
              <p className="text-[11px] text-white/80">Package sittings that land on these days move to the next open day</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {canManage && (
            <div className="space-y-2">
              <div className="grid grid-cols-[140px_1fr] gap-2">
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
                  placeholder="e.g. Diwali"
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={add}
                  disabled={busy || !date || !name.trim()}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-brand hover:bg-brand-deep rounded-md cursor-pointer disabled:opacity-50"
                >
                  Add holiday
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">
              {showPast ? 'All holidays' : 'Upcoming'} ({visible.length})
            </span>
            <button onClick={() => setShowPast((v) => !v)} className="text-[11px] text-brand hover:underline cursor-pointer">
              {showPast ? 'Hide past' : 'Show past'}
            </button>
          </div>
          {visible.length === 0 ? (
            <p className="text-xs text-ink-secondary py-3 text-center">No holidays added. Sundays are skipped automatically for packages set to do so.</p>
          ) : (
            <ul className="border border-border rounded-lg divide-y divide-border/60 max-h-72 overflow-y-auto">
              {visible.map((h) => (
                <li key={h.id} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span>
                    <span className="font-semibold text-ink-primary">{fmtDate(h.date, true)}</span>
                    <span className="text-ink-secondary"> · {h.name}</span>
                  </span>
                  {canManage && (
                    <button onClick={() => remove(h)} disabled={busy} className="p-1 text-ink-secondary hover:text-status-danger cursor-pointer disabled:opacity-50" title="Remove">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
