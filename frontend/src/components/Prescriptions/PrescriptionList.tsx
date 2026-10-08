import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PrintablePrescriptionModal, PrintablePrescriptionData } from './PrintablePrescriptionModal';
import { FileText, Plus, Search, Printer, RefreshCw, PackageCheck, Trash2, X } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface ApiMedicine {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
  isActive: boolean;
}

interface ApiPrescriptionItem {
  id: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  medicine: ApiMedicine;
}

interface ApiPrescription {
  id: string;
  visitId: string;
  status: 'Pending' | 'Dispensed';
  notes?: string | null;
  dispensedAt?: string | null;
  createdAt: string;
  patient: { name: string; uhid: string; dob?: string | null; gender: string };
  visit: { date: string; diagnosis?: string | null; treatmentName: string };
  doctor: { id: string; name: string };
  dispensedBy?: { name: string } | null;
  items: ApiPrescriptionItem[];
}

interface ApiVisit {
  id: string;
  date: string;
  treatmentName: string;
  patient: { name: string; uhid: string };
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

/** Derives "34 Y / Female" for the printed letterhead from the stored DOB. */
const ageGender = (dob: string | null | undefined, gender: string): string => {
  if (!dob) return gender;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return gender;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return `${age} Y / ${gender}`;
};

const toPrintable = (rx: ApiPrescription): PrintablePrescriptionData => ({
  id: rx.id,
  patientName: rx.patient.name,
  patientUhid: rx.patient.uhid,
  patientAgeGender: ageGender(rx.patient.dob, rx.patient.gender),
  doctorName: rx.doctor.name,
  date: rx.visit?.date || rx.createdAt.split('T')[0],
  diagnosis: rx.visit?.diagnosis || undefined,
  notes: rx.notes || undefined,
  items: rx.items.map((i) => ({
    name: i.medicine.name,
    dosage: i.dosage,
    frequency: i.frequency,
    duration: i.duration,
    instructions: `${i.quantity} ${i.medicine.unit}(s) dispensed`,
  })),
});

interface DraftItem {
  medicineId: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
}

export const PrescriptionList: React.FC = () => {
  const { token, hasRole , apiFetch } = useAuth();

  const [prescriptions, setPrescriptions] = useState<ApiPrescription[]>([]);
  const [visits, setVisits] = useState<ApiVisit[]>([]);
  const [medicines, setMedicines] = useState<ApiMedicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Pending' | 'Dispensed'>('ALL');
  const [selected, setSelected] = useState<PrintablePrescriptionData | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [withdrawTarget, setWithdrawTarget] = useState<ApiPrescription | null>(null);

  const [visitId, setVisitId] = useState('');
  const [notes, setNotes] = useState('');
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [medId, setMedId] = useState('');
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('1-0-1');
  const [duration, setDuration] = useState('7 days');
  const [quantity, setQuantity] = useState(1);

  const canPrescribe = hasRole('DOCTOR', 'MASTER', 'SUPER_ADMIN');
  const canDispense = hasRole('PHARMACY');

  const authHeaders = useMemo(() => ({ }), []);

  const fetchData = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const [resRx, resVisits, resMeds] = await Promise.all([
        apiFetch('/api/prescriptions', { headers: authHeaders, signal }),
        apiFetch('/api/visits?pageSize=500', { headers: authHeaders, signal }),
        apiFetch('/api/medicines', { headers: authHeaders, signal }),
      ]);

      const dataRx = await resRx.json();
      if (!resRx.ok) throw new Error(dataRx.message || 'Failed to load prescriptions');
      setPrescriptions(Array.isArray(dataRx) ? dataRx : []);

      if (resVisits.ok) {
        const resultVisits = await resVisits.json();
        const dataVisits = Array.isArray(resultVisits) ? resultVisits : (resultVisits.data || []);
        if (Array.isArray(dataVisits)) {
          setVisits(dataVisits);
          if (dataVisits.length > 0) setVisitId((prev) => prev || dataVisits[0].id);
        }
      }

      if (resMeds.ok) {
        const dataMeds = await resMeds.json();
        if (Array.isArray(dataMeds)) {
          const active = dataMeds.filter((m: ApiMedicine) => m.isActive);
          setMedicines(active);
          if (active.length > 0) setMedId((prev) => prev || active[0].id);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Could not reach the prescriptions service');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, []);

  const handleAddDraftItem = () => {
    const med = medicines.find((m) => m.id === medId);
    if (!med || !dosage.trim()) return;
    setDraftItems([
      ...draftItems,
      {
        medicineId: med.id,
        medicineName: med.name,
        dosage: dosage.trim(),
        frequency: frequency.trim(),
        duration: duration.trim(),
        quantity: Number(quantity),
      },
    ]);
    setDosage('');
    setQuantity(1);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitId || draftItems.length === 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      const res = await apiFetch('/api/prescriptions', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitId,
          notes: notes.trim() || undefined,
          items: draftItems.map(({ medicineId, dosage, frequency, duration, quantity }) => ({
            medicineId,
            dosage,
            frequency,
            duration,
            quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          Array.isArray(data.message) ? data.message.join('; ') : data.message || 'Failed to save prescription',
        );
      }

      setIsAddOpen(false);
      setNotes('');
      setDraftItems([]);
      await fetchData();
      setSelected(toPrintable(data));
    } catch (err: any) {
      setFormError(err.message || 'Error saving prescription');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDispense = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await apiFetch(`/api/prescriptions/${id}/dispense`, {
        method: 'PATCH',
        headers: authHeaders,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Dispensing failed');
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Dispensing failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleWithdraw = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await apiFetch(`/api/prescriptions/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Could not withdraw prescription');
      }
      fetchData();
    } catch (err: any) {
      setError(err.message || 'Could not withdraw prescription');
    } finally {
      setBusyId(null);
    }
  };

  const visible = prescriptions
    .filter((rx) => (statusFilter === 'ALL' ? true : rx.status === statusFilter))
    .filter((rx) => {
      const q = search.toLowerCase();
      return (
        rx.patient.name.toLowerCase().includes(q) ||
        rx.patient.uhid.toLowerCase().includes(q) ||
        rx.id.toLowerCase().includes(q)
      );
    });

  const pendingCount = prescriptions.filter((rx) => rx.status === 'Pending').length;

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      <PrintablePrescriptionModal prescription={selected} onClose={() => setSelected(null)} />

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <FileText className="w-4.5 h-4.5 text-brand" /> Patient Prescriptions
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Issue and print clinic prescriptions. Pharmacy dispensing deducts medicine stock.
            {pendingCount > 0 && (
              <span className="font-medium text-status-warning"> {pendingCount} awaiting dispense.</span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-ink-secondary/60 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Patient, UHID, Rx #..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-border text-xs focus:outline-none focus:ring-1 focus:ring-brand bg-surface-card"
            />
          </div>

          <button
            onClick={() => fetchData()}
            disabled={loading}
            className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border transition-colors cursor-pointer shrink-0"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {canPrescribe && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>New Prescription</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs">
          {error}
        </div>
      )}

      {/* Status filter */}
      <div className="flex items-center gap-1.5 text-xs font-medium">
        {(['ALL', 'Pending', 'Dispensed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full border transition-colors cursor-pointer ${
              statusFilter === s
                ? 'bg-brand text-white border-brand font-semibold'
                : 'bg-surface-card text-ink-secondary border-border hover:bg-surface-page'
            }`}
          >
            {s === 'ALL' ? 'All' : s}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="bg-surface-card rounded-[10px] border border-border p-8 text-center text-xs text-ink-secondary shadow-xs">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-brand mb-2" />
          Loading prescriptions...
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-surface-card rounded-[10px] border border-border p-8 text-center text-xs text-ink-secondary shadow-xs">
          {prescriptions.length === 0
            ? 'No prescriptions issued yet.'
            : 'No prescriptions match the current filter.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map((rx) => (
            <div
              key={rx.id}
              className="bg-surface-card rounded-[10px] border border-border p-5 shadow-xs hover:border-brand/40 transition-colors flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-brand" />
                    <span className="font-mono font-bold text-xs">{rx.id.slice(0, 18)}</span>
                  </div>
                  <StatusBadge
                    label={rx.status}
                    variant={rx.status === 'Dispensed' ? 'success' : 'warning'}
                  />
                </div>

                <div>
                  <div className="text-sm font-semibold">{rx.patient.name}</div>
                  <div className="text-xs text-ink-secondary flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="font-mono">{rx.patient.uhid}</span>
                    <span>&bull;</span>
                    <span>Dr. {rx.doctor.name}</span>
                  </div>
                </div>

                {rx.visit?.diagnosis && (
                  <div className="text-xs text-ink-secondary bg-surface-page p-2.5 rounded border border-border/60">
                    <span className="font-medium text-ink-primary block">Diagnosis:</span>
                    <span>{rx.visit.diagnosis}</span>
                  </div>
                )}

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wider block">
                    Prescribed Items ({rx.items.length})
                  </span>
                  {rx.items.map((item) => (
                    <div
                      key={item.id}
                      className="text-xs flex items-center justify-between gap-2 font-medium"
                    >
                      <span className="truncate">&bull; {item.medicine.name}</span>
                      <span className="font-mono text-ink-secondary text-[11px] shrink-0">
                        {item.frequency} ({item.duration})
                      </span>
                    </div>
                  ))}
                </div>

                {rx.status === 'Dispensed' && rx.dispensedBy && (
                  <div className="text-[11px] text-ink-secondary">
                    Dispensed by {rx.dispensedBy.name}
                    {rx.dispensedAt ? ` on ${rx.dispensedAt.split('T')[0]}` : ''}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-ink-secondary">
                  {rx.visit?.date || rx.createdAt.split('T')[0]}
                </span>
                <div className="flex items-center gap-2">
                  {canPrescribe && rx.status === 'Pending' && (
                    <button
                      onClick={() => setWithdrawTarget(rx)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium text-ink-secondary hover:text-status-danger hover:bg-status-danger/10 transition-colors cursor-pointer"
                      title="Withdraw prescription"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canDispense && rx.status === 'Pending' && (
                    <button
                      onClick={() => handleDispense(rx.id)}
                      disabled={busyId === rx.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-status-success/15 text-status-success text-xs font-medium hover:bg-status-success hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      <span>{busyId === rx.id ? 'Dispensing...' : 'Dispense'}</span>
                    </button>
                  )}
                  <button
                    onClick={() => setSelected(toPrintable(rx))}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-brand-soft text-brand-deep text-xs font-medium hover:bg-brand hover:text-white transition-colors cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>View &amp; Print</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!withdrawTarget}
        title="Withdraw Prescription"
        message={`Remove prescription for ${withdrawTarget?.patient?.name}? This action cannot be undone.`}
        confirmLabel="Withdraw"
        variant="danger"
        onConfirm={() => {
          if (withdrawTarget) handleWithdraw(withdrawTarget.id);
          setWithdrawTarget(null);
        }}
        onCancel={() => setWithdrawTarget(null)}
      />

      {/* Create Prescription Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface-card rounded-[10px] border border-border p-6 max-w-lg w-full space-y-4 shadow-xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-semibold">Issue Prescription</h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="p-1 rounded text-ink-secondary hover:bg-surface-page cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-md bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs">
                {formError}
              </div>
            )}

            {visits.length === 0 && (
              <div className="p-2.5 rounded-md bg-status-warning/10 border border-status-warning/20 text-status-warning text-xs">
                No visits available. Log a visit before issuing a prescription — a prescription is
                always attached to a consultation.
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Against Visit <span className="text-status-danger">*</span>
                </label>
                <select
                  required
                  value={visitId}
                  onChange={(e) => setVisitId(e.target.value)}
                  className={inputClass}
                >
                  {visits.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.date} — {v.patient?.name} ({v.patient?.uhid}) — {v.treatmentName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Add medication */}
              <div className="p-3 bg-surface-page rounded-md border border-border space-y-2">
                <span className="text-xs font-semibold block">Add Prescribed Medication</span>

                <select
                  value={medId}
                  onChange={(e) => setMedId(e.target.value)}
                  className={inputClass}
                >
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.stockQty} {m.unit}(s) in stock)
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Dosage (e.g. 1 ml)"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    placeholder="Frequency (e.g. 1-0-1)"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    placeholder="Duration (e.g. 7 days)"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder="Qty to dispense"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className={inputClass}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAddDraftItem}
                  disabled={!medId || !dosage.trim()}
                  className="w-full py-1.5 bg-brand-soft text-brand-deep text-xs font-medium rounded hover:bg-brand hover:text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Add Item to Prescription
                </button>

                {draftItems.length > 0 && (
                  <div className="pt-2 space-y-1 text-xs">
                    {draftItems.map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 border-b border-border/40 pb-1"
                      >
                        <span className="truncate font-medium">{item.medicineName}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono text-ink-secondary">
                            {item.frequency} &times;{item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => setDraftItems(draftItems.filter((_, j) => j !== i))}
                            className="p-0.5 rounded text-ink-secondary hover:text-status-danger cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Doctor Advice / Pre-care Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Special instructions for the patient..."
                  rows={2}
                  className={inputClass}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-ink-secondary hover:text-ink-primary cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || draftItems.length === 0 || !visitId}
                  className="px-4 py-2 bg-brand text-white text-xs font-medium rounded-md shadow-xs hover:bg-brand-deep disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Saving...' : 'Save & Print Prescription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
