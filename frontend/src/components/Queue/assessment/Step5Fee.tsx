import React from 'react';

const inputClass = 'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

export interface Step5FeeProps {
  consultationFee: string;
  setConsultationFee: (f: string) => void;
  nextAppointmentDate: string;
  setNextAppointmentDate: (d: string) => void;
}

export const Step5Fee: React.FC<Step5FeeProps> = ({ consultationFee, setConsultationFee, nextAppointmentDate, setNextAppointmentDate }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div>
      <label className="block text-xs font-semibold text-ink-secondary mb-1">Consultation fee (₹)</label>
      <input
        type="number"
        min="0"
        step="0.01"
        value={consultationFee}
        onChange={(e) => setConsultationFee(e.target.value)}
        placeholder="0"
        className={inputClass}
      />
      <p className="text-[10px] text-ink-secondary/70 mt-1">Added to the patient's bill at reception.</p>
    </div>
    <div>
      <label className="block text-xs font-semibold text-ink-secondary mb-1">Next appointment</label>
      <input
        type="date"
        value={nextAppointmentDate}
        onChange={(e) => setNextAppointmentDate(e.target.value)}
        className={inputClass}
      />
    </div>
  </div>
);