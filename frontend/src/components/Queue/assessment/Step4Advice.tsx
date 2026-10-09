import React from 'react';
import { BulletListEditor } from '../../common/BulletListEditor';

export interface Step4AdviceProps {
  patientNotes: string;
  setPatientNotes: (n: string) => void;
  staffNotes: string;
  setStaffNotes: (n: string) => void;
}

export const Step4Advice: React.FC<Step4AdviceProps> = ({ patientNotes, setPatientNotes, staffNotes, setStaffNotes }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <div>
      <label className="block text-xs font-semibold text-ink-secondary mb-1">
        Advice for patient <span className="text-[10px] font-normal text-ink-secondary/70">(printed on prescription)</span>
      </label>
      <BulletListEditor
        value={patientNotes}
        onChange={setPatientNotes}
        placeholder="Avoid sun for 48 hours..."
        containerClass="w-full p-2 rounded-md border border-surface text-sm bg-surface-hover text-ink shadow-sm transition-shadow hover:shadow-md flex flex-col gap-2"
        buttonClass="self-start text-[11px] font-bold text-ink-secondary hover:text-ink bg-surface-hover hover:bg-surface-active px-2 py-1 rounded transition-colors mt-1 cursor-pointer"
      />
    </div>
    <div>
      <label className="block text-xs font-semibold text-ink-secondary mb-1">
        Notes for nurse / staff <span className="text-[10px] font-normal text-status-warning">(internal — never printed)</span>
      </label>
      <BulletListEditor
        value={staffNotes}
        onChange={setStaffNotes}
        placeholder="Patch test before first sitting..."
        containerClass="w-full p-2 rounded-md border border-surface text-sm bg-surface-hover text-ink shadow-sm transition-shadow hover:shadow-md flex flex-col gap-2"
        buttonClass="self-start text-[11px] font-bold text-status-warning hover:text-status-warning bg-status-warning-bg px-2 py-1 rounded transition-colors mt-1 cursor-pointer"
      />
    </div>
  </div>
);