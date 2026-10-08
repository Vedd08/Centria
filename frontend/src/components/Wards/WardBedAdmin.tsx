import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { StatusBadge } from '../common/StatusBadge';
import { Building, Plus, BedDouble, X, Wrench, Check } from 'lucide-react';

interface Bed {
  id: string;
  bedNumber: string;
  status: string;
  isActive: boolean;
}

interface Ward {
  id: string;
  name: string;
  floor?: string;
  isActive: boolean;
  beds: Bed[];
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

const bedStatusVariant = (status: string) =>
  status === 'AVAILABLE' ? 'success' : status === 'OCCUPIED' ? 'warning' : 'neutral';

export const WardBedAdmin: React.FC = () => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [wards, setWards] = useState<Ward[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddWard, setShowAddWard] = useState(false);
  const [wardName, setWardName] = useState('');
  const [wardFloor, setWardFloor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [addBedForWard, setAddBedForWard] = useState<string | null>(null);
  const [bedNumber, setBedNumber] = useState('');
  const [busyBedId, setBusyBedId] = useState<string | null>(null);

  const fetchWards = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/wards', { signal });
      if (!res.ok) throw new Error('Failed to load wards');
      const result = await res.json();
      if (signal?.aborted) return;
      setWards(Array.isArray(result) ? result : result.data || []);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      addToast('error', err.message || 'Failed to load wards');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchWards(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddWard = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/wards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: wardName.trim(), floor: wardFloor.trim() || undefined }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to create ward' }));
        throw new Error(err.message || 'Failed to create ward');
      }
      addToast('success', `Ward "${wardName.trim()}" created`);
      setWardName('');
      setWardFloor('');
      setShowAddWard(false);
      fetchWards();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to create ward');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddBed = async (e: React.FormEvent, wardId: string) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/wards/${wardId}/beds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bedNumber: bedNumber.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to add bed' }));
        throw new Error(err.message || 'Failed to add bed');
      }
      addToast('success', `Bed ${bedNumber.trim()} added`);
      setBedNumber('');
      setAddBedForWard(null);
      fetchWards();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to add bed');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBedStatus = async (bed: Bed) => {
    const nextStatus = bed.status === 'MAINTENANCE' ? 'AVAILABLE' : 'MAINTENANCE';
    setBusyBedId(bed.id);
    try {
      const res = await apiFetch(`/api/beds/${bed.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to update bed' }));
        throw new Error(err.message || 'Failed to update bed');
      }
      addToast('success', `Bed ${bed.bedNumber} marked ${nextStatus.toLowerCase()}`);
      fetchWards();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to update bed');
    } finally {
      setBusyBedId(null);
    }
  };

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary tracking-tight">Wards & Beds</h2>
          <p className="text-xs text-ink-secondary mt-0.5 hidden sm:block">
            Set up inpatient wards and their beds. Beds marked available here can be assigned when admitting a patient.
          </p>
        </div>
        <button
          onClick={() => setShowAddWard((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Add Ward</span>
        </button>
      </div>

      {showAddWard && (
        <form onSubmit={handleAddWard} className="bg-surface-card p-4 rounded-[10px] border border-border shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-primary">New ward</span>
            <button
              type="button"
              onClick={() => setShowAddWard(false)}
              className="p-1 rounded text-ink-secondary hover:text-ink-primary cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Ward Name <span className="text-status-danger">*</span>
              </label>
              <input
                type="text"
                required
                value={wardName}
                onChange={(e) => setWardName(e.target.value)}
                placeholder="e.g. General Ward"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Floor</label>
              <input
                type="text"
                value={wardFloor}
                onChange={(e) => setWardFloor(e.target.value)}
                placeholder="e.g. 2nd Floor"
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Ward'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : wards.length === 0 ? (
        <div className="bg-surface-card rounded-[10px] border border-border p-12 text-center space-y-2">
          <p className="text-sm font-semibold text-ink-primary">No wards set up yet</p>
          <p className="text-xs text-ink-secondary">
            Click "Add Ward" to create your first inpatient ward, then add beds to it.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {wards.map((ward) => {
            const available = ward.beds.filter((b) => b.status === 'AVAILABLE').length;
            const occupied = ward.beds.filter((b) => b.status === 'OCCUPIED').length;
            return (
              <div key={ward.id} className="bg-surface-card rounded-[10px] border border-border shadow-xs overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-border bg-surface-page/50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-brand-soft border border-brand/20 flex items-center justify-center">
                      <Building className="w-4 h-4 text-brand-deep" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-ink-primary">{ward.name}</h3>
                      <p className="text-[11px] text-ink-secondary">
                        {ward.floor || 'No floor set'} &bull; {ward.beds.length} bed(s) &bull; {available} available,{' '}
                        {occupied} occupied
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setAddBedForWard(addBedForWard === ward.id ? null : ward.id);
                      setBedNumber('');
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-primary bg-surface-card hover:bg-surface-page border border-border rounded-md cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Bed</span>
                  </button>
                </div>

                {addBedForWard === ward.id && (
                  <form onSubmit={(e) => handleAddBed(e, ward.id)} className="p-4 border-b border-border bg-surface-page/30 flex items-end gap-3">
                    <div className="flex-1 max-w-xs">
                      <label className="block text-xs font-semibold text-ink-secondary mb-1">
                        Bed Number <span className="text-status-danger">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={bedNumber}
                        onChange={(e) => setBedNumber(e.target.value)}
                        placeholder="e.g. GW-105"
                        className={inputClass}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {submitting ? 'Adding...' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddBedForWard(null)}
                      className="px-3.5 py-2 text-xs font-medium text-ink-primary bg-surface-card hover:bg-surface-page border border-border rounded-md cursor-pointer"
                    >
                      Cancel
                    </button>
                  </form>
                )}

                {ward.beds.length === 0 ? (
                  <p className="p-6 text-center text-xs text-ink-secondary">No beds in this ward yet.</p>
                ) : (
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {ward.beds.map((bed) => (
                      <div key={bed.id} className="bg-surface-page p-3 rounded-lg border border-border space-y-2">
                        <div className="flex items-center gap-2">
                          <BedDouble className="w-4 h-4 text-ink-secondary/70" />
                          <span className="text-xs font-semibold text-ink-primary font-mono">{bed.bedNumber}</span>
                        </div>
                        <StatusBadge label={bed.status} variant={bedStatusVariant(bed.status)} />
                        <button
                          onClick={() => toggleBedStatus(bed)}
                          disabled={bed.status === 'OCCUPIED' || busyBedId === bed.id}
                          title={
                            bed.status === 'OCCUPIED'
                              ? 'Discharge the patient before changing this bed'
                              : bed.status === 'MAINTENANCE'
                                ? 'Mark this bed available'
                                : 'Mark this bed out of service'
                          }
                          className="w-full inline-flex items-center justify-center gap-1.5 px-2 py-1 text-[11px] font-medium text-ink-primary bg-surface-card hover:bg-surface-page border border-border rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {bed.status === 'MAINTENANCE' ? (
                            <>
                              <Check className="w-3 h-3" /> Mark Available
                            </>
                          ) : (
                            <>
                              <Wrench className="w-3 h-3" /> Maintenance
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
