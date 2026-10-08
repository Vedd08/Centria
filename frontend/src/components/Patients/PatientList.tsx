import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PatientRegistrationModal } from './PatientRegistrationModal';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { PatientHistoryPanel } from '../PatientHistory/PatientHistoryPanel';
import { exportToCsv } from '../../utils/exportToCsv';
import { Search, UserPlus, Eye, Edit3, Trash2, Download } from 'lucide-react';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { Pagination } from '../common/Pagination';
import { StatusBadge } from '../common/StatusBadge';
import { useClinicProfile } from '../../hooks/useClinicProfile';

export interface Patient {
  id: string;
  uhid: string;
  name: string;
  phone: string;
  email?: string;
  dob?: string;
  gender: string;
  address?: string;
  allergyNotes?: string;
  referringDoctor?: string;
  howHeardAboutUs?: string;
  createdAt: string;
}

export const PatientList: React.FC = () => {
  const { hasRole, apiFetch } = useAuth();
  const clinic = useClinicProfile();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPatients, setTotalPatients] = useState(0);
  const pageSize = 15;
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { addToast } = useToast();

  const canRegister = hasRole('RM', 'RECEPTION', 'MASTER', 'SUPER_ADMIN');
  const canDelete = hasRole('SUPER_ADMIN', 'MASTER');

  const handleDeletePatient = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/patients/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete patient');
      addToast('success', `Patient ${deleteTarget.name} deleted`);
      setDeleteTarget(null);
      fetchPatients();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to delete patient');
    } finally {
      setDeleting(false);
    }
  };

  const fetchPatients = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      const res = await apiFetch(`/api/patients?${params}`, { signal });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to fetch patients' }));
        throw new Error(err.message || 'Failed to fetch patients');
      }
      const result = await res.json();
      if (signal?.aborted) return;
      if (result.data) {
        setPatients(result.data);
        setTotalPatients(result.total);
      } else if (Array.isArray(result)) {
        setPatients(result);
        setTotalPatients(result.length);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      addToast('error', err.message || 'Error fetching patients');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  // Debounce search input; page changes fetch immediately
  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchPatients(controller.signal);
    }, search.trim() ? 300 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, page]);

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary tracking-tight">
            {clinic ? `${clinic.name} — Patient Directory` : 'Patient Directory'}
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5 hidden sm:block">
            Searchable directory of registered patients, UHID records, and intake details.
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search Box */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-ink-secondary/60 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Name, UHID, Phone..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-border text-xs focus:outline-none focus:ring-1 focus:ring-brand bg-surface-card"
            />
          </div>

          <button
            onClick={() => exportToCsv('patients', patients, [
              { key: 'uhid', label: 'UHID' },
              { key: 'name', label: 'Name' },
              { key: 'phone', label: 'Phone' },
              { key: 'gender', label: 'Gender' },
              { key: 'dob', label: 'DOB' },
              { key: 'referringDoctor', label: 'Referring Dr' },
              { key: 'howHeardAboutUs', label: 'Referral Channel' },
            ])}
            className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border transition-colors cursor-pointer shrink-0"
            title="Export to CSV"
          >
            <Download className="w-4 h-4" />
          </button>

          {canRegister && (
            <button
              onClick={() => { setEditPatient(null); setIsRegisterOpen(true); }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Register Patient</span>
            </button>
          )}
        </div>
      </div>

      {/* Patients Data Table */}
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : patients.length === 0 ? (
        <div className="bg-surface-card rounded-[10px] border border-border p-12 text-center space-y-2">
          <p className="text-sm font-semibold text-ink-primary">No patients found</p>
          <p className="text-xs text-ink-secondary">
            {search ? `No patient matches search query "${search}".` : 'Click "Register Patient" to add your first patient intake record.'}
          </p>
        </div>
      ) : (
        <div className="bg-surface-card rounded-[10px] border border-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-page border-b border-border text-ink-secondary font-medium text-xs">
                  <th className="py-3 px-4">Patient Name</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">Gender & Age</th>
                  <th className="py-3 px-4">Referring Doctor</th>
                  <th className="py-3 px-4">Allergy Alerts</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-ink-primary">
                {patients.map((patient) => (
                  <tr key={patient.id} className="hover:bg-surface-page/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-ink-primary">{patient.name}</td>
                    <td className="py-3 px-4 font-mono text-ink-secondary">{patient.phone}</td>
                    <td className="py-3 px-4 text-ink-secondary font-mono">
                      {patient.gender} {patient.dob ? `(${patient.dob})` : ''}
                    </td>
                    <td className="py-3 px-4 text-ink-secondary">{patient.referringDoctor || 'Self Walk-in'}</td>
                    <td className="py-3 px-4">
                      {patient.allergyNotes ? (
                        <StatusBadge label="Allergy Recorded" variant="danger" />
                      ) : (
                        <span className="text-ink-secondary/60 text-[11px]">None</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canRegister && (
                          <button
                            onClick={() => { setEditPatient(patient); setIsRegisterOpen(true); }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded transition-colors cursor-pointer"
                            title="Edit patient"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-ink-secondary" />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedPatient(patient)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-ink-secondary" />
                          <span>View</span>
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => setDeleteTarget(patient)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/20 rounded transition-colors cursor-pointer"
                            title="Delete patient"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
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
      {!loading && patients.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={totalPatients} onPageChange={setPage} />
      )}

      {/* Patient Registration/Edit Modal */}
      <PatientRegistrationModal
        isOpen={isRegisterOpen}
        onClose={() => { setIsRegisterOpen(false); setEditPatient(null); }}
        onPatientCreated={() => fetchPatients()}
        editPatient={editPatient}
      />

      {/* Patient Details Modal — full history via the shared panel (visits,
          prescriptions, documents/images, IPD admissions) */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface-card z-10 flex items-center justify-between p-6 pb-3 border-b border-border">
              <div>
                <span className="text-xs font-mono font-semibold text-brand-deep bg-brand-soft border border-brand/20 px-2 py-0.5 rounded">
                  {selectedPatient.uhid}
                </span>
                <h3 className="text-base font-semibold text-ink-primary mt-1">{selectedPatient.name}</h3>
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
              {canRegister && (
                <button
                  onClick={() => { setEditPatient(selectedPatient); setIsRegisterOpen(true); }}
                  className="px-4 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer mr-2"
                >
                  <Edit3 className="w-3.5 h-3.5 inline mr-1" /> Edit Profile
                </button>
              )}
              <button
                onClick={() => setSelectedPatient(null)}
                className="px-4 py-1.5 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded cursor-pointer"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Patient Record"
        message={`Are you sure you want to delete ${deleteTarget?.name} (${deleteTarget?.uhid})? This will also delete all their visits, prescriptions, and related records.`}
        confirmLabel="Delete Patient"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeletePatient}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
