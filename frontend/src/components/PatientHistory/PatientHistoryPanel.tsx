import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { StatusBadge } from '../common/StatusBadge';
import { DocumentsTab } from './DocumentsTab';
import { AlertTriangle, Clock, Pill, BedDouble, FileText, User, Stethoscope, Wallet, Activity, ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';
import { money } from '../../utils/money';

export interface HistoryPatient {
  id: string;
  uhid: string;
  name: string;
  phone: string;
  email?: string;
  dob?: string;
  gender: string;
  address?: string;
  allergyNotes?: string;
  referringDoctor?: string;
  howHeardAboutUs?: string;
  visits?: { conditionTrend?: string }[];
  _count?: { visits: number };
}

interface VisitSummary {
  id: string;
  date: string;
  visitType: string;
  treatmentName: string;
  diagnosis?: string;
  status: string;
  cashAmount: number;
  bankAmount: number;
  doctor?: { name: string };
}

interface LifetimeValue {
  lifetimeValue: number;
  opdValue: number;
  ipdValue: number;
  packageValue: number;
  opdVisits: number;
  ipdVisits: number;
  packages: number;
}


interface PrescriptionSummary {
  id: string;
  notes?: string;
  status: string;
  createdAt: string;
  doctor?: { name: string };
  items: { medicine: { name: string }; dosage: string; frequency: string; duration: string }[];
}

interface AdmissionSummary {
  id: string;
  admissionDate: string;
  dischargeDate?: string;
  status: string;
  reasonForAdmission: string;
  doctor?: { name: string };
  bed?: { bedNumber: string; ward?: { name: string } };
}

type TabKey = 'overview' | 'opd' | 'ipd' | 'progress' | 'prescriptions' | 'documents' | 'admissions';

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: User },
  { key: 'opd', label: 'OPD History', icon: Stethoscope },
  { key: 'ipd', label: 'IPD History', icon: Clock },
  { key: 'progress', label: 'Progress', icon: Activity },
  { key: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { key: 'documents', label: 'Documents & Images', icon: FileText },
  { key: 'admissions', label: 'Ward Admissions', icon: BedDouble },
];

interface PatientHistoryPanelProps {
  patient: HistoryPatient;
  defaultTab?: TabKey;
  /** When opened from an admission's chart, new document uploads auto-link to it. */
  admissionId?: string;
}

