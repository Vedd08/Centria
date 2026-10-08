import React from 'react';
import { X, Printer } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { useClinicProfile } from '../../hooks/useClinicProfile';
import { PrintPortal } from '../common/PrintPortal';

export interface PrescriptionMedicineItem {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string;
}

export interface PrintablePrescriptionData {
  id: string;
  patientName: string;
  patientUhid: string;
  patientAgeGender?: string;
  doctorName: string;
  date: string;
  diagnosis?: string;
  notes?: string;
  items: PrescriptionMedicineItem[];
}

interface PrintablePrescriptionModalProps {
  prescription: PrintablePrescriptionData | null;
  onClose: () => void;
}

export const PrintablePrescriptionModal: React.FC<PrintablePrescriptionModalProps> = ({
  prescription,
  onClose,
}) => {
  const clinic = useClinicProfile();
  if (!prescription) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <PrintPortal>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 overflow-y-auto font-sans print:static print:bg-white print:p-0 print:block print:overflow-visible print:backdrop-blur-none">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full overflow-hidden flex flex-col max-h-[90vh] mx-2 sm:mx-0 my-4 sm:my-8 print:rounded-none print:shadow-none print:max-w-none print:max-h-none print:overflow-visible print:m-0">
        {/* Modal Action Header (Hidden when printing) */}
        <div className="p-4 bg-shell text-white flex items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo tone="onDark" className="h-5 shrink-0" />
            <span className="hidden sm:block h-4 w-px bg-shell-line" />
            <h3 className="hidden sm:block font-semibold text-sm truncate">Official Medical Prescription</h3>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-lift hover:bg-brand text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Prescription</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-shell-muted hover:text-white hover:bg-shell-raised transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Prescription Body */}
        <div className="p-8 space-y-6 overflow-y-auto print:p-0 print:overflow-visible text-slate-800">
          {/* Clinic Letterhead */}
          <div className="border-b-2 border-brand pb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{clinic?.name ?? ''}</h1>
              {clinic?.address && <p className="text-xs font-medium text-brand">{clinic.address}</p>}
              {(clinic?.phone || clinic?.email) && (
                <p className="text-[11px] text-slate-500 mt-1">
                  {[clinic?.phone && `Contact: ${clinic.phone}`, clinic?.email].filter(Boolean).join('  •  ')}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-slate-900">Dr. {prescription.doctorName}</div>
              <div className="text-xs text-slate-500">Consultant Aesthetic Dermatologist</div>
              <div className="text-[11px] font-mono text-brand font-medium">Reg. # KMC-87421</div>
            </div>
          </div>

          {/* Patient Info Header */}
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Patient Name</span>
              <span className="font-bold text-slate-900 text-sm">{prescription.patientName}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">UHID</span>
              <span className="font-mono font-bold text-brand">{prescription.patientUhid}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Date</span>
              <span className="font-mono text-slate-800">{prescription.date}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Age / Gender</span>
              <span className="text-slate-800">{prescription.patientAgeGender || '30 Y / Female'}</span>
            </div>
          </div>

          {/* Diagnosis Section */}
          {prescription.diagnosis && (
            <div className="text-xs space-y-1">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block">
                Clinical Diagnosis / Clinical Notes:
              </span>
              <div className="p-2.5 rounded bg-brand-soft/50 border border-brand/15 text-slate-800 italic">
                {prescription.diagnosis}
              </div>
            </div>
          )}

          {/* Rx Icon & Medicines Table */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-serif font-bold text-brand-deep italic">Rx</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Prescribed Medications
              </span>
            </div>

            <table className="w-full text-left text-xs border-collapse border border-slate-200">
              <thead className="bg-slate-100 text-slate-700 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5 border border-slate-200">#</th>
                  <th className="p-2.5 border border-slate-200">Medicine Name</th>
                  <th className="p-2.5 border border-slate-200">Dosage</th>
                  <th className="p-2.5 border border-slate-200">Frequency</th>
                  <th className="p-2.5 border border-slate-200">Duration</th>
                  <th className="p-2.5 border border-slate-200">Instructions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                {prescription.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="p-2.5 border border-slate-200 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="p-2.5 border border-slate-200 font-bold text-slate-900">{item.name}</td>
                    <td className="p-2.5 border border-slate-200 font-mono text-slate-700">{item.dosage}</td>
                    <td className="p-2.5 border border-slate-200 font-mono text-brand font-bold">{item.frequency}</td>
                    <td className="p-2.5 border border-slate-200 font-mono text-slate-700">{item.duration}</td>
                    <td className="p-2.5 border border-slate-200 text-slate-600">{item.instructions || 'After meals'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Advice / Special Instructions */}
          {prescription.notes && (
            <div className="text-xs space-y-1 pt-2">
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block">
                Doctor's Special Advice / Pre-care Instructions:
              </span>
              <p className="text-slate-700 bg-amber-50/60 p-3 rounded border border-amber-200/60 text-xs">
                {prescription.notes}
              </p>
            </div>
          )}

          {/* Signature Block & Footer */}
          <div className="pt-12 flex items-end justify-between text-xs">
            <div className="text-slate-400 text-[10px] space-y-1">
              <div className="flex items-center gap-1.5">
                Generated electronically via <BrandLogo className="h-3" />
              </div>
              <div>Valid with official clinic stamp</div>
            </div>
            <div className="text-center w-48 border-t border-slate-400 pt-2 space-y-1">
              <div className="font-bold text-slate-900">Dr. {prescription.doctorName}</div>
              <div className="text-[10px] text-slate-500">Authorized Doctor Signature</div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </PrintPortal>
  );
};
