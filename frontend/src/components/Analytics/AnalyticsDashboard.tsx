import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import {
  BarChart3,
  TrendingUp,
  Users,
  Stethoscope,
  RefreshCw,
  Download,
  Printer,
  Receipt,
  Pill,
  Clock,
} from 'lucide-react';
import { money } from '../../utils/money';
import { exportToCsv } from '../../utils/exportToCsv';
import { StatTile, ChartCard, ColumnChart, BarList, LineChart, ChartTable } from './charts';
import { AnalyticsReport } from './AnalyticsReport';
import type {
  RevenueStats,
  PatientStats,
  TreatmentStats,
  Collections,
  DoctorPerformance,
  PharmacyStats,
  PatientFlow,
} from './types';

type TabId = 'overview' | 'money' | 'doctors' | 'pharmacy' | 'flow';

const RANGE_LABEL: Record<string, string> = {
  month: 'This month',
  quarter: 'Last 3 months',
  year: 'This year',
};

/** YYYY-MM-DD → DD/MM, the form a clinic reads down an axis. */
const dayLabel = (date: string) => `${date.slice(8, 10)}/${date.slice(5, 7)}`;

/**
 * YYYY-MM-DD in the browser's own timezone. `toISOString()` shifts to UTC first, so in
 * India a local midnight came out as the previous day and every range started early.
 */
