import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { StatusBadge } from '../common/StatusBadge';
import { exportToCsv } from '../../utils/exportToCsv';
import { AccountsDashboard } from '../Accounts/AccountsDashboard';
import { PatientList } from '../Patients/PatientList';
import {
  LayoutDashboard,
  Landmark,
  Pill,
  Users,
  Stethoscope,
  UserCog,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { money } from '../../utils/money';

type Tab = 'overview' | 'accounts' | 'pharmacy' | 'patients' | 'doctors' | 'staff';

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'accounts', label: 'Accounts Records', icon: Landmark },
  { key: 'pharmacy', label: 'Pharmacy Records', icon: Pill },
  { key: 'patients', label: 'Patient Records', icon: Users },
  { key: 'doctors', label: 'Doctor Records', icon: Stethoscope },
  { key: 'staff', label: 'Staff & Nurse Records', icon: UserCog },
];


const Stat: React.FC<{ label: string; value: string; sub?: string }> = ({ label, value, sub }) => (
  <div className="bg-surface-card p-4 rounded-[10px] border border-border shadow-xs">
    <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">{label}</p>
    <p className="text-lg font-semibold text-ink-primary leading-tight mt-1">{value}</p>
    {sub && <p className="text-[11px] text-ink-secondary mt-0.5">{sub}</p>}
  </div>
);

