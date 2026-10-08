import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { Network, Plus, X, Edit3, Trash2, Stethoscope } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string;
  description?: string;
  isActive: boolean;
  users: { id: string; name: string; role: string }[];
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

/**
 * Departments are how a hospital stays navigable as it grows: reception picks a
 * department first, so the doctor list stays short however many consultants there are,
 * and each department runs its own daily token series.
 */
export const DepartmentAdmin: React.FC = () => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<{ id: string; name: string; departmentId?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [dRes, uRes] = await Promise.all([apiFetch('/api/departments'), apiFetch('/api/users?role=DOCTOR,MASTER')]);
      if (!dRes.ok) throw new Error('Could not load departments');
      setDepartments(await dRes.json());
      const u = await uRes.json();
      setDoctors(Array.isArray(u) ? u : u.data || []);
    } catch (err: any) {
      addToast('error', err.message || 'Could not load departments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNew = () => {
    setEditing(null);
    setName('');
    setCode('');
    setDescription('');
    setIsActive(true);
    setShowForm(true);
  };

  const openEdit = (d: Department) => {
    setEditing(d);
    setName(d.name);
    setCode(d.code);
    setDescription(d.description || '');
    setIsActive(d.isActive);
    setShowForm(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiFetch(editing ? `/api/departments/${editing.id}` : '/api/departments', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          description: description.trim() || undefined,
          isActive,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message || 'Could not save the department');
      addToast('success', editing ? 'Department updated' : 'Department created');
      setShowForm(false);
      load();
    } catch (err: any) {
      addToast('error', err.message || 'Could not save the department');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/departments/${deleteTarget.id}`, { method: 'DELETE' });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.message || 'Could not delete the department');
      addToast('success', 'Department deleted');
      setDeleteTarget(null);
      load();
    } catch (err: any) {
      addToast('error', err.message || 'Could not delete the department');
    } finally {
      setBusy(false);
    }
  };

  /** Assigning a doctor is a one-field update on their user record. */
  const assignDoctor = async (doctorId: string, departmentId: string) => {
    try {
      const res = await apiFetch(`/api/users/${doctorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departmentId: departmentId || '' }),
      });
      if (!res.ok) throw new Error('Could not move that doctor');
      addToast('success', 'Doctor reassigned');
      load();
    } catch (err: any) {
      addToast('error', err.message || 'Could not move that doctor');
    }
  };

  const unassigned = doctors.filter((d) => !d.departmentId);

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="font-display text-lg font-semibold tracking-tight flex items-center gap-2">
            <Network className="w-5 h-5 text-brand" /> Departments
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Reception picks a department before a doctor, and each department counts its own tokens from 1 each day.
          </p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" /> New Department
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{editing ? 'Edit department' : 'New department'}</h3>
            <button type="button" onClick={() => setShowForm(false)} className="p-1 rounded text-ink-secondary hover:text-ink-primary cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block eyebrow text-ink-secondary mb-1">Name</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Plastic Surgery" className={inputClass} />
            </div>
            <div>
              <label className="block eyebrow text-ink-secondary mb-1">Token code</label>
              <input
                required
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="PLS"
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className="block eyebrow text-ink-secondary mb-1">Taking patients</label>
              <select value={isActive ? 'yes' : 'no'} onChange={(e) => setIsActive(e.target.value === 'yes')} className={inputClass}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block eyebrow text-ink-secondary mb-1">Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-medium text-ink-primary bg-surface-page border border-border rounded-md cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50">
              {busy ? 'Saving...' : editing ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : departments.length === 0 ? (
        <div className="bg-surface-card rounded-[10px] border border-border p-12 text-center space-y-2">
          <p className="text-sm font-semibold">No departments yet</p>
          <p className="text-xs text-ink-secondary">
            Create one per speciality — Cardiology, Orthopaedics, Dermatology — then assign your doctors to them.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {departments.map((d) => (
            <div key={d.id} className="bg-surface-card rounded-[10px] border border-border shadow-xs overflow-hidden">
              <div className={`h-1 w-full ${d.isActive ? 'bg-brand' : 'bg-border-strong'}`} />
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-semibold tracking-tight flex items-center gap-2">
                      {d.name}
                      <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-soft text-brand-deep border border-brand/20">
                        {d.code}
                      </span>
                    </h3>
                    <p className="text-[11px] text-ink-secondary mt-0.5">
                      {d.description || 'No description'}
                      {!d.isActive && <span className="text-triage-wait font-medium"> · not taking patients</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => openEdit(d)} className="p-1.5 rounded text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border cursor-pointer">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setDeleteTarget(d)} className="p-1.5 rounded text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/20 cursor-pointer">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="pt-2 border-t border-border">
                  <p className="eyebrow text-ink-secondary mb-1.5">Doctors ({d.users.length})</p>
                  {d.users.length === 0 ? (
                    <p className="text-[11px] text-ink-secondary/70">Nobody assigned yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {d.users.map((u) => (
                        <span key={u.id} className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-surface-sunken border border-border text-[11px]">
                          <Stethoscope className="w-3 h-3 text-brand" />
                          {u.name}
                          <button
                            onClick={() => assignDoctor(u.id, '')}
                            title="Remove from this department"
                            className="text-ink-faint hover:text-status-danger cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {unassigned.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => e.target.value && assignDoctor(e.target.value, d.id)}
                      className={`${inputClass} mt-2`}
                    >
                      <option value="">Add a doctor to {d.name}…</option>
                      {unassigned.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && unassigned.length > 0 && (
        <div className="bg-triage-wait/10 border border-triage-wait/25 rounded-[10px] p-4">
          <p className="text-xs text-triage-wait">
            <span className="font-semibold">{unassigned.length} doctor(s) not in any department</span> —{' '}
            {unassigned.map((u) => u.name).join(', ')}. Reception can still send patients to them, but they won't
            appear under a department.
          </p>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete Department"
        message={`Delete "${deleteTarget?.name}"? Any doctors in it become unassigned. Departments with patient history can't be deleted — mark them inactive instead.`}
        confirmLabel="Delete"
        variant="danger"
        loading={busy}
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
