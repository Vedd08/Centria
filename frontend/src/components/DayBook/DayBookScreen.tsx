import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { Pagination } from '../common/Pagination';
import { StatusBadge } from '../common/StatusBadge';
import { PatientHistoryPanel, HistoryPatient } from '../PatientHistory/PatientHistoryPanel';
import { exportToCsv } from '../../utils/exportToCsv';
import { Search, Eye, CalendarDays, Download } from 'lucide-react';
import { moneyOrDash } from '../../utils/money';

interface Visit {
  id: string;
  date: string;
  visitType: string;
  treatmentName: string;
  diagnosis?: string;
  remarks?: string;
  otherRemarks?: string;
  status: string;
  isGstTaxable: boolean;
  cashAmount: number;
  bankAmount: number;
  paymentRefId?: string;
  nextAppointmentDate?: string;
  clientRm?: string;
  operator?: string;
  patient: HistoryPatient;
  doctor?: { id: string; name: string };
}

interface DoctorOption {
  id: string;
  name: string;
}

const todayStr = () => new Date().toISOString().split('T')[0];

const statusVariant = (s: string) =>
  s === 'New' ? 'success' : s === 'Dressing' ? 'warning' : 'accent';

const money = moneyOrDash;

interface DayBookScreenProps {
  visitType: 'OPD' | 'IPD';
  /** OPD scopes a doctor to their own visits; IPD is shared across the clinic. */
  scopeToOwnDoctor?: boolean;
  title: string;
  subtitle: string;
}

/**
 * The clinic's daily register. OPD and IPD keep identical columns in the source
 * spreadsheet, so one screen serves both and is parameterised by visitType.
 */
