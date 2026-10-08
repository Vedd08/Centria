import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { Pagination } from '../common/Pagination';
import { StatusBadge } from '../common/StatusBadge';
import { AdmitPatientModal } from './AdmitPatientModal';
import { AdmissionDetail, Admission } from './AdmissionDetail';
import { CONDITION_LABEL, conditionVariant } from './conditionStatus';
import { QueueEntry } from '../Queue/types';
import { BedDouble, Search, UserPlus, Eye, Stethoscope, Clock } from 'lucide-react';

export const IPDBoard: React.FC = () => {
  const { apiFetch, hasRole } = useAuth();
  const { addToast } = useToast();
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ADMITTED' | 'DISCHARGED'>('ADMITTED');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 15;
  const [showAdmit, setShowAdmit] = useState(false);
  const [admitPrefill, setAdmitPrefill] = useState<{
    queueId: string;
    patient: QueueEntry['patient'];
    doctorId?: string;
    reason?: string;
  } | undefined>(undefined);
  const [selected, setSelected] = useState<Admission | null>(null);
  const [pending, setPending] = useState<QueueEntry[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  const canAdmit = hasRole('RECEPTION', 'DOCTOR', 'NURSE');

  const fetchAdmissions = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search.trim()) params.set('search', search.trim());
      const res = await apiFetch(`/api/admissions?${params}`, { signal });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to fetch admissions' }));
        throw new Error(err.message || 'Failed to fetch admissions');
      }
      const result = await res.json();
      if (signal?.aborted) return;
      if (result.data) {
        setAdmissions(result.data);
        setTotal(result.total);
      } else if (Array.isArray(result)) {
        setAdmissions(result);
        setTotal(result.length);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      addToast('error', err.message || 'Error fetching admissions');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  const fetchPending = async () => {
    if (!canAdmit) return;
    setPendingLoading(true);
    try {
      const res = await apiFetch('/api/queue/pending-admissions');
      if (!res.ok) throw new Error('Failed to load pending admissions');
      const result = await res.json();
      setPending(Array.isArray(result) ? result : result.data || []);
    } catch (err: any) {
      addToast('error', err.message || 'Error fetching pending admissions');
    } finally {
      setPendingLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => fetchAdmissions(controller.signal), search.trim() ? 300 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, page]);

  useEffect(() => {
    fetchPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-fetch the selected admission so its detail view reflects the latest state
  // (e.g. right after a discharge).
  const refreshSelected = async () => {
    if (!selected) return;
    try {
      const res = await apiFetch(`/api/admissions/${selected.id}`);
      if (res.ok) setSelected(await res.json());
    } catch {
      // Non-fatal — the board below is refreshed regardless.
    }
    fetchAdmissions();
  };

  if (selected) {
    return (
      <AdmissionDetail
        admission={selected}
        onBack={() => {
          setSelected(null);
          fetchAdmissions();
        }}
        onDischarged={refreshSelected}
        onChanged={refreshSelected}
      />
    );
  }

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary tracking-tight">IPD — Inpatient Ward</h2>
          <p className="text-xs text-ink-secondary mt-0.5 hidden sm:block">
            Admitted patients, their drug charts, and recovery progress.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-ink-secondary/60 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, UHID, doctor..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-border text-xs focus:outline-none focus:ring-1 focus:ring-brand bg-surface-card"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'ADMITTED' | 'DISCHARGED')}
            className="px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
          >
            <option value="ADMITTED">Currently Admitted</option>
            <option value="DISCHARGED">Discharged</option>
          </select>

          {canAdmit && (
            <button
              onClick={() => {
                setAdmitPrefill(undefined);
                setShowAdmit(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Admit Patient</span>
            </button>
          )}
        </div>
      </div>

      {canAdmit && !pendingLoading && pending.length > 0 && (
        <div className="bg-status-warning/10 border border-status-warning/20 rounded-[10px] shadow-xs overflow-hidden">
          <div className="px-4 py-3 border-b border-status-warning/20">
            <h3 className="text-sm font-semibold text-ink-primary flex items-center gap-2">
              <Clock className="w-4 h-4 text-status-warning" />
              Pending Admissions ({pending.length})
            </h3>
            <p className="text-[11px] text-ink-secondary mt-0.5">
              Recommended by a doctor — pick a ward and bed to complete each admission.
            </p>
          </div>
          <div className="divide-y divide-status-warning/20">
            {pending.map((p) => (
              <div key={p.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-semibold text-brand-deep bg-brand-soft border border-brand/20 px-2 py-0.5 rounded">
                      {p.patient.uhid}
                    </span>
                    <span className="text-sm font-medium text-ink-primary">{p.patient.name}</span>
                  </div>
                  <p className="text-[11px] text-ink-secondary mt-1 flex items-center gap-1.5">
                    <Stethoscope className="w-3 h-3" />
                    {p.doctor ? `Dr. ${p.doctor.name}` : 'Doctor'} recommended admission
                    {p.admissionRequestedAt && ` · ${new Date(p.admissionRequestedAt).toLocaleString()}`}
                  </p>
                  {p.admissionRequestReason && (
                    <p className="text-xs text-ink-primary mt-1.5 max-w-xl">{p.admissionRequestReason}</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setAdmitPrefill({
                      queueId: p.id,
                      patient: p.patient,
                      doctorId: p.doctor?.id,
                      reason: p.admissionRequestReason,
                    });
                    setShowAdmit(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <BedDouble className="w-3.5 h-3.5" />
                  <span>Admit</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : admissions.length === 0 ? (
        <div className="bg-surface-card rounded-[10px] border border-border p-12 text-center space-y-2">
          <p className="text-sm font-semibold text-ink-primary">
            {statusFilter === 'ADMITTED' ? 'No patients currently admitted' : 'No discharged admissions'}
          </p>
          <p className="text-xs text-ink-secondary">
            {statusFilter === 'ADMITTED'
              ? canAdmit
                ? 'Click "Admit Patient" to admit someone into an available bed.'
                : 'Admitted patients will appear here.'
              : 'Discharged patients will appear here once they leave the ward.'}
          </p>
        </div>
      ) : (
        <div className="bg-surface-card rounded-[10px] border border-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-page border-b border-border text-ink-secondary font-medium text-xs">
                  <th className="py-3 px-4">UHID</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Ward / Bed</th>
                  <th className="py-3 px-4">Attending Doctor</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Admitted</th>
                  <th className="py-3 px-4">Condition</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-ink-primary">
                {admissions.map((adm) => (
                  <tr key={adm.id} className="hover:bg-surface-page/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-brand-deep">
                      <span className="bg-brand-soft border border-brand/20 px-2 py-0.5 rounded text-xs">
                        {adm.patient.uhid}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-ink-primary">{adm.patient.name}</td>
                    <td className="py-3 px-4 text-ink-secondary">
                      <span className="inline-flex items-center gap-1.5">
                        <BedDouble className="w-3.5 h-3.5 text-ink-secondary/60" />
                        {adm.bed?.ward?.name} / {adm.bed?.bedNumber}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-ink-secondary">{adm.doctor?.name || '—'}</td>
                    <td className="py-3 px-4 text-ink-secondary max-w-[220px] truncate" title={adm.reasonForAdmission}>
                      {adm.reasonForAdmission}
                    </td>
                    <td className="py-3 px-4 text-ink-secondary font-mono">
                      {new Date(adm.admissionDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      {adm.status === 'ADMITTED' ? (
                        <StatusBadge
                          label={CONDITION_LABEL[adm.currentStatus] || adm.currentStatus}
                          variant={conditionVariant(adm.currentStatus)}
                        />
                      ) : (
                        <span className="text-ink-secondary/60">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge label={adm.status} variant={adm.status === 'ADMITTED' ? 'warning' : 'neutral'} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelected(adm)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-ink-secondary" />
                        <span>Open Chart</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && admissions.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
      )}

      <AdmitPatientModal
        isOpen={showAdmit}
        onClose={() => {
          setShowAdmit(false);
          setAdmitPrefill(undefined);
        }}
        onAdmitted={() => {
          fetchAdmissions();
          fetchPending();
          setAdmitPrefill(undefined);
        }}
        prefill={admitPrefill}
      />
    </div>
  );
};
