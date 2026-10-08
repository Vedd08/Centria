import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../common/StatusBadge';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { Users, Plus, RefreshCw, X, Edit3, Check, AlertCircle, Shield, UserCheck, Calendar } from 'lucide-react';
import { DoctorScheduleModal } from './DoctorScheduleModal';

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  assignedDoctorId?: string | null;
  assignedDoctor?: { id: string; name: string } | null;
}

/** Roles that carry out a doctor's orders, so they can be linked to one. */
const DOCTOR_LINKED_ROLES = ['NURSE', 'STAFF'];

const ROLE_OPTIONS = ['SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'ACCOUNT', 'NURSE', 'STAFF'] as const;

const inputClass = 'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

export const UserList: React.FC = () => {
  const { token, hasRole , apiFetch } = useAuth();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [scheduleDoctor, setScheduleDoctor] = useState<{ id: string; name: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('RECEPTION');
  const [assignedDoctorId, setAssignedDoctorId] = useState('');

  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const doctors = useMemo(
    () => users.filter((u) => ['DOCTOR', 'MASTER', 'SUPER_ADMIN'].includes(u.role)),
    [users],
  );
  const showDoctorLink = DOCTOR_LINKED_ROLES.includes(role);

  const isAdmin = hasRole('MASTER', 'SUPER_ADMIN');

  const authHeaders = useMemo(() => ({ }), []);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/users', { headers: authHeaders });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Could not load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const openForm = (user?: UserItem) => {
    if (user) {
      setEditingUser(user);
      setName(user.name);
      setEmail(user.email);
      setPassword('');
      setRole(user.role);
      setAssignedDoctorId(user.assignedDoctorId || '');
    } else {
      setEditingUser(null);
      setName('');
      setEmail('');
      setPassword('');
      setRole('RECEPTION');
      setAssignedDoctorId('');
    }
    setTouched({});
    setFormError(null);
    setIsAddOpen(true);
  };

  const markTouched = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));

  const nameError = touched.name && !name.trim() ? 'Name is required' : null;
  const emailError = touched.email && !email.trim() ? 'Email is required' : null;
  const passwordError = touched.password && !editingUser && !password.trim() ? 'Password is required' : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: editingUser ? false : true });
    if (!name.trim() || !email.trim() || (!editingUser && !password.trim())) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PATCH' : 'POST';
      const body: any = { name: name.trim(), email: email.trim(), role };
      if (password.trim()) body.password = password.trim();
      // Send '' to clear the link when the role no longer supports one.
      if (DOCTOR_LINKED_ROLES.includes(role)) body.assignedDoctorId = assignedDoctorId;
      else if (editingUser?.assignedDoctorId) body.assignedDoctorId = '';

      const res = await apiFetch(url, {
        method,
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Failed to ${editingUser ? 'update' : 'create'} user`);

      setIsAddOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message || 'Error saving user');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Users className="w-4.5 h-4.5 text-brand" /> Staff User Management
          </h2>
          <p className="hidden sm:block text-xs text-ink-secondary mt-0.5">
            Manage clinic staff accounts and role assignments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {isAdmin && (
            <button
              onClick={() => openForm()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Add User</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : users.length === 0 ? (
        <div className="bg-surface-card rounded-[10px] border border-border p-8 text-center text-xs text-ink-secondary shadow-xs">
          No users found.
        </div>
      ) : (
        <div className="bg-surface-card rounded-[10px] border border-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-page border-b border-border text-ink-secondary font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Created</th>
                  {isAdmin && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-surface-page/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-ink-primary">{u.name}</td>
                    <td className="py-3 px-4 font-mono text-ink-secondary">{u.email}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-brand-soft text-brand-deep text-[11px] font-semibold">
                        <Shield className="w-3 h-3" />
                        {u.role}
                      </span>
                      {u.assignedDoctor && (
                        <span className="block text-[10px] text-ink-secondary mt-1">
                          → {u.assignedDoctor.name}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-ink-secondary">{u.createdAt?.split('T')[0]}</td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {['DOCTOR', 'MASTER'].includes(u.role) && (
                            <button
                              onClick={() => setScheduleDoctor({ id: u.id, name: u.name })}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-brand bg-brand-soft hover:bg-brand/20 border border-brand/20 rounded transition-colors cursor-pointer"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Schedule</span>
                            </button>
                          )}
                          <button
                            onClick={() => openForm(u)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-ink-secondary" />
                            <span>Edit</span>
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit User Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface-card rounded-[10px] border border-border p-6 max-w-md w-full space-y-4 shadow-xl mx-2 sm:mx-0 my-4 sm:my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-brand" />
                {editingUser ? 'Edit User' : 'Add New User'}
              </h3>
              <button onClick={() => setIsAddOpen(false)} className="p-1 rounded text-ink-secondary hover:bg-surface-page cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 rounded-md bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs">{formError}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Full Name <span className="text-status-danger">*</span>
                </label>
                <input
                  type="text" required value={name}
                  onBlur={() => markTouched('name')}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Dr. Ananya Sharma"
                  className={`${inputClass} ${nameError ? 'border-status-danger' : ''}`}
                />
                {nameError && <p className="text-[11px] text-status-danger mt-1">{nameError}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Email Address <span className="text-status-danger">*</span>
                </label>
                <input
                  type="email" required value={email}
                  onBlur={() => markTouched('email')}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@clinic.com"
                  className={`${inputClass} ${emailError ? 'border-status-danger' : ''}`}
                />
                {emailError && <p className="text-[11px] text-status-danger mt-1">{emailError}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  {editingUser ? 'New Password (leave blank to keep current)' : 'Password'} <span className="text-status-danger">*</span>
                </label>
                <input
                  type="password"
                  value={password}
                  onBlur={() => markTouched('password')}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={editingUser ? 'Leave blank to keep current' : 'Minimum 4 characters'}
                  className={`${inputClass} ${passwordError ? 'border-status-danger' : ''}`}
                />
                {passwordError && <p className="text-[11px] text-status-danger mt-1">{passwordError}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">Role</label>
                <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Staff carry out a doctor's orders, so they are attached to one. */}
              {showDoctorLink && (
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">Connected Doctor</label>
                  <select
                    value={assignedDoctorId}
                    onChange={(e) => setAssignedDoctorId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Not connected</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-ink-secondary/70 mt-1">
                    This {role.toLowerCase()} will see care orders raised by the connected doctor.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <button type="button" onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-ink-secondary hover:text-ink-primary cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="px-4 py-2 bg-brand text-white text-xs font-medium rounded-md shadow-xs hover:bg-brand-deep disabled:opacity-50 cursor-pointer">
                  {submitting ? 'Saving...' : editingUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {scheduleDoctor && (
        <DoctorScheduleModal
          isOpen={!!scheduleDoctor}
          onClose={() => setScheduleDoctor(null)}
          doctorId={scheduleDoctor.id}
          doctorName={scheduleDoctor.name}
        />
      )}
    </div>
  );
};
