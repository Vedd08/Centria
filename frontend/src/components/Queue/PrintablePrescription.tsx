import React from 'react';
import { X, Printer } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { useClinicProfile } from '../../hooks/useClinicProfile';
import { PrintPortal } from '../common/PrintPortal';

export interface PrescriptionData {
  queueId: string;
  tokenNumber: number;
  queueDate: string;
  careType?: string;
  patient: { name: string; phone: string; uhid: string; dob?: string; gender?: string };
  doctor?: { name: string };
  diagnosis?: string;
  patientNotes?: string;
  nextAppointmentDate?: string;
  medicines: {
    description: string;
    orderType: string;
    medicineId?: string;
    dosage?: string;
    route?: string;
    frequency?: string;
    instructions?: string;
    quantity: number;
  }[];
  procedures: { description: string; instructions?: string }[];
}

interface Props {
  prescription: PrescriptionData | null;
  onClose: () => void;
}

/**
 * The prescription the patient takes home. Staff notes are intentionally absent —
 * the backend never sends them on this endpoint.
 */
export const PrintablePrescription: React.FC<Props> = ({ prescription, onClose }) => {
  const clinic = useClinicProfile();
  if (!prescription) return null;
  const p = prescription;

  return (
    <PrintPortal>
      <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto print:static print:bg-white print:p-0 print:block print:overflow-visible print:backdrop-blur-none">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-2xl w-full my-8 print:my-0 print:shadow-none print:border-0 print:max-w-none print:rounded-none print:overflow-visible">
        <div className="flex items-center justify-between p-4 border-b border-border print:hidden">
          <span className="text-xs font-semibold text-ink-primary">
            Prescription — {p.patient.name} (Token #{p.tokenNumber})
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button onClick={onClose} className="p-1.5 rounded text-ink-secondary hover:text-ink-primary cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-8 print:p-6 text-ink-primary">
          <div className="flex items-start justify-between border-b-2 border-ink-primary pb-4 mb-5">
            <div>
              <h1 className="text-xl font-bold tracking-tight uppercase">{clinic?.name ?? ''}</h1>
              {clinic?.address && <p className="text-[11px] text-ink-secondary mt-0.5">{clinic.address}</p>}
              {(clinic?.phone || clinic?.email) && (
                <p className="text-[11px] text-ink-secondary">
                  {[clinic?.phone, clinic?.email].filter(Boolean).join('  ·  ')}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold tracking-wider">PRESCRIPTION</p>
              {p.doctor && <p className="text-xs mt-1 font-medium">{p.doctor.name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs mb-5">
            <div className="space-y-1">
              <div>
                <span className="text-ink-secondary">Patient: </span>
                <span className="font-semibold">{p.patient.name}</span>
              </div>
              <div>
                <span className="text-ink-secondary">Mobile: </span>
                <span className="font-mono">{p.patient.phone}</span>
              </div>
              {(p.patient.gender || p.patient.dob) && (
                <div>
                  <span className="text-ink-secondary">Gender / DOB: </span>
                  <span>
                    {p.patient.gender}
                    {p.patient.dob ? ` · ${p.patient.dob}` : ''}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-1 text-right">
              <div>
                <span className="text-ink-secondary">Date: </span>
                <span className="font-mono">{p.queueDate}</span>
              </div>
              <div>
                <span className="text-ink-secondary">UHID: </span>
                <span className="font-mono">{p.patient.uhid}</span>
              </div>
              {p.careType && (
                <div>
                  <span className="text-ink-secondary">Type: </span>
                  <span className="font-semibold">{p.careType}</span>
                </div>
              )}
            </div>
          </div>

          {p.diagnosis && (
            <div className="mb-5 text-xs">
              <span className="text-ink-secondary font-semibold">Diagnosis: </span>
              <span>{p.diagnosis}</span>
            </div>
          )}

          <div className="mb-5">
            <p className="text-2xl font-serif font-bold mb-2">℞</p>
            {p.medicines.length === 0 ? (
              <p className="text-xs text-ink-secondary italic">No medicines prescribed.</p>
            ) : (
              <ol className="space-y-2.5 text-xs">
                {p.medicines.map((m, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="text-ink-secondary font-mono shrink-0">{i + 1}.</span>
                    <div>
                      <p className="font-semibold">
                        {m.description}
                        {m.orderType === 'INJECTION' && (
                          <span className="ml-2 text-[10px] font-medium text-ink-secondary">(Injection)</span>
                        )}
                        {!m.medicineId && (
                          <span className="ml-2 text-[10px] font-medium text-status-danger">(buy outside)</span>
                        )}
                      </p>
                      <p className="text-ink-secondary mt-0.5">
                        {[m.dosage, m.frequency, m.route && `via ${m.route}`, `Qty ${m.quantity}`]
                          .filter(Boolean)
                          .join('  ·  ')}
                      </p>
                      {m.instructions && <p className="text-ink-secondary italic mt-0.5">{m.instructions}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {p.procedures.length > 0 && (
            <div className="mb-5 text-xs">
              <p className="font-semibold mb-1.5">Procedures / Services</p>
              <ul className="space-y-1">
                {p.procedures.map((pr, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-ink-secondary">•</span>
                    <span>
                      {pr.description}
                      {pr.instructions && <span className="text-ink-secondary italic"> — {pr.instructions}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p.patientNotes && (
            <div className="mb-5 text-xs p-3 border border-border rounded">
              <p className="font-semibold mb-1">Advice</p>
              <ul className="space-y-1">
                {p.patientNotes.split('\n').map(line => line.trim()).filter(Boolean).map((line, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-ink-secondary">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {p.nextAppointmentDate && (
            <p className="text-xs mb-6">
              <span className="font-semibold">Next appointment: </span>
              <span className="font-mono">{p.nextAppointmentDate}</span>
            </p>
          )}

          <div className="flex justify-end mt-10 pt-2">
            <div className="text-center">
              <div className="w-44 border-t border-ink-primary" />
              <p className="text-[10px] text-ink-secondary mt-1">
                {p.doctor?.name || 'Doctor'} — Signature
              </p>
            </div>
          </div>

          <div className="mt-8 pt-3 border-t border-border flex items-center justify-center gap-1.5 text-[10px] text-ink-secondary">
            Powered by <BrandLogo className="h-3" />
          </div>
        </div>
      </div>
      </div>
    </PrintPortal>
  );
};
