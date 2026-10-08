import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { Building2, Plus, RefreshCw, X, Edit3, Shield, CheckCircle2, XCircle } from 'lucide-react';

interface ClinicItem {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
}

const inputClass = 'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

export const ClinicList: React.FC = () => {
  const { hasRole, apiFetch } = useAuth();
  const [clinics, setClinics] = useState<ClinicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<ClinicItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isActive, setIsActive] = useState(true);

  // For initial MASTER user
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');

  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const isSuperAdmin = hasRole('SUPER_ADMIN');

  // Removed authHeaders since apiFetch handles it

  const fetchClinics = async () => {
    if (!isSuperAdmin) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/clinics');
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load clinics');
      setClinics(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Could not load clinics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClinics(); }, []);

  const openForm = (clinic?: ClinicItem) => {
    if (clinic) {
      setEditingClinic(clinic);
      setName(clinic.name);
      setAddress(clinic.address || '');
      setPhone(clinic.phone || '');
      setEmail(clinic.email || '');
      setIsActive(clinic.isActive);
    } else {
      setEditingClinic(null);
      setName('');
      setAddress('');
      setPhone('');
      setEmail('');
      setIsActive(true);
      setAdminName('');
      setAdminEmail('');
      setAdminPassword('');
    }
    setTouched({});
    setFormError(null);
    setIsAddOpen(true);
  };

  const markTouched = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }));

  const nameError = touched.name && !name.trim() ? 'Name is required' : null;
  const adminNameError = !editingClinic && touched.adminName && !adminName.trim() ? 'Admin Name is required' : null;
  const adminEmailError = !editingClinic && touched.adminEmail && !adminEmail.trim() ? 'Admin Email is required' : null;
  const adminPasswordError = !editingClinic && touched.adminPassword && !adminPassword.trim() ? 'Admin Password is required' : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, adminName: true, adminEmail: true, adminPassword: true });
    
    if (!name.trim()) return;
    if (!editingClinic && (!adminName.trim() || !adminEmail.trim() || !adminPassword.trim())) return;

    setSubmitting(true);
    setFormError(null);

    try {
      const url = editingClinic ? `/api/clinics/${editingClinic.id}` : '/api/clinics';
      const method = editingClinic ? 'PATCH' : 'POST';
      const body: any = { name: name.trim(), address: address.trim(), phone: phone.trim(), email: email.trim(), isActive };

      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Failed to ${editingClinic ? 'update' : 'create'} clinic`);

      // If creating, also create the MASTER user
      if (!editingClinic) {
        const userRes = await apiFetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: adminName.trim(),
            email: adminEmail.trim(),
            password: adminPassword.trim(),
            role: 'MASTER',
            clinicId: data.id,
          }),
        });
        const userData = await userRes.json();
        if (!userRes.ok) {
          // It's a partial failure (clinic created, user failed)
          throw new Error(`Clinic created, but failed to create Admin User: ${userData.message}`);
        }
      }

      setIsAddOpen(false);
      setEditingClinic(null);
      fetchClinics();
    } catch (err: any) {
      setFormError(err.message || 'Error saving clinic');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="bg-surface-card rounded-[10px] border border-border p-8 text-center space-y-2 shadow-xs">
        <h2 className="text-base font-semibold text-ink-primary">Access restricted</h2>
        <p className="text-xs text-ink-secondary max-w-md mx-auto">
          Only SUPER_ADMINs can manage multiple clinics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Building2 className="w-4.5 h-4.5 text-brand" /> Multi-Tenant Clinic Management
          </h2>
          <p className="hidden sm:block text-xs text-ink-secondary mt-0.5">
            Provision and configure isolation boundaries for new clinic instances.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchClinics}
            disabled={loading}
            className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => openForm()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Provision Clinic</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs">
          {error}
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : clinics.length === 0 ? (
        <div className="bg-surface-card rounded-[10px] border border-border p-8 text-center text-xs text-ink-secondary shadow-xs">
          No clinics found.
        </div>
      ) : (
        <div className="bg-surface-card rounded-[10px] border border-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-page border-b border-border text-ink-secondary font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Clinic Name</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {clinics.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-page/60 transition-colors">
                    <td className="py-3 px-4 font-medium text-ink-primary">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-brand" />
                        {c.name}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-ink-secondary">{c.address || '-'}</td>
                    <td className="py-3 px-4 text-ink-secondary">
                      {c.phone || c.email ? (
                        <div className="flex flex-col">
                          {c.phone && <span>{c.phone}</span>}
                          {c.email && <span className="text-[10px]">{c.email}</span>}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {c.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-status-success bg-status-success/10 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-status-danger bg-status-danger/10 px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => openForm(c)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-ink-secondary" />
                        <span>Configure</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Clinic Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-surface-card rounded-[10px] border border-border p-6 max-w-md w-full space-y-4 shadow-xl mx-2 sm:mx-0 my-4 sm:my-8">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand" />
                {editingClinic ? 'Configure Clinic Tenant' : 'Provision New Clinic Tenant'}
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
                  Clinic Name <span className="text-status-danger">*</span>
                </label>
                <input
                  type="text" required value={name}
                  onBlur={() => markTouched('name')}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Apollo Jubilee Hills"
                  className={`${inputClass} ${nameError ? 'border-status-danger' : ''}`}
                />
                {nameError && <p className="text-[11px] text-status-danger mt-1">{nameError}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">
                  Address
                </label>
                <input
                  type="text" value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, City, Code"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">Phone</label>
                  <input
                    type="text" value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Contact Number"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-secondary mb-1">Email</label>
                  <input
                    type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="clinic@example.com"
                    className={inputClass}
                  />
                </div>
              </div>

              {!editingClinic && (
                <>
                  <div className="pt-4 border-t border-border mt-2">
                    <h4 className="text-xs font-semibold text-ink-primary mb-3">Initial Administrator (MASTER)</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-ink-secondary mb-1">
                          Admin Name <span className="text-status-danger">*</span>
                        </label>
                        <input
                          type="text" required value={adminName}
                          onBlur={() => markTouched('adminName')}
                          onChange={(e) => setAdminName(e.target.value)}
                          placeholder="Dr. Admin"
                          className={`${inputClass} ${adminNameError ? 'border-status-danger' : ''}`}
                        />
                        {adminNameError && <p className="text-[11px] text-status-danger mt-1">{adminNameError}</p>}
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-ink-secondary mb-1">
                            Admin Email <span className="text-status-danger">*</span>
                          </label>
                          <input
                            type="email" required value={adminEmail}
                            onBlur={() => markTouched('adminEmail')}
                            onChange={(e) => setAdminEmail(e.target.value)}
                            placeholder="admin@clinic.com"
                            className={`${inputClass} ${adminEmailError ? 'border-status-danger' : ''}`}
                          />
                          {adminEmailError && <p className="text-[11px] text-status-danger mt-1">{adminEmailError}</p>}
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-ink-secondary mb-1">
                            Admin Password <span className="text-status-danger">*</span>
                          </label>
                          <input
                            type="password" required value={adminPassword}
                            onBlur={() => markTouched('adminPassword')}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            placeholder="Min 4 characters"
                            className={`${inputClass} ${adminPasswordError ? 'border-status-danger' : ''}`}
                          />
                          {adminPasswordError && <p className="text-[11px] text-status-danger mt-1">{adminPasswordError}</p>}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {editingClinic && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-border">
                  <input 
                    type="checkbox" 
                    id="isActive" 
                    checked={isActive} 
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-brand rounded border-border focus:ring-brand"
                  />
                  <label htmlFor="isActive" className="text-xs font-medium text-ink-primary cursor-pointer">
                    Clinic is Active
                  </label>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-4">
                <button type="button" onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-ink-secondary hover:text-ink-primary cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={submitting}
                  className="px-4 py-2 bg-brand text-white text-xs font-medium rounded-md shadow-xs hover:bg-brand-deep disabled:opacity-50 cursor-pointer">
                  {submitting ? 'Saving...' : editingClinic ? 'Update Configuration' : 'Provision Instance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
