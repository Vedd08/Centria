import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { X, User, Lock, Eye, EyeOff } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { user, token, login, logout , apiFetch } = useAuth();
  const { addToast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [showPwdForm, setShowPwdForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOpen || !user) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch('/api/auth/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      // Re-fetch the updated user from /api/auth/me to sync localStorage
      const meRes = await apiFetch('/api/auth/me', {
        });
      if (meRes.ok) {
        const updatedUser = await meRes.json();
        // Use the stored token to re-login with updated data
        login(token as string, updatedUser);
      }
      addToast('success', 'Profile updated successfully');
      onClose();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch('/api/auth/password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to change password');
      }
      addToast('success', 'Password changed successfully');
      setShowPwdForm(false);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      addToast('error', err.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-md w-full p-6 space-y-5 mx-2 sm:mx-0 my-4 sm:my-8">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h3 className="text-base font-bold text-ink-primary flex items-center gap-2">
            <User className="w-4 h-4 text-brand" /> My Profile
          </h3>
          <button onClick={onClose} className="p-1 rounded text-ink-secondary hover:bg-surface-page cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 pb-3 border-b border-border/60">
          <div className="w-12 h-12 rounded-full bg-brand-soft text-brand-deep flex items-center justify-center font-bold text-base border border-brand/20">
            {user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          <div>
            <div className="text-sm font-semibold text-ink-primary">{user.name}</div>
            <div className="text-xs text-ink-secondary">{user.role} &bull; {user.email}</div>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-secondary mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full px-4 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Update Profile'}
          </button>
        </form>

        <div className="pt-2 border-t border-border/60">
          <button
            onClick={() => setShowPwdForm(!showPwdForm)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-deep cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            {showPwdForm ? 'Cancel Password Change' : 'Change Password'}
          </button>

          {showPwdForm && (
            <form onSubmit={handleChangePassword} className="mt-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand pr-8"
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-2 top-2 text-ink-secondary hover:text-ink-primary cursor-pointer">
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={4}
                  className="w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
              <button
                type="submit"
                disabled={saving || !currentPassword || !newPassword}
                className="w-full px-4 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
