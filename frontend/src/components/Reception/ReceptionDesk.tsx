import React, { useState } from 'react';
import { QueueBoard } from '../Queue/QueueBoard';
import { AppointmentsPanel } from './AppointmentsPanel';
import { PaymentsPanel } from './PaymentsPanel';
import { PatientRegistrationModal } from '../Patients/PatientRegistrationModal';
import { AdmitPatientModal } from '../IPD/AdmitPatientModal';
import { useToast } from '../../context/ToastContext';
import { ClipboardList, CalendarClock, Receipt, UserPlus, BedDouble } from 'lucide-react';

type Tab = 'queue' | 'appointments' | 'payments';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'queue', label: "Today's Queue", icon: ClipboardList },
  { key: 'appointments', label: 'Appointments', icon: CalendarClock },
  { key: 'payments', label: 'Payments', icon: Receipt },
];

/** The front desk console: check patients in, book appointments, take payments. */
export const ReceptionDesk: React.FC = () => {
  const [tab, setTab] = useState<Tab>('queue');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isAdmitOpen, setIsAdmitOpen] = useState(false);
  const [queueKey, setQueueKey] = useState(0);
  const { addToast } = useToast();

  return (
    <div className="space-y-5 font-sans text-ink-primary">
      <div className="bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-primary tracking-tight">Reception Desk</h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Register and check in patients, manage appointments and follow-ups, and collect payments.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsAdmitOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-ink-primary bg-surface-card hover:bg-surface-page border border-border rounded-md shadow-xs transition-colors cursor-pointer"
          >
            <BedDouble className="w-4 h-4" />
            <span>Admit to Ward</span>
          </button>
          <button
            onClick={() => setIsRegisterOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Register Patient</span>
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-surface-card px-2 rounded-[10px] border border-border shadow-xs overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-1.5 px-4 py-3 text-xs font-medium border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
                tab === t.key ? 'border-brand text-brand-deep' : 'border-transparent text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Reuses the shared queue board so reception and the clinical side always
          look at exactly the same list. Remounted via `queueKey` after a
          register-and-check-in so the new token shows up immediately. */}
      {tab === 'queue' && <QueueBoard key={queueKey} />}

      {tab === 'appointments' && (
        <div className="bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
          <AppointmentsPanel />
        </div>
      )}

      {tab === 'payments' && (
        <div className="bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
          <PaymentsPanel />
        </div>
      )}

      <PatientRegistrationModal
        isOpen={isRegisterOpen}
        onClose={() => setIsRegisterOpen(false)}
        onPatientCreated={(result) => {
          if (result?.checkedIn) {
            // The modal already toasted the token — just surface the fresh queue.
            setQueueKey((k) => k + 1);
            setTab('queue');
          } else {
            addToast('success', 'Patient registered');
          }
        }}
      />

      <AdmitPatientModal
        isOpen={isAdmitOpen}
        onClose={() => setIsAdmitOpen(false)}
        onAdmitted={() => {}}
      />
    </div>
  );
};