/** The owner's management console — every record set in one place. */
export const AdminPanel: React.FC = () => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [tab, setTab] = useState<Tab>('overview');

  const [overview, setOverview] = useState<any>(null);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [pharmacy, setPharmacy] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState<Set<Tab>>(new Set());

  useEffect(() => {
    // Each record set is fetched the first time its tab is opened.
    if (loaded.has(tab) || ['accounts', 'patients'].includes(tab)) return;

    const endpoint =
      tab === 'overview' ? 'overview' : tab === 'doctors' ? 'doctors' : tab === 'staff' ? 'staff' : 'pharmacy';

    (async () => {
      setLoading(true);
      try {
        const res = await apiFetch(`/api/admin/${endpoint}`);
        if (!res.ok) throw new Error(`Failed to load ${tab} records`);
        const data = await res.json();
        if (tab === 'overview') setOverview(data);
        else if (tab === 'doctors') setDoctors(data);
        else if (tab === 'staff') setStaff(data);
        else setPharmacy(data);
        setLoaded((prev) => new Set(prev).add(tab));
      } catch (err: any) {
        addToast('error', err.message || `Failed to load ${tab} records`);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="space-y-5 font-sans text-ink-primary">
      <div className="bg-surface-card p-4 sm:p-5 rounded-[10px] border border-border shadow-xs">
        <h2 className="text-lg font-semibold tracking-tight">Admin Panel</h2>
        <p className="text-xs text-ink-secondary mt-0.5">
          Management view across accounts, pharmacy, patients, doctors and floor staff.
        </p>
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

      {loading && <LoadingSkeleton rows={4} />}

      {/* ---------- Overview ---------- */}
      {tab === 'overview' && !loading && overview && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Patients" value={String(overview.patients)} sub={`${overview.queueToday} in today's queue`} />
            <Stat
              label="Visits"
              value={String(overview.visitsOpd + overview.visitsIpd)}
              sub={`OPD ${overview.visitsOpd} · IPD ${overview.visitsIpd}`}
            />
            <Stat label="Lifetime Revenue" value={money(overview.lifetimeRevenue)} sub="Cash + bank on visits" />
            <Stat label="Stock Purchases" value={money(overview.purchaseTotal)} sub={`${overview.purchaseCount} bills`} />
            <Stat
              label="Currently Admitted"
              value={String(overview.currentlyAdmitted)}
              sub="Patients on a ward bed"
            />
            <Stat
              label="Pharmacy Stock Value"
              value={money(overview.stockValue)}
              sub={`${overview.medicineCount} items`}
            />
            <Stat
              label="Low Stock Items"
              value={String(overview.lowStockCount)}
              sub="At or below reorder point"
            />
            <Stat label="Receipts Issued" value={String(overview.invoiceCount)} sub={money(overview.invoiceTotal)} />
          </div>

          <div className="bg-surface-card p-4 rounded-[10px] border border-border shadow-xs">
            <h3 className="text-sm font-semibold mb-3">Team</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(overview.staffByRole as Record<string, number>).map(([role, count]) => (
                <span
                  key={role}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-surface-page border border-border"
                >
                  <span className="font-medium">{role}</span>
                  <span className="font-mono text-ink-secondary">{count}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Accounts / Patients reuse the full existing screens ---------- */}
      {tab === 'accounts' && <AccountsDashboard />}
      {tab === 'patients' && <PatientList />}

      {/* ---------- Pharmacy ---------- */}
      {tab === 'pharmacy' && !loading && pharmacy && (
        <div className="space-y-4">
          {/* Stock is a live position; purchases and dispensing are for this window —
              saying so avoids confusion with the all-time figures on Overview. */}
          <p className="text-[11px] text-ink-secondary">
            Stock is current. Purchases and dispensing cover{' '}
            <span className="font-mono">{pharmacy.period.from}</span> to{' '}
            <span className="font-mono">{pharmacy.period.to}</span>.
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Stock Value" value={money(pharmacy.stock.stockValue)} sub={`${pharmacy.stock.itemCount} items`} />
            <Stat label="Low Stock" value={String(pharmacy.stock.lowStock.length)} sub="Need reordering" />
            <Stat label="Purchases" value={money(pharmacy.purchases.total)} sub={`${pharmacy.purchases.count} bills`} />
            <Stat
              label="Dispensed"
              value={money(pharmacy.dispensing.valueDispensed)}
              sub={`${pharmacy.dispensing.unitsDispensed} units`}
            />
          </div>

          {pharmacy.stock.lowStock.length > 0 && (
            <div className="bg-surface-card rounded-[10px] border border-status-warning/30 shadow-xs overflow-hidden">
              <div className="p-3 border-b border-border bg-status-warning/10 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-status-warning" />
                <h3 className="text-sm font-semibold text-status-warning">Low stock — reorder</h3>
              </div>
              <div className="p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {pharmacy.stock.lowStock.map((m: any) => (
                  <div key={m.id} className="bg-surface-page p-2.5 rounded border border-border text-xs">
                    <p className="font-medium truncate" title={m.name}>
                      {m.name}
                    </p>
                    <p className="text-ink-secondary font-mono">
                      {m.stockQty} / {m.reorderPoint} {m.unit}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-surface-card rounded-[10px] border border-border shadow-xs overflow-hidden">
            <h3 className="text-sm font-semibold p-4 border-b border-border">Recent stock purchases</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-page">
                  <tr className="border-b border-border text-ink-secondary font-medium">
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Vendor</th>
                    <th className="py-2.5 px-4">Invoice</th>
                    <th className="py-2.5 px-4">Item</th>
                    <th className="py-2.5 px-4 text-right">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {pharmacy.purchases.recent.map((p: any) => (
                    <tr key={p.id} className="hover:bg-surface-page/60">
                      <td className="py-2.5 px-4 font-mono text-ink-secondary whitespace-nowrap">{p.invoiceDate}</td>
                      <td className="py-2.5 px-4">{p.vendorName}</td>
                      <td className="py-2.5 px-4 font-mono text-ink-secondary">{p.invoiceNumber}</td>
                      <td className="py-2.5 px-4 max-w-[220px] truncate" title={p.itemDescription}>
                        {p.itemDescription}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono">{money(p.totalValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-surface-card rounded-[10px] border border-border shadow-xs overflow-hidden">
            <h3 className="text-sm font-semibold p-4 border-b border-border">Recent stock movements</h3>
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-page sticky top-0">
                  <tr className="border-b border-border text-ink-secondary font-medium">
                    <th className="py-2.5 px-4">Medicine</th>
                    <th className="py-2.5 px-4 text-right">Change</th>
                    <th className="py-2.5 px-4 text-right">New Qty</th>
                    <th className="py-2.5 px-4">Reason</th>
                    <th className="py-2.5 px-4">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {pharmacy.recentMovements.map((m: any) => (
                    <tr key={m.id} className="hover:bg-surface-page/60">
                      <td className="py-2.5 px-4">{m.medicine}</td>
                      <td
                        className={`py-2.5 px-4 text-right font-mono font-medium ${
                          m.delta >= 0 ? 'text-status-success' : 'text-status-danger'
                        }`}
                      >
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-ink-secondary">{m.newQty}</td>
                      <td className="py-2.5 px-4 max-w-[220px] truncate" title={m.reason}>
                        {m.reason}
                      </td>
                      <td className="py-2.5 px-4 text-ink-secondary">{m.by || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Doctors ---------- */}
      {tab === 'doctors' && !loading && loaded.has('doctors') && (
        <div className="bg-surface-card rounded-[10px] border border-border shadow-xs overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="text-sm font-semibold">Doctor records</h3>
            <button
              onClick={() =>
                exportToCsv('doctor-records', doctors, [
                  { key: 'name', label: 'Doctor' },
                  { key: 'role', label: 'Role' },
                  { key: 'visits', label: 'Visits' },
                  { key: 'patientsSeen', label: 'Patients Seen' },
                  { key: 'revenue', label: 'Revenue' },
                  { key: 'consultationFees', label: 'Consultation Fees' },
                  { key: 'admissions', label: 'Admissions' },
                  { key: 'templates', label: 'Templates' },
                ])
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-surface-page">
                <tr className="border-b border-border text-ink-secondary font-medium">
                  <th className="py-2.5 px-4">Doctor</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4 text-right">Visits</th>
                  <th className="py-2.5 px-4 text-right">Patients</th>
                  <th className="py-2.5 px-4 text-right">Revenue</th>
                  <th className="py-2.5 px-4 text-right">Consult Fees</th>
                  <th className="py-2.5 px-4 text-right">Admissions</th>
                  <th className="py-2.5 px-4 text-right">Templates</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {doctors.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-page/60">
                    <td className="py-2.5 px-4">
                      <p className="font-medium">{d.name}</p>
                      <p className="text-[11px] text-ink-secondary">{d.email}</p>
                    </td>
                    <td className="py-2.5 px-4 text-ink-secondary">{d.role}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{d.visits}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{d.patientsSeen}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{money(d.revenue)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{money(d.consultationFees)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{d.admissions}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{d.templates}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------- Staff & Nurses ---------- */}
      {tab === 'staff' && !loading && loaded.has('staff') && (
        <div className="bg-surface-card rounded-[10px] border border-border shadow-xs overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <h3 className="text-sm font-semibold">Staff &amp; nurse records</h3>
              <p className="text-[11px] text-ink-secondary mt-0.5">Nurses cover IPD, service staff cover OPD.</p>
            </div>
            <button
              onClick={() =>
                exportToCsv('staff-records', staff, [
                  { key: 'name', label: 'Name' },
                  { key: 'role', label: 'Role' },
                  { key: 'scope', label: 'Scope' },
                  { key: 'assignedDoctor', label: 'Assigned Doctor' },
                  { key: 'ordersPerformed', label: 'Orders Performed' },
                  { key: 'medicinesGiven', label: 'Medicines Given' },
                  { key: 'unitsGiven', label: 'Units' },
                  { key: 'valueGiven', label: 'Value' },
                ])
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export
            </button>
          </div>
          {staff.length === 0 ? (
            <p className="p-8 text-center text-xs text-ink-secondary">No nurse or staff accounts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-surface-page">
                  <tr className="border-b border-border text-ink-secondary font-medium">
                    <th className="py-2.5 px-4">Name</th>
                    <th className="py-2.5 px-4">Scope</th>
                    <th className="py-2.5 px-4">Assigned Doctor</th>
                    <th className="py-2.5 px-4 text-right">Orders Done</th>
                    <th className="py-2.5 px-4 text-right">Medicines</th>
                    <th className="py-2.5 px-4 text-right">Units</th>
                    <th className="py-2.5 px-4 text-right">Value</th>
                    <th className="py-2.5 px-4 text-right">Ward Doses</th>
                    <th className="py-2.5 px-4 text-right">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {staff.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-page/60">
                      <td className="py-2.5 px-4">
                        <p className="font-medium">{s.name}</p>
                        <p className="text-[11px] text-ink-secondary">{s.email}</p>
                      </td>
                      <td className="py-2.5 px-4">
                        <StatusBadge label={`${s.role} · ${s.scope}`} variant={s.scope === 'IPD' ? 'warning' : 'accent'} />
                      </td>
                      <td className="py-2.5 px-4 text-ink-secondary">{s.assignedDoctor || '—'}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{s.ordersPerformed}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{s.medicinesGiven}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{s.unitsGiven}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{money(s.valueGiven)}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{s.wardAdministrations}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{s.progressNotes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