export const PatientHistoryPanel: React.FC<PatientHistoryPanelProps> = ({ patient, defaultTab, admissionId }) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab || 'overview');
  const [loadedTabs, setLoadedTabs] = useState<Set<TabKey>>(new Set());

  const [opdVisits, setOpdVisits] = useState<VisitSummary[]>([]);
  const [ipdVisits, setIpdVisits] = useState<VisitSummary[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [prescriptions, setPrescriptions] = useState<PrescriptionSummary[]>([]);
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(false);
  const [admissions, setAdmissions] = useState<AdmissionSummary[]>([]);
  const [admissionsLoading, setAdmissionsLoading] = useState(false);
  const [progressTimeline, setProgressTimeline] = useState<any[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);
  const [ltv, setLtv] = useState<LifetimeValue | null>(null);

  // Lifetime value mirrors the clinic's spreadsheet headline figure, so it loads
  // immediately rather than waiting for a tab to be opened.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch(`/api/patients/${patient.id}/lifetime-value`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setLtv(data);
      } catch {
        // Non-fatal — the header just omits the figure.
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient.id]);

  useEffect(() => {
    if (loadedTabs.has(activeTab)) return;

    const load = async () => {
      try {
        if (activeTab === 'opd' || activeTab === 'ipd') {
          const type = activeTab.toUpperCase();
          setVisitsLoading(true);
          const res = await apiFetch(`/api/visits?patientId=${patient.id}&visitType=${type}&pageSize=100`);
          const result = await res.json();
          const items = Array.isArray(result) ? result : result.data || [];
          if (type === 'OPD') setOpdVisits(items);
          else setIpdVisits(items);
        } else if (activeTab === 'prescriptions') {
          setPrescriptionsLoading(true);
          const res = await apiFetch(`/api/prescriptions?patientId=${patient.id}`);
          const result = await res.json();
          setPrescriptions(Array.isArray(result) ? result : result.data || []);
        } else if (activeTab === 'admissions') {
          setAdmissionsLoading(true);
          const res = await apiFetch(`/api/admissions?patientId=${patient.id}`);
          const result = await res.json();
          setAdmissions(Array.isArray(result) ? result : result.data || []);
        } else if (activeTab === 'progress') {
          setProgressLoading(true);
          const res = await apiFetch(`/api/patients/${patient.id}/progress`);
          setProgressTimeline(await res.json());
        }
        setLoadedTabs((prev) => new Set(prev).add(activeTab));
      } catch (err: any) {
        addToast('error', err.message || `Failed to load ${activeTab}`);
      } finally {
        setVisitsLoading(false);
        setPrescriptionsLoading(false);
        setAdmissionsLoading(false);
        setProgressLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, patient.id]);

  return (
    <div className="space-y-4">
      {ltv && (
        <div className="bg-brand-soft/60 border border-brand/20 rounded-lg p-3.5 flex flex-wrap items-center gap-x-6 gap-y-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand/15 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-brand-deep" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Life Time Value</p>
              <p className="text-base font-semibold text-brand-deep leading-tight">{money(ltv.lifetimeValue)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-ink-secondary">
            <span>
              OPD <span className="font-semibold text-ink-primary">{money(ltv.opdValue)}</span> ({ltv.opdVisits} visits)
            </span>
            <span>
              IPD <span className="font-semibold text-ink-primary">{money(ltv.ipdValue)}</span> ({ltv.ipdVisits} visits)
            </span>
            <span>
              Packages <span className="font-semibold text-ink-primary">{money(ltv.packageValue)}</span> ({ltv.packages})
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap cursor-pointer transition-colors ${
                activeTab === tab.key
                  ? 'border-brand text-brand-deep'
                  : 'border-transparent text-ink-secondary hover:text-ink-primary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4 text-xs text-ink-primary">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-surface-page p-3.5 rounded-lg border border-border">
            <div>
              <span className="text-ink-secondary font-medium block">Phone Number</span>
              <span className="font-mono text-ink-primary">{patient.phone}</span>
            </div>
            <div>
              <span className="text-ink-secondary font-medium block">Gender & DOB</span>
              <span className="font-mono text-ink-primary">
                {patient.gender} {patient.dob ? `(${patient.dob})` : ''}
              </span>
            </div>
            <div>
              <span className="text-ink-secondary font-medium block">Referring Doctor</span>
              <span className="text-ink-primary">{patient.referringDoctor || 'Self Walk-in'}</span>
            </div>
            <div>
              <span className="text-ink-secondary font-medium block">Referral Channel</span>
              <span className="text-ink-primary">{patient.howHeardAboutUs || 'N/A'}</span>
            </div>
            {patient.email && (
              <div>
                <span className="text-ink-secondary font-medium block">Email</span>
                <span className="text-ink-primary break-all">{patient.email}</span>
              </div>
            )}
            <div>
              <span className="text-ink-secondary font-medium block">UHID</span>
              <span className="font-mono text-ink-primary">{patient.uhid}</span>
            </div>
          </div>

          {patient.address && (
            <div>
              <span className="text-ink-secondary font-medium block mb-0.5">Address</span>
              <p className="text-ink-primary">{patient.address}</p>
            </div>
          )}

          {patient.allergyNotes ? (
            <div className="p-3 bg-status-danger/10 border border-status-danger/20 rounded-lg space-y-1">
              <span className="font-medium text-status-danger flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Allergy & Sensitivity Notes
              </span>
              <p className="text-status-danger text-xs">{patient.allergyNotes}</p>
            </div>
          ) : (
            <div className="p-3 bg-surface-page border border-border rounded-lg text-ink-secondary">
              No allergy notes recorded.
            </div>
          )}
        </div>
      )}

      {(activeTab === 'opd' || activeTab === 'ipd') &&
        (() => {
          const rows = activeTab === 'opd' ? opdVisits : ipdVisits;
          if (visitsLoading) return <LoadingSkeleton rows={2} />;
          if (rows.length === 0) {
            return (
              <div className="text-ink-secondary text-xs py-8 text-center bg-surface-page rounded-lg border border-border">
                No {activeTab.toUpperCase()} visits recorded for this patient.
              </div>
            );
          }
          return (
            <div className="space-y-2">
              {rows.map((visit) => (
                <div key={visit.id} className="bg-surface-page p-3 rounded-lg border border-border space-y-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-medium text-ink-primary">{visit.treatmentName}</span>
                      {visit.diagnosis && (
                        <span className="text-ink-secondary block text-[11px] mt-0.5">Dx: {visit.diagnosis}</span>
                      )}
                    </div>
                    <StatusBadge
                      label={visit.status}
                      variant={visit.status === 'New' ? 'success' : visit.status === 'Dressing' ? 'warning' : 'accent'}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-secondary">
                    <span className="font-mono">{visit.date}</span>
                    {visit.doctor && <span>Dr. {visit.doctor.name}</span>}
                    {(visit.cashAmount > 0 || visit.bankAmount > 0) && (
                      <span className="font-mono">
                        {visit.cashAmount > 0 && `Cash ${money(visit.cashAmount)}`}
                        {visit.cashAmount > 0 && visit.bankAmount > 0 && ' · '}
                        {visit.bankAmount > 0 && `Bank ${money(visit.bankAmount)}`}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

      {activeTab === 'prescriptions' &&
        (prescriptionsLoading ? (
          <LoadingSkeleton rows={2} />
        ) : prescriptions.length === 0 ? (
          <div className="text-ink-secondary text-xs py-8 text-center bg-surface-page rounded-lg border border-border">
            No prescriptions recorded for this patient.
          </div>
        ) : (
          <div className="space-y-2">
            {prescriptions.map((rx) => (
              <div key={rx.id} className="bg-surface-page p-3 rounded-lg border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-ink-secondary text-[11px]">
                    {new Date(rx.createdAt).toLocaleDateString()} {rx.doctor && `• Dr. ${rx.doctor.name}`}
                  </span>
                  <StatusBadge label={rx.status} variant={rx.status === 'Dispensed' ? 'success' : 'warning'} />
                </div>
                <ul className="text-ink-primary space-y-0.5">
                  {rx.items.map((item, i) => (
                    <li key={i}>
                      <span className="font-medium">{item.medicine.name}</span> — {item.dosage}, {item.frequency}, {item.duration}
                    </li>
                  ))}
                </ul>
                {rx.notes && <p className="text-ink-secondary italic">{rx.notes}</p>}
              </div>
            ))}
          </div>
        ))}

      {activeTab === 'documents' && <DocumentsTab patientId={patient.id} admissionId={admissionId} />}

      {activeTab === 'admissions' &&
        (admissionsLoading ? (
          <LoadingSkeleton rows={2} />
        ) : admissions.length === 0 ? (
          <div className="text-ink-secondary text-xs py-8 text-center bg-surface-page rounded-lg border border-border">
            No IPD admissions recorded for this patient.
          </div>
        ) : (
          <div className="space-y-2">
            {admissions.map((adm) => (
              <div key={adm.id} className="bg-surface-page p-3 rounded-lg border border-border space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink-primary">
                    {adm.bed?.ward?.name} &bull; Bed {adm.bed?.bedNumber}
                  </span>
                  <StatusBadge label={adm.status} variant={adm.status === 'ADMITTED' ? 'warning' : 'neutral'} />
                </div>
                <p className="text-ink-secondary">{adm.reasonForAdmission}</p>
                <p className="text-[11px] text-ink-secondary/70">
                  Admitted {new Date(adm.admissionDate).toLocaleDateString()}
                  {adm.dischargeDate && ` • Discharged ${new Date(adm.dischargeDate).toLocaleDateString()}`}
                  {adm.doctor && ` • Dr. ${adm.doctor.name}`}
                </p>
              </div>
            ))}
          </div>
        ))}

      {activeTab === 'progress' &&
        (progressLoading ? (
          <LoadingSkeleton rows={2} />
        ) : progressTimeline.length === 0 ? (
          <div className="text-ink-secondary text-xs py-8 text-center bg-surface-page rounded-lg border border-border">
            No progress updates or condition trends recorded for this patient.
          </div>
        ) : (
          <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
            {(() => {
              const trendItems = progressTimeline.filter((t) => t.trend);
              if (trendItems.length === 0) return null;
              const total = trendItems.length;
              const latest = trendItems[0].trend;
              const latestCount = trendItems.filter((t) => t.trend === latest).length;
              let direction = '';
              if (latest === 'IMPROVING') direction = 'Improving — better';
              if (latest === 'WORSENING') direction = 'Worsening — worse';
              if (latest === 'SAME') direction = 'Unchanged — the same';
              
              return (
                <div className="flex justify-center mb-6">
                  <div className="text-center text-xs font-semibold text-ink-secondary relative z-10 bg-surface-page inline-block px-4 border border-border rounded-full shadow-sm py-1">
                    {direction} at {latestCount} of the last {total} visits
                  </div>
                </div>
              );
            })()}
            {progressTimeline.map((item, idx) => (
              <div key={item.id + idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-surface-page shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow flex-col gap-1 text-[10px] text-ink-primary font-bold z-10">
                  {item.trend === 'IMPROVING' && <ArrowUp className="w-4 h-4 text-status-success" />}
                  {item.trend === 'WORSENING' && <ArrowDown className="w-4 h-4 text-status-danger" />}
                  {item.trend === 'SAME' && <ArrowRight className="w-4 h-4 text-ink-secondary" />}
                  {!item.trend && <span className="text-ink-secondary font-medium">--</span>}
                </div>
                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded-lg border border-border bg-surface-card shadow-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-ink-secondary uppercase tracking-wider">{item.type}</span>
                    <span className="text-[10px] text-ink-secondary/70">{new Date(item.date).toLocaleString()}</span>
                  </div>
                  {item.status && (
                    <div className="mb-2">
                      <StatusBadge label={item.status} variant={item.status === 'CRITICAL' ? 'danger' : item.status === 'NEEDS_ATTENTION' ? 'warning' : 'success'} />
                    </div>
                  )}
                  {item.notes && <p className="text-xs text-ink-primary whitespace-pre-wrap">{item.notes}</p>}
                  {item.vitals && (
                    <div className="mt-2 pt-2 border-t border-border flex items-center gap-3 text-[10px] text-ink-secondary flex-wrap">
                      {item.vitals.bp && <span>BP: {item.vitals.bp}</span>}
                      {item.vitals.pr && <span>PR: {item.vitals.pr}</span>}
                      {item.vitals.spo2 && <span>SpO2: {item.vitals.spo2}%</span>}
                      {item.vitals.temp && <span>Temp: {item.vitals.temp}°</span>}
                    </div>
                  )}
                  {item.doctor && <p className="text-[10px] text-ink-secondary mt-2 text-right">- Dr. {item.doctor}</p>}
                </div>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
};
