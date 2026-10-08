import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { X, UserPlus, AlertCircle, Phone, Mail, User, Calendar, MapPin, Stethoscope, Sparkles, Check, Edit3, ClipboardList } from 'lucide-react';
import { Patient } from './PatientList';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** `checkedIn` is true when the "check in immediately" option was used and succeeded. */
  onPatientCreated: (result?: { checkedIn?: boolean }) => void;
  /** If provided, modal opens in edit mode instead of create mode */
  editPatient?: Patient | null;
  /** Hide the "check in immediately" option — used when the caller already has its own check-in step. */
  showCheckInOption?: boolean;
}

const inputClass = (fieldError: string | null) =>
  `w-full pl-9 pr-3 py-2 rounded-md border text-xs focus:ring-1 focus:ring-brand focus:border-brand bg-surface-card text-ink-primary transition-colors ${
    fieldError
      ? 'border-status-danger focus:border-status-danger focus:ring-status-danger/30'
      : 'border-border'
  }`;

export const PatientRegistrationModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onPatientCreated,
  editPatient,
  showCheckInOption = true,
}) => {
  const { token , apiFetch } = useAuth();
  const { addToast } = useToast();
  const isEdit = !!editPatient;

  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('Female');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [allergyNotes, setAllergyNotes] = useState('');
  const [referringDoctor, setReferringDoctor] = useState('');
  const [howHeardAboutUs, setHowHeardAboutUs] = useState('Instagram');
  const [checkInAfter, setCheckInAfter] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (editPatient) {
      setName(editPatient.name || '');
      setDob(editPatient.dob || '');
      setGender(editPatient.gender || 'Female');
      setPhone(editPatient.phone || '');
      setEmail(editPatient.email || '');
      setAddress(editPatient.address || '');
      setAllergyNotes(editPatient.allergyNotes || '');
      setReferringDoctor(editPatient.referringDoctor || '');
      setHowHeardAboutUs(editPatient.howHeardAboutUs || 'Instagram');
    } else {
      setName('');
      setDob('');
      setGender('Female');
      setPhone('');
      setEmail('');
      setAddress('');
      setAllergyNotes('');
      setReferringDoctor('');
      setHowHeardAboutUs('Instagram');
    }
    setCheckInAfter(false);
    setTouched({});
    setDirty(false);
    setError(null);
  }, [editPatient, isOpen]);

  const markDirty = (setter: React.Dispatch<React.SetStateAction<string>>, _value: string) => {
    setter(_value);
    setDirty(true);
  };

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  if (!isOpen) return null;

  const isValidEmail = (value: string) => !value.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const nameError = touched.name && !name.trim() ? 'Patient name is required' : null;
  const phoneError = touched.phone && !phone.trim() ? 'Phone number is required' : null;
  const emailError = touched.email && !isValidEmail(email) ? 'Enter a valid email address' : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched((prev) => ({ ...prev, name: true, phone: true, email: true }));
    if (!name.trim() || !phone.trim() || !isValidEmail(email)) return;

    setLoading(true);
    setError(null);

    try {
      const url = isEdit ? `/api/patients/${editPatient!.id}` : '/api/patients';
      const method = isEdit ? 'PUT' : 'POST';

      const res = await apiFetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          },
        body: JSON.stringify({
          name: name.trim(),
          dob: dob || undefined,
          gender,
          phone: phone.trim(),
          email: email.trim() || undefined,
          address: address || undefined,
          allergyNotes: allergyNotes || undefined,
          referringDoctor: referringDoctor || undefined,
          howHeardAboutUs: howHeardAboutUs || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Failed to ${isEdit ? 'update' : 'register'} patient`);
      }

      let checkedIn = false;
      if (!isEdit && checkInAfter) {
        try {
          const queueRes = await apiFetch('/api/queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patientId: data.id }),
          });
          const queueData = await queueRes.json();
          if (queueRes.ok) {
            checkedIn = true;
            addToast('success', `Patient registered and checked in — token ${queueData.tokenNumber}`);
          } else {
            addToast('error', queueData.message || 'Patient registered, but check-in failed — check them in manually.');
          }
        } catch {
          addToast('error', 'Patient registered, but check-in failed — check them in manually.');
        }
      }

      onPatientCreated({ checkedIn });
      onClose();
    } catch (err: any) {
      setError(err.message || `Error ${isEdit ? 'updating' : 'creating'} patient`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (dirty) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to close?')) return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-2xl w-full mx-2 sm:mx-0 my-4 sm:my-8 overflow-hidden">
        
        {/* Header */}
        <div className="bg-brand px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/10">
              {isEdit ? <Edit3 className="w-5 h-5 text-brand-soft" /> : <UserPlus className="w-5 h-5 text-brand-soft" />}
            </div>
            <div>
              <h2 className="text-lg font-bold">{isEdit ? 'Edit Patient Record' : 'New Patient Intake Registration'}</h2>
              <p className="text-xs text-white/80">
                {isEdit ? `Updating ${editPatient?.uhid || editPatient?.name}` : 'Auto-assigns unique UHID for aesthetic clinic tracking'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-md text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {error && (
            <div className="p-3.5 rounded-md bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!isEdit && (
            <div className="bg-brand-soft border border-brand/20 rounded-xl p-3.5 flex items-center justify-between text-xs text-ink-primary">
              <span className="flex items-center gap-1.5 font-medium">
                <Sparkles className="w-4 h-4 text-brand" /> Automatic UHID Generation
              </span>
              <span className="font-mono font-semibold bg-surface-card border border-brand/20 px-2.5 py-1 rounded text-brand">
                UHID-2026-XXXX
              </span>
            </div>
          )}

          {isEdit && editPatient && (
            <div className="bg-brand-soft border border-brand/20 rounded-xl p-3.5 flex items-center justify-between text-xs text-ink-primary">
              <span className="flex items-center gap-1.5 font-medium">
                <User className="w-4 h-4 text-brand" /> Editing Patient Record
              </span>
              <span className="font-mono font-semibold bg-surface-card border border-brand/20 px-2.5 py-1 rounded text-brand">
                {editPatient.uhid}
              </span>
            </div>
          )}

          {/* Section: Patient Details */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-brand flex items-center gap-1.5 pb-1.5 border-b border-border">
              <User className="w-3.5 h-3.5" /> Patient Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Patient Name */}
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Full Name <span className="text-status-danger">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-ink-secondary/60 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={name}
                    onBlur={() => markTouched('name')}
                    onChange={(e) => markDirty(setName, e.target.value)}
                    placeholder="e.g. Kavita Sharma"
                    className={inputClass(nameError)}
                  />
                </div>
                {nameError && <p className="text-[11px] text-status-danger mt-1">{nameError}</p>}
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Date of Birth
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-ink-secondary/60 absolute left-3 top-2.5" />
                  <input
                    type="date"
                    value={dob}
                    onChange={(e) => { setDob(e.target.value); if (e.target.value) setDirty(true); }}
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand focus:border-brand bg-surface-card"
                  />
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Gender <span className="text-status-danger">*</span>
                </label>
                <select
                  value={gender}
                  onChange={(e) => { setGender(e.target.value); setDirty(true); }}
                  className="w-full px-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand focus:border-brand bg-surface-card text-ink-primary"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>

            </div>
          </div>

          {/* Section: Contact Details */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-brand flex items-center gap-1.5 pb-1.5 border-b border-border">
              <Phone className="w-3.5 h-3.5" /> Contact Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Phone Number <span className="text-status-danger">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-ink-secondary/60 absolute left-3 top-2.5" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onBlur={() => markTouched('phone')}
                    onChange={(e) => markDirty(setPhone, e.target.value)}
                    placeholder="10-digit mobile number"
                    className={inputClass(phoneError)}
                  />
                </div>
                {phoneError && <p className="text-[11px] text-status-danger mt-1">{phoneError}</p>}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-ink-secondary/60 absolute left-3 top-2.5" />
                  <input
                    type="email"
                    value={email}
                    onBlur={() => markTouched('email')}
                    onChange={(e) => markDirty(setEmail, e.target.value)}
                    placeholder="e.g. kavita@example.com"
                    className={inputClass(emailError)}
                  />
                </div>
                {emailError && <p className="text-[11px] text-status-danger mt-1">{emailError}</p>}
              </div>

              {/* Address */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Residential Address
                </label>
                <div className="relative">
                  <MapPin className="w-4 h-4 text-ink-secondary/60 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => markDirty(setAddress, e.target.value)}
                    placeholder="Street address, city, area"
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand focus:border-brand bg-surface-card"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Section: Additional Details */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-brand flex items-center gap-1.5 pb-1.5 border-b border-border">
              <Stethoscope className="w-3.5 h-3.5" /> Additional Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Referring Doctor (Free Text) */}
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  Referring Doctor (Free Text)
                </label>
                <div className="relative">
                  <Stethoscope className="w-4 h-4 text-ink-secondary/60 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={referringDoctor}
                    onChange={(e) => markDirty(setReferringDoctor, e.target.value)}
                    placeholder="e.g. Dr. Mehta / Self Walk-in"
                    className="w-full pl-9 pr-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand focus:border-brand bg-surface-card"
                  />
                </div>
              </div>

              {/* Referral Source */}
              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">
                  How did you hear about us?
                </label>
                <select
                  value={howHeardAboutUs}
                  onChange={(e) => { setHowHeardAboutUs(e.target.value); setDirty(true); }}
                  className="w-full px-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand focus:border-brand bg-surface-card text-ink-primary"
                >
                  <option value="Instagram">Instagram / Social Media</option>
                  <option value="Google Search">Google Search</option>
                  <option value="Friend Recommendation">Friend / Word of Mouth</option>
                  <option value="Doctor Referral">Doctor Referral</option>
                  <option value="Walk-in">Walk-in Banner</option>
                  <option value="Other">Other Channel</option>
                </select>
              </div>

            </div>
          </div>

          {/* Allergy Notes (Highlighted Box) */}
          <div className="bg-status-warning/10 border border-status-warning/20 rounded-xl p-3.5 space-y-1.5">
            <label className="block text-xs font-semibold text-status-warning flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Allergy & Sensitivity Notes
            </label>
            <textarea
              rows={2}
              value={allergyNotes}
              onChange={(e) => markDirty(setAllergyNotes, e.target.value)}
              placeholder="e.g. Lidocaine topical allergy, sensitive to chemical peels, asthma..."
              className="w-full px-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand focus:border-brand bg-surface-card text-ink-primary placeholder:text-ink-secondary/60"
            />
          </div>

          {/* Check In Immediately */}
          {!isEdit && showCheckInOption && (
            <label className="flex items-center gap-2.5 p-3.5 rounded-xl border border-brand/20 bg-brand-soft cursor-pointer select-none">
              <input
                type="checkbox"
                checked={checkInAfter}
                onChange={(e) => setCheckInAfter(e.target.checked)}
                className="w-4 h-4 rounded border-border text-brand focus:ring-brand cursor-pointer shrink-0"
              />
              <span className="text-xs text-ink-primary flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-brand shrink-0" />
                <span>
                  <span className="font-semibold">Check in immediately</span> — adds this patient straight to today's queue after saving.
                </span>
              </span>
            </label>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-page rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>{isEdit ? 'Updating...' : checkInAfter ? 'Registering & checking in...' : 'Registering...'}</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isEdit ? 'Save Changes' : checkInAfter ? 'Register & Check In' : 'Save & Generate UHID'}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