const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const AnalyticsDashboard: React.FC = () => {
  const { hasRole, apiFetch } = useAuth();
  const { addToast } = useToast();

  const [tab, setTab] = useState<TabId>('overview');
  const [dateRange, setDateRange] = useState('year');
  const [loading, setLoading] = useState(true);
  const [showReport, setShowReport] = useState(false);

  const [revenue, setRevenue] = useState<RevenueStats | null>(null);
  const [patients, setPatients] = useState<PatientStats | null>(null);
  const [treatments, setTreatments] = useState<TreatmentStats | null>(null);
  const [collections, setCollections] = useState<Collections | null>(null);
  const [doctors, setDoctors] = useState<DoctorPerformance | null>(null);
  const [pharmacy, setPharmacy] = useState<PharmacyStats | null>(null);
  const [flow, setFlow] = useState<PatientFlow | null>(null);

  const canViewRevenue = hasRole('SUPER_ADMIN', 'MASTER', 'ACCOUNT');
  const canViewPatients = hasRole('SUPER_ADMIN', 'MASTER');
  const canViewTreatments = hasRole('SUPER_ADMIN', 'MASTER', 'DOCTOR');
  const canViewPharmacy = hasRole('SUPER_ADMIN', 'MASTER', 'ACCOUNT', 'PHARMACY');
  const canViewFlow = hasRole('SUPER_ADMIN', 'MASTER', 'DOCTOR', 'RECEPTION');

  const tabs: { id: TabId; label: string; visible: boolean }[] = [
    { id: 'overview', label: 'Overview', visible: true },
    { id: 'money', label: 'Money & GST', visible: canViewRevenue },
    { id: 'doctors', label: 'Doctors & RM', visible: canViewRevenue },
    { id: 'pharmacy', label: 'Pharmacy', visible: canViewPharmacy },
    { id: 'flow', label: 'Patient flow', visible: canViewFlow },
  ];
  const visibleTabs = tabs.filter((t) => t.visible);

  const now = new Date();
  const from =
    dateRange === 'month'
      ? isoDate(new Date(now.getFullYear(), now.getMonth(), 1))
      : dateRange === 'quarter'
        ? isoDate(new Date(now.getFullYear(), now.getMonth() - 3, 1))
        : isoDate(new Date(now.getFullYear(), 0, 1));

  const get = async <T,>(url: string): Promise<T | null> => {
    const res = await apiFetch(url);
    return res.ok ? ((await res.json()) as T) : null;
  };

  /** Only the open tab's data is fetched; the rest load when the tab is opened. */
  const fetchTab = async (which: TabId) => {
    setLoading(true);
    try {
      if (which === 'overview') {
        const [rev, pat, trt] = await Promise.all([
          canViewRevenue ? get<RevenueStats>(`/api/analytics/revenue?from=${from}`) : null,
          canViewPatients ? get<PatientStats>('/api/analytics/patients') : null,
          canViewTreatments ? get<TreatmentStats>('/api/analytics/treatments') : null,
        ]);
        if (rev) setRevenue(rev);
        if (pat) setPatients(pat);
        if (trt) setTreatments(trt);
      } else if (which === 'money' && canViewRevenue) {
        const data = await get<Collections>(`/api/analytics/collections?from=${from}`);
        if (data) setCollections(data);
      } else if (which === 'doctors' && canViewRevenue) {
        const data = await get<DoctorPerformance>(`/api/analytics/doctors?from=${from}`);
        if (data) setDoctors(data);
      } else if (which === 'pharmacy' && canViewPharmacy) {
        const data = await get<PharmacyStats>('/api/analytics/pharmacy?days=90');
        if (data) setPharmacy(data);
      } else if (which === 'flow' && canViewFlow) {
        const data = await get<PatientFlow>(`/api/analytics/patient-flow?from=${from}`);
        if (data) setFlow(data);
      }
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTab(tab);
  }, [tab, dateRange]);

  /** The printed report covers every section this role may see, not just the open tab. */
  const openReport = async () => {
    setLoading(true);
    try {
      const [col, doc, pha, flw] = await Promise.all([
        canViewRevenue && !collections ? get<Collections>(`/api/analytics/collections?from=${from}`) : collections,
        canViewRevenue && !doctors ? get<DoctorPerformance>(`/api/analytics/doctors?from=${from}`) : doctors,
        canViewPharmacy && !pharmacy ? get<PharmacyStats>('/api/analytics/pharmacy?days=90') : pharmacy,
        canViewFlow && !flow ? get<PatientFlow>(`/api/analytics/patient-flow?from=${from}`) : flow,
      ]);
      setCollections(col);
      setDoctors(doc);
      setPharmacy(pha);
      setFlow(flw);
      setShowReport(true);
    } catch (err: any) {
      addToast('error', err.message || 'Could not assemble the report');
    } finally {
      setLoading(false);
    }
  };

  const csvButton = (onClick: () => void) => (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border text-[11px] font-medium text-ink-secondary hover:text-ink-primary hover:bg-surface-page transition-colors cursor-pointer"
    >
      <Download className="w-3.5 h-3.5" />
      CSV
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink-primary tracking-tight flex items-center gap-2">
          <BarChart3 className="w-4.5 h-4.5 text-brand" /> Analytics &amp; Reports
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-1.5 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand"
          >
            <option value="year">This Year</option>
            <option value="quarter">Last 3 Months</option>
            <option value="month">This Month</option>
          </select>
          <button
            onClick={openReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white bg-brand hover:bg-brand-deep shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print report</span>
          </button>
          <button
            onClick={() => fetchTab(tab)}
            disabled={loading}
            className="p-1.5 rounded-md border border-border text-ink-secondary hover:text-ink-primary hover:bg-surface-page cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
        {visibleTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer ${
              tab === t.id
                ? 'border-brand text-brand'
                : 'border-transparent text-ink-secondary hover:text-ink-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingSkeleton rows={4} />
      ) : (
        <>
          {tab === 'overview' && (
            <div className="space-y-6">
              {canViewRevenue && revenue && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatTile label="Revenue" value={money(revenue.totalRevenue)} sub={RANGE_LABEL[dateRange]} />
                    <StatTile label="Invoices" value={String(revenue.totalInvoices)} />
                    <StatTile label="Average / invoice" value={money(revenue.averagePerInvoice)} />
                    {patients && <StatTile label="Patients" value={String(patients.totalPatients)} sub="Registered to date" />}
                  </div>
                  <ChartCard
                    title="Revenue by month"
                    icon={<TrendingUp className="w-4 h-4 text-brand" />}
                    actions={csvButton(() =>
                      exportToCsv('revenue-by-month', revenue.monthlyBreakdown, [
                        { key: 'month', label: 'Month' },
                        { key: 'total', label: 'Revenue' },
                        { key: 'count', label: 'Invoices' },
                      ]),
                    )}
                    table={
                      <ChartTable
                        columns={[
                          { key: 'month', label: 'Month' },
                          { key: 'total', label: 'Revenue', align: 'right' },
                          { key: 'count', label: 'Invoices', align: 'right' },
                        ]}
                        rows={revenue.monthlyBreakdown.map((m) => ({
                          month: m.month,
                          total: money(m.total),
                          count: m.count,
                        }))}
                      />
                    }
                  >
                    <ColumnChart
                      data={revenue.monthlyBreakdown.map((m) => ({ label: m.month.slice(5), values: [m.total] }))}
                      series={['Revenue']}
                      format={money}
                    />
                  </ChartCard>
                </>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {canViewPatients && patients && (
                  <ChartCard title="Patient growth" icon={<Users className="w-4 h-4 text-brand" />}>
                    <ColumnChart
                      data={patients.monthlyRegistrations.slice(-12).map((m) => ({
                        label: m.month.slice(5),
                        values: [m.count],
                      }))}
                      series={['New patients']}
                      height={120}
                    />
                    <p className="text-[11px] text-ink-secondary">
                      {patients.genderDistribution.Male} male · {patients.genderDistribution.Female} female ·{' '}
                      {patients.genderDistribution.Other} other
                    </p>
                  </ChartCard>
                )}

                {canViewTreatments && treatments && (
                  <ChartCard title="Top treatments" icon={<Stethoscope className="w-4 h-4 text-brand" />}>
                    <BarList
                      items={treatments.topTreatments.slice(0, 6).map((t) => ({
                        label: t.name,
                        value: t.count,
                        meta: money(t.revenue),
                      }))}
                    />
                    <p className="text-[11px] text-ink-secondary">
                      {treatments.totalVisits} visits · {treatments.newVisits} new · {treatments.followUpVisits} follow-up
                    </p>
                  </ChartCard>
                )}
              </div>

              {treatments && treatments.referralSources.length > 0 && (
                <ChartCard title="How patients found the clinic" icon={<Users className="w-4 h-4 text-brand" />}>
                  <BarList
                    items={treatments.referralSources.slice(0, 8).map((s) => ({ label: s.source, value: s.count }))}
                    colorIndex={1}
                  />
                </ChartCard>
              )}
            </div>
          )}

          {tab === 'money' && collections && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatTile label="Collected" value={money(collections.totals.total)} sub={RANGE_LABEL[dateRange]} />
                <StatTile label="Cash" value={money(collections.totals.cash)} />
                <StatTile label="Bank" value={money(collections.totals.bank)} />
                <StatTile
                  label="Unreconciled"
                  value={money(collections.unreconciled.amount)}
                  sub={`${collections.unreconciled.count} invoice(s)`}
                  tone={collections.unreconciled.count > 0 ? 'warning' : 'default'}
                />
              </div>

              <ChartCard
                title="Collections by day"
                icon={<Receipt className="w-4 h-4 text-brand" />}
                actions={csvButton(() =>
                  exportToCsv('collections-by-day', collections.daily, [
                    { key: 'date', label: 'Date' },
                    { key: 'cash', label: 'Cash' },
                    { key: 'bank', label: 'Bank' },
                    { key: 'total', label: 'Total' },
                    { key: 'count', label: 'Invoices' },
                  ]),
                )}
                table={
                  <ChartTable
                    columns={[
                      { key: 'date', label: 'Date' },
                      { key: 'cash', label: 'Cash', align: 'right' },
                      { key: 'bank', label: 'Bank', align: 'right' },
                      { key: 'total', label: 'Total', align: 'right' },
                    ]}
                    rows={collections.daily.map((d) => ({
                      date: d.date,
                      cash: money(d.cash),
                      bank: money(d.bank),
                      total: money(d.total),
                    }))}
                  />
                }
              >
                <ColumnChart
                  data={collections.daily.map((d) => ({ label: dayLabel(d.date), values: [d.cash, d.bank] }))}
                  series={['Cash', 'Bank']}
                  stacked
                  format={money}
                />
              </ChartCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard
                  title="GST by rate"
                  icon={<Receipt className="w-4 h-4 text-brand" />}
                  actions={csvButton(() =>
                    exportToCsv('gst-by-rate', collections.gstByRate, [
                      { key: 'rate', label: 'Rate %' },
                      { key: 'taxableValue', label: 'Taxable value' },
                      { key: 'cgst', label: 'CGST' },
                      { key: 'sgst', label: 'SGST' },
                      { key: 'total', label: 'Total' },
                    ]),
                  )}
                >
                  <ChartTable
                    columns={[
                      { key: 'rate', label: 'Rate' },
                      { key: 'taxable', label: 'Taxable', align: 'right' },
                      { key: 'cgst', label: 'CGST', align: 'right' },
                      { key: 'sgst', label: 'SGST', align: 'right' },
                      { key: 'total', label: 'Total', align: 'right' },
                    ]}
                    rows={collections.gstByRate.map((g) => ({
                      rate: `${g.rate}%`,
                      taxable: money(g.taxableValue),
                      cgst: money(g.cgst),
                      sgst: money(g.sgst),
                      total: money(g.total),
                    }))}
                  />
                </ChartCard>

                <ChartCard title="What was sold" icon={<Receipt className="w-4 h-4 text-brand" />}>
                  <BarList
                    items={collections.bySource.map((s) => ({
                      label: s.source,
                      value: s.total,
                      meta: `${s.count} invoice(s)`,
                    }))}
                    format={money}
                  />
                </ChartCard>
              </div>
            </div>
          )}

          {tab === 'doctors' && doctors && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatTile label="Visits" value={String(doctors.totals.visits)} sub={RANGE_LABEL[dateRange]} />
                <StatTile label="Treatment revenue" value={money(doctors.totals.revenue)} />
                <StatTile label="Commission" value={money(doctors.totals.commission)} />
                <StatTile label="Doctors active" value={String(doctors.doctors.length)} />
              </div>

              <ChartCard
                title="Revenue by doctor"
                icon={<Stethoscope className="w-4 h-4 text-brand" />}
                actions={csvButton(() =>
                  exportToCsv('revenue-by-doctor', doctors.doctors, [
                    { key: 'name', label: 'Doctor' },
                    { key: 'visits', label: 'Visits' },
                    { key: 'newVisits', label: 'New' },
                    { key: 'followUps', label: 'Follow-up' },
                    { key: 'revenue', label: 'Revenue' },
                    { key: 'averagePerVisit', label: 'Average per visit' },
                  ]),
                )}
                table={
                  <ChartTable
                    columns={[
                      { key: 'name', label: 'Doctor' },
                      { key: 'visits', label: 'Visits', align: 'right' },
                      { key: 'revenue', label: 'Revenue', align: 'right' },
                      { key: 'average', label: 'Avg / visit', align: 'right' },
                    ]}
                    rows={doctors.doctors.map((d) => ({
                      name: d.name,
                      visits: d.visits,
                      revenue: money(d.revenue),
                      average: money(d.averagePerVisit),
                    }))}
                  />
                }
              >
                <BarList
                  items={doctors.doctors.map((d) => ({
                    label: d.name,
                    value: d.revenue,
                    meta: `${d.visits} visit(s)`,
                  }))}
                  format={money}
                />
              </ChartCard>

              <ChartCard
                title="Commission by beneficiary"
                icon={<Users className="w-4 h-4 text-brand" />}
                actions={csvButton(() =>
                  exportToCsv('commission-by-beneficiary', doctors.commissions, [
                    { key: 'beneficiaryName', label: 'Beneficiary' },
                    { key: 'role', label: 'Role' },
                    { key: 'count', label: 'Records' },
                    { key: 'amount', label: 'Commission' },
                  ]),
                )}
              >
                <BarList
                  items={doctors.commissions.map((c) => ({
                    label: `${c.beneficiaryName} (${c.role})`,
                    value: c.amount,
                    meta: `${c.count} record(s)`,
                  }))}
                  format={money}
                  colorIndex={1}
                  emptyMessage="No commission recorded for this period"
                />
              </ChartCard>
            </div>
          )}

          {tab === 'pharmacy' && pharmacy && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatTile label="Stock at retail" value={money(pharmacy.valuation.retailValue)} />
                <StatTile label="Stock at cost" value={money(pharmacy.valuation.batchCostValue)} />
                <StatTile label="Items stocked" value={String(pharmacy.valuation.items)} />
                <StatTile
                  label="Low stock"
                  value={String(pharmacy.lowStock.length)}
                  sub="At or below reorder point"
                  tone={pharmacy.lowStock.length > 0 ? 'warning' : 'default'}
                />
              </div>

              <ChartCard
                title="Stock by expiry window"
                icon={<Pill className="w-4 h-4 text-brand" />}
                actions={csvButton(() =>
                  exportToCsv('stock-by-expiry', pharmacy.expiry, [
                    { key: 'bucket', label: 'Expiry window' },
                    { key: 'quantity', label: 'Units' },
                    { key: 'value', label: 'Value at cost' },
                  ]),
                )}
              >
                <ColumnChart
                  data={pharmacy.expiry.map((e) => ({ label: e.bucket, values: [e.value] }))}
                  series={['Value at cost']}
                  format={money}
                />
                <p className="text-[11px] text-ink-secondary">
                  {pharmacy.expiry[0]?.quantity ?? 0} unit(s) already expired ·{' '}
                  {pharmacy.expiry[1]?.quantity ?? 0} expiring within 30 days
                </p>
              </ChartCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title={`Most dispensed (${pharmacy.windowDays} days)`} icon={<Pill className="w-4 h-4 text-brand" />}>
                  <BarList
                    items={pharmacy.topMovers.map((m) => ({ label: m.name, value: m.quantity, meta: 'units' }))}
                  />
                  <p className="text-[11px] text-ink-secondary">
                    {pharmacy.dispensingMix.map((d) => `${d.channel}: ${d.units}`).join(' · ')}
                  </p>
                </ChartCard>

                <ChartCard title="Not moving" icon={<Pill className="w-4 h-4 text-brand" />}>
                  <BarList
                    items={pharmacy.stagnant.map((s) => ({
                      label: s.name,
                      value: s.value,
                      meta: `${s.stockQty} in stock`,
                    }))}
                    format={money}
                    colorIndex={1}
                    emptyMessage="Everything on the shelf moved in this window"
                  />
                </ChartCard>
              </div>

              {pharmacy.lowStock.length > 0 && (
                <ChartCard title="Below reorder point" icon={<Pill className="w-4 h-4 text-status-warning" />}>
                  <ChartTable
                    columns={[
                      { key: 'name', label: 'Medicine' },
                      { key: 'stockQty', label: 'In stock', align: 'right' },
                      { key: 'reorderPoint', label: 'Reorder at', align: 'right' },
                      { key: 'shortfall', label: 'Short by', align: 'right' },
                    ]}
                    rows={pharmacy.lowStock.map((l) => ({ ...l }))}
                  />
                </ChartCard>
              )}
            </div>
          )}

          {tab === 'flow' && flow && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatTile label="Encounters" value={String(flow.totals.encounters)} sub={RANGE_LABEL[dateRange]} />
                <StatTile
                  label="Average wait"
                  value={`${flow.wait.averageMinutes} min`}
                  sub={`Median ${flow.wait.medianMinutes} min`}
                />
                <StatTile label="Longest wait" value={`${flow.wait.longestMinutes} min`} />
                <StatTile
                  label="Follow-ups kept"
                  value={`${flow.followUps.adherenceRate}%`}
                  sub={`${flow.followUps.kept} of ${flow.followUps.due} due`}
                  tone={flow.followUps.due > 0 && flow.followUps.adherenceRate < 50 ? 'warning' : 'default'}
                />
              </div>

              <ChartCard
                title="Daily load — OPD and IPD"
                icon={<Users className="w-4 h-4 text-brand" />}
                actions={csvButton(() =>
                  exportToCsv('patient-flow-daily', flow.daily, [
                    { key: 'date', label: 'Date' },
                    { key: 'opd', label: 'OPD' },
                    { key: 'ipd', label: 'IPD' },
                    { key: 'total', label: 'Total' },
                    { key: 'averageWaitMinutes', label: 'Average wait (min)' },
                  ]),
                )}
                table={
                  <ChartTable
                    columns={[
                      { key: 'date', label: 'Date' },
                      { key: 'opd', label: 'OPD', align: 'right' },
                      { key: 'ipd', label: 'IPD', align: 'right' },
                      { key: 'wait', label: 'Avg wait', align: 'right' },
                    ]}
                    rows={flow.daily.map((d) => ({
                      date: d.date,
                      opd: d.opd,
                      ipd: d.ipd,
                      wait: `${d.averageWaitMinutes} min`,
                    }))}
                  />
                }
              >
                <ColumnChart
                  data={flow.daily.map((d) => ({ label: dayLabel(d.date), values: [d.opd, d.ipd] }))}
                  series={['OPD', 'IPD']}
                  stacked
                />
              </ChartCard>

              <ChartCard title="Average wait by day" icon={<Clock className="w-4 h-4 text-brand" />}>
                <LineChart
                  points={flow.daily.map((d) => ({ label: dayLabel(d.date), value: d.averageWaitMinutes }))}
                  format={(v) => `${v} min`}
                  emptyMessage="No waits measured — the queue records no time seen"
                />
              </ChartCard>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title="Queue outcomes" icon={<Users className="w-4 h-4 text-brand" />}>
                  <BarList items={flow.statusMix.map((s) => ({ label: s.status, value: s.count }))} />
                </ChartCard>
                <ChartCard title="New vs returning" icon={<Users className="w-4 h-4 text-brand" />}>
                  <BarList
                    items={[
                      { label: 'New', value: flow.totals.newPatients },
                      { label: 'Returning', value: flow.totals.returningPatients },
                    ]}
                    colorIndex={1}
                  />
                </ChartCard>
              </div>
            </div>
          )}
        </>
      )}

      {showReport && (
        <AnalyticsReport
          period={`${RANGE_LABEL[dateRange]} — from ${from}`}
          collections={collections}
          doctors={doctors}
          pharmacy={pharmacy}
          flow={flow}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
};
