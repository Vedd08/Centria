import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { VisitLoggingModal } from './VisitLoggingModal';
import { TreatmentMasterModal } from '../Treatments/TreatmentMasterModal';
import { exportToCsv } from '../../utils/exportToCsv';
import { useToast } from '../../context/ToastContext';
import { Stethoscope, Plus, RefreshCw, Lock, Shield, Eye, Edit3, Save, X, Download } from 'lucide-react';
import { Pagination } from '../common/Pagination';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { ConfirmDialog } from '../common/ConfirmDialog';

export interface VisitRecord {
  id: string;
  date: string;
  patientId: string;
  patient: {
    uhid: string;
    name: string;
    phone: string;
  };
  doctorId: string;
  doctor?: {
    id: string;
    name: string;
    email: string;
  };
  rmId: string;
  rm?: {
    id: string;
    name: string;
    email: string;
  };
  operator: string;
  treatmentId: string;
  treatmentName: string;
  treatmentPrice?: number;
  treatment?: {
    id: string;
    name: string;
    price: number;
    isGstTaxable: boolean;
  };
  isGstTaxable: boolean;
  packagePurchaseId?: string;
  diagnosis?: string;
  status: 'New' | 'Follow Up';
  nextAppointmentDate?: string;
  createdAt: string;
}