export const DayBookScreen: React.FC<DayBookScreenProps> = ({
  visitType,
  scopeToOwnDoctor = false,
  title,
  subtitle,
}) => {
  const { apiFetch, user, hasRole } = useAuth();
  const { addToast } = useToast();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [todayOnly, setTodayOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 15;
  const [selectedPatient, setSelectedPatient] = useState<HistoryPatient | null>(null);

  const isDoctorScoped = scopeToOwnDoctor && user?.role === 'DOCTOR';
  const isAdmin = hasRole('MASTER', 'SUPER_ADMIN') && user?.role !== 'DOCTOR';
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [doctorFilter, setDoctorFilter] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const res = await apiFetch('/api/users?role=DOCTOR,MASTER');
        const result = await res.json();
        setDoctors(Array.isArray(result) ? result : result.data || []);
      } catch {
        // Non-fatal: the picker stays empty and the list shows every doctor.
      }
    })();
  }, [isAdmin, apiFetch]);

  const fetchVisits = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ visitType, page: String(page), pageSize: String(pageSize) });
      const effectiveDoctorId = isDoctorScoped ? user?.id : isAdmin ? doctorFilter : '';
      if (effectiveDoctorId) params.set('doctorId', effectiveDoctorId);
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('status', statusFilter);
      if (todayOnly) {
        params.set('from', todayStr());
        params.set('to', todayStr());
      }

      const res = await apiFetch(`/api/visits?${params}`, { signal });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to fetch visits' }));
        throw new Error(err.message || 'Failed to fetch visits');
      }
      const result = await res.json();
      if (signal?.aborted) return;
      if (result.data) {
        setVisits(result.data);
        setTotal(result.total);
      } else if (Array.isArray(result)) {
        setVisits(result);
        setTotal(result.length);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      addToast('error', err.message || 'Error fetching visits');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, todayOnly, doctorFilter, statusFilter, visitType]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => fetchVisits(controller.signal), search.trim() ? 300 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, todayOnly, doctorFilter, statusFilter, page, visitType]);

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary tracking-tight">{title}</h2>
          <p className="text-xs text-ink-secondary mt-0.5 hidden sm:block">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="relative flex-1 min-w-[180px] sm:w-56">
            <Search className="w-4 h-4 text-ink-secondary/60 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search patient, treatment, diagnosis..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-border text-xs focus:outline-none focus:ring-1 focus:ring-brand bg-surface-card"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="New">New</option>
            <option value="Follow Up">Follow Up</option>
            <option value="Dressing">Dressing</option>
          </select>

          {isAdmin && (
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand cursor-pointer"
            >
              <option value="">All Doctors</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setTodayOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border transition-colors cursor-pointer shrink-0 ${
              todayOnly
                ? 'bg-brand text-white border-brand shadow-xs'
                : 'bg-surface-card text-ink-primary border-border hover:bg-surface-page'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{todayOnly ? 'Today' : 'All Dates'}</span>
          </button>

          <button
            onClick={() =>
              exportToCsv(
                `${visitType.toLowerCase()}-daybook`,
                visits.map((v) => ({
                  date: v.date,
                  patient: v.patient?.name,
                  phone: v.patient?.phone,
                  diagnosis: v.diagnosis,
                  treatment: v.treatmentName,
                  status: v.status,
                  doctor: v.doctor?.name,
                  cash: v.cashAmount,
                  bank: v.bankAmount,
                })),
                [
                  { key: 'date', label: 'Date' },
                  { key: 'patient', label: 'Patient Name' },
                  { key: 'phone', label: 'Mobile No.' },
                  { key: 'diagnosis', label: 'Diagnosis' },
                  { key: 'treatment', label: 'Treatment' },
                  { key: 'status', label: 'Status' },
                  { key: 'doctor', label: 'Doctor' },
                  { key: 'cash', label: 'Cash' },
                  { key: 'bank', label: 'Bank' },
                ],
              )
            }
            className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border transition-colors cursor-pointer shrink-0"
            title="Export page to CSV"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : visits.length === 0 ? (
        <div className="bg-surface-card rounded-[10px] border border-border p-12 text-center space-y-2">
          <p className="text-sm font-semibold text-ink-primary">No {visitType} entries found</p>
          <p className="text-xs text-ink-secondary">
            {todayOnly
              ? 'Nothing recorded today. Switch to "All Dates" to see the full register.'
              : 'New entries are logged from the Visits tab.'}
          </p>
        </div>
      ) : (
        <div className="bg-surface-card rounded-[10px] border border-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-page border-b border-border text-ink-secondary font-medium text-xs">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Patient</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Diagnosis</th>
                  <th className="py-3 px-4">Treatment</th>
                  <th className="py-3 px-4">Status</th>
                  {isAdmin && <th className="py-3 px-4">Doctor</th>}
                  <th className="py-3 px-4 text-right">Cash</th>
                  <th className="py-3 px-4 text-right">Bank</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-ink-primary">
                {visits.map((visit) => (
                  <tr key={visit.id} className="hover:bg-surface-page/60 transition-colors">
                    <td className="py-3 px-4 font-mono text-ink-secondary whitespace-nowrap">{visit.date}</td>
                    <td className="py-3 px-4 font-medium text-ink-primary">{visit.patient?.name}</td>
                    <td className="py-3 px-4 font-mono text-ink-secondary">{visit.patient?.phone}</td>
                    <td className="py-3 px-4 text-ink-secondary max-w-[180px] truncate" title={visit.diagnosis}>
                      {visit.diagnosis || '—'}
                    </td>
                    <td className="py-3 px-4 text-ink-secondary max-w-[180px] truncate" title={visit.treatmentName}>
                      {visit.treatmentName}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge label={visit.status} variant={statusVariant(visit.status)} />
                    </td>
                    {isAdmin && <td className="py-3 px-4 text-ink-secondary">{visit.doctor?.name || '—'}</td>}
                    <td className="py-3 px-4 text-right font-mono text-ink-secondary">{money(visit.cashAmount)}</td>
                    <td className="py-3 px-4 text-right font-mono text-ink-secondary">{money(visit.bankAmount)}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedPatient(visit.patient)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-ink-secondary" />
                        <span>History</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && visits.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
      )}

      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface-card z-10 flex items-center justify-between p-6 pb-3 border-b border-border">
              <div>
                <h3 className="text-base font-semibold text-ink-primary">{selectedPatient.name}</h3>
                <p className="text-xs font-mono text-ink-secondary mt-0.5">{selectedPatient.phone}</p>
              </div>
              <button
                onClick={() => setSelectedPatient(null)}
                className="p-1 rounded text-ink-secondary hover:text-ink-primary text-sm font-semibold cursor-pointer"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <PatientHistoryPanel patient={selectedPatient} />
            </div>
            <div className="sticky bottom-0 bg-surface-card border-t border-border p-4 flex justify-end">
              <button
                onClick={() => setSelectedPatient(null)}
                className="px-4 py-1.5 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