export const VisitList: React.FC = () => {
  const { hasRole, apiFetch } = useAuth();
  const [visits, setVisits] = useState<VisitRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalVisits, setTotalVisits] = useState(0);
  const pageSize = 15;
  
  const [isLogVisitOpen, setIsLogVisitOpen] = useState(false);
  const [isTreatmentsOpen, setIsTreatmentsOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<VisitRecord | null>(null);
  
  // Inline edit state
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [editDiagnosis, setEditDiagnosis] = useState('');
  const [editStatus, setEditStatus] = useState<'New' | 'Follow Up'>('New');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<VisitRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { addToast } = useToast();
  const canLogVisit = hasRole('RM', 'DOCTOR', 'MASTER', 'SUPER_ADMIN');
  const canEditVisit = hasRole('DOCTOR', 'MASTER', 'SUPER_ADMIN');
  const isAdmin = hasRole('MASTER', 'SUPER_ADMIN');

  const fetchVisits = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      const res = await apiFetch(`/api/visits?${params}`, { signal });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to fetch visits' }));
        throw new Error(err.message || 'Failed to fetch visits');
      }
      const result = await res.json();
      if (result.data) {
        setVisits(result.data);
        setTotalVisits(result.total);
      } else if (Array.isArray(result)) {
        setVisits(result);
        setTotalVisits(result.length);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      addToast('error', err.message || 'Failed to load visits');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchVisits(controller.signal);
    return () => controller.abort();
  }, [page]);

  const startEditing = (visit: VisitRecord) => {
    setEditingVisitId(visit.id);
    setEditDiagnosis(visit.diagnosis || '');
    setEditStatus(visit.status);
    setEditError(null);
  };

  const cancelEditing = () => {
    setEditingVisitId(null);
    setEditDiagnosis('');
    setEditStatus('New');
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editingVisitId) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await apiFetch(`/api/visits/${editingVisitId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          diagnosis: editDiagnosis || undefined,
          status: editStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to update visit');
      
      setEditingVisitId(null);
      // Refresh the selected visit data
      if (selectedVisit && selectedVisit.id === editingVisitId) {
        setSelectedVisit(data);
      }
      fetchVisits();
    } catch (err: any) {
      setEditError(err.message || 'Error updating visit');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (visit: VisitRecord) => {
    setDeletingId(visit.id);
    try {
      const res = await apiFetch(`/api/visits/${visit.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to delete visit' }));
        throw new Error(err.message || 'Failed to delete visit');
      }
      addToast('success', 'Visit deleted successfully');
      setConfirmDelete(null);
      fetchVisits();
      if (selectedVisit?.id === visit.id) {
        setSelectedVisit(null);
        cancelEditing();
      }
    } catch (err: any) {
      addToast('error', err.message || 'Error deleting visit');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Stethoscope className="w-4.5 h-4.5 text-brand" /> Clinic Visit Logging
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Daily patient visit records with auto-filled Business Rule 1 GST taxability.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsTreatmentsOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded-md transition-colors cursor-pointer"
          >
            <Shield className="w-4 h-4 text-brand" />
            <span>{isAdmin ? 'Manage Treatments' : 'View Treatments'}</span>
          </button>

          <button
            onClick={() => exportToCsv('visits', visits, [
              { key: 'date', label: 'Date' },
              { key: 'patient', label: 'Patient', format: (v: any) => v?.name || '' },
              { key: 'patient', label: 'UHID', format: (v: any) => v?.uhid || '' },
              { key: 'treatmentName', label: 'Treatment' },
              { key: 'isGstTaxable', label: 'GST Taxable', format: (v: boolean) => v ? 'Yes' : 'No' },
              { key: 'status', label: 'Status' },
              { key: 'doctor', label: 'Doctor', format: (v: any) => v?.name || '' },
              { key: 'rm', label: 'RM', format: (v: any) => v?.name || '' },
              { key: 'operator', label: 'Operator' },
            ])}
            className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border transition-colors cursor-pointer shrink-0"
            title="Export to CSV"
          >
            <Download className="w-4 h-4" />
          </button>

          {canLogVisit && (
            <button
              onClick={() => setIsLogVisitOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Log Daily Visit</span>
            </button>
          )}
        </div>
      </div>

      {/* Visits Table */}
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : visits.length === 0 ? (
        <div className="bg-surface-card rounded-[10px] border border-border p-12 text-center space-y-2 shadow-xs">
          <p className="text-sm font-semibold text-ink-primary">No visits logged</p>
          <p className="text-xs text-ink-secondary">Click "Log Daily Visit" to record a patient consultation or procedure.</p>
        </div>
      ) : (
        <div className="bg-surface-card rounded-[10px] border border-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-page border-b border-border text-ink-secondary font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Patient (UHID)</th>
                  <th className="py-3 px-4">Treatment</th>
                  <th className="py-3 px-4">GST (Rule 1)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Doctor & RM</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {visits.map((visit) => (
                  <tr key={visit.id} className="hover:bg-surface-page/60 transition-colors">
                    <td className="py-3 px-4 font-semibold text-ink-primary">{visit.date}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-ink-primary">{visit.patient?.name}</div>
                      <div className="font-mono text-[11px] text-ink-secondary">{visit.patient?.uhid}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-ink-primary">{visit.treatmentName}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                        visit.isGstTaxable
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      }`}>
                        <Lock className="w-3 h-3" />
                        {visit.isGstTaxable ? '18% Taxable' : 'Exempt'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                        visit.status === 'New'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-sky-50 text-sky-800 border-sky-200'
                      }`}>
                        {visit.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-ink-secondary text-[11px]">
                      <div>Doc: {visit.doctor?.name || '—'}</div>
                      <div>RM: {visit.rm?.name || '—'}</div>
                    </td>
                    <td className="py-3 px-4 text-ink-secondary">{visit.operator}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canEditVisit && (
                          <button
                            onClick={() => {
                              setSelectedVisit(visit);
                              startEditing(visit);
                            }}
                            className="p-1.5 rounded text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border transition-colors cursor-pointer"
                            title="Edit visit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedVisit(visit)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-ink-secondary" />
                          <span>View</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && visits.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={totalVisits} onPageChange={setPage} />
      )}

      {/* Log Visit Modal */}
      <VisitLoggingModal
        isOpen={isLogVisitOpen}
        onClose={() => setIsLogVisitOpen(false)}
        onVisitLogged={fetchVisits}
      />

      {/* Treatments Catalog Modal */}
      <TreatmentMasterModal
        isOpen={isTreatmentsOpen}
        onClose={() => setIsTreatmentsOpen(false)}
      />

      {/* Visit Detail + Edit Modal */}
      {selectedVisit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-lg w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface-card z-10 flex items-center justify-between p-6 pb-3 border-b border-border">
              <div>
                <span className="text-xs font-mono font-semibold text-brand-deep bg-brand-soft border border-brand/20 px-2 py-0.5 rounded">
                  {selectedVisit.patient?.uhid}
                </span>
                <h3 className="text-base font-semibold text-ink-primary mt-1">{selectedVisit.patient?.name}</h3>
              </div>
              <button
                onClick={() => { setSelectedVisit(null); cancelEditing(); }}
                className="p-1 rounded text-ink-secondary hover:text-ink-primary text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-3 text-xs">
              {editError && (
                <div className="p-2.5 rounded-md bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs">
                  {editError}
                </div>
              )}

              <div className="bg-surface-page p-3.5 rounded-lg border border-border space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-ink-secondary">Treatment</span>
                  <span className="font-semibold text-ink-primary">{selectedVisit.treatmentName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-secondary">GST Taxability</span>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                    selectedVisit.isGstTaxable ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
                  }`}>
                    {selectedVisit.isGstTaxable ? 'GST Taxable' : 'GST Exempt'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-secondary">Date</span>
                  <span className="font-semibold text-ink-primary">{selectedVisit.date}</span>
                </div>
              </div>

              <div className="bg-surface-page p-3.5 rounded-lg border border-border space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-ink-secondary">Attending Doctor</span>
                  <span className="font-semibold text-ink-primary">{selectedVisit.doctor?.name || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-secondary">RM</span>
                  <span className="font-semibold text-ink-primary">{selectedVisit.rm?.name || '—'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ink-secondary">Operator</span>
                  <span className="font-semibold text-ink-primary">{selectedVisit.operator}</span>
                </div>
              </div>

              {/* Editable fields */}
              <div className="bg-surface-page p-3.5 rounded-lg border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-ink-secondary font-medium">Visit Status</span>
                  {editingVisitId === selectedVisit.id ? (
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as 'New' | 'Follow Up')}
                      className="px-2 py-1 rounded border border-border text-xs font-semibold bg-white"
                    >
                      <option value="New">New Visit</option>
                      <option value="Follow Up">Follow Up</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                      selectedVisit.status === 'New'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-sky-50 text-sky-800 border-sky-200'
                    }`}>
                      {selectedVisit.status}
                    </span>
                  )}
                </div>

                {editingVisitId === selectedVisit.id ? (
                  <div>
                    <label className="block text-ink-secondary mb-1">Diagnosis / Notes</label>
                    <textarea
                      value={editDiagnosis}
                      onChange={(e) => setEditDiagnosis(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-1 focus:ring-brand"
                      placeholder="Enter or update diagnosis notes..."
                    />
                  </div>
                ) : selectedVisit.diagnosis ? (
                  <div>
                    <span className="text-ink-secondary block mb-1">Diagnosis</span>
                    <div className="text-ink-primary bg-white p-2 rounded border border-border">{selectedVisit.diagnosis}</div>
                  </div>
                ) : null}
              </div>

              {selectedVisit.nextAppointmentDate && (
                <div className="bg-surface-page p-3 rounded-lg border border-border">
                  <span className="text-ink-secondary">Next Appointment: </span>
                  <span className="font-semibold text-ink-primary">{selectedVisit.nextAppointmentDate}</span>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-surface-card border-t border-border p-4 flex justify-end gap-2">
              {editingVisitId === selectedVisit.id ? (
                <>
                  <button
                    onClick={cancelEditing}
                    className="px-4 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5 inline mr-1" /> Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={editSaving}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-3.5 h-3.5 inline mr-1" />
                    {editSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </>
              ) : (
                <>
                  {canEditVisit && (
                    <button
                      onClick={() => startEditing(selectedVisit)}
                      className="px-4 py-1.5 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5 inline mr-1" /> Edit
                    </button>
                  )}
                  {isAdmin && (
                    <button
                      onClick={() => setConfirmDelete(selectedVisit)}
                      className="px-4 py-1.5 text-xs font-medium text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/20 rounded cursor-pointer mr-auto"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    onClick={() => { setSelectedVisit(null); cancelEditing(); }}
                    className="px-4 py-1.5 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded cursor-pointer"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDelete}
        title="Delete Visit Record"
        message={`Are you sure you want to delete the visit for ${confirmDelete?.patient?.name} on ${confirmDelete?.date}? This will reverse any package sitting deductions. This action cannot be undone.`}
        confirmLabel="Delete Visit"
        variant="danger"
        loading={deletingId === confirmDelete?.id}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />

    </div>
  );
};
