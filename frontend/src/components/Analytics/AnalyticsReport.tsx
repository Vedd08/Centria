import React from 'react';
import { X, Printer } from 'lucide-react';
import { money } from '../../utils/money';
import { BrandLogo } from '../common/BrandLogo';
import { useClinicProfile } from '../../hooks/useClinicProfile';
import { PrintPortal } from '../common/PrintPortal';
import type { Collections, DoctorPerformance, PharmacyStats, PatientFlow } from './types';

interface Props {
  period: string;
  collections: Collections | null;
  doctors: DoctorPerformance | null;
  pharmacy: PharmacyStats | null;
  flow: PatientFlow | null;
  onClose: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="space-y-2 break-inside-avoid">
    <h2 className="text-xs font-bold tracking-wider uppercase border-b border-ink-primary/20 pb-1">{title}</h2>
    {children}
  </section>
);

const Figures: React.FC<{ rows: [string, string][] }> = ({ rows }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
    {rows.map(([label, value]) => (
      <div key={label}>
        <p className="text-ink-secondary text-[10px]">{label}</p>
        <p className="font-semibold tabular-nums">{value}</p>
      </div>
    ))}
  </div>
);

const Rows: React.FC<{ head: string[]; rows: (string | number)[][] }> = ({ head, rows }) =>
  rows.length === 0 ? (
    <p className="text-[11px] text-ink-secondary italic">Nothing recorded for this period.</p>
  ) : (
    <table className="w-full text-[11px] border-collapse">
      <thead>
        <tr className="border-y border-border text-ink-secondary">
          {head.map((h, i) => (
            <th key={h} className={`py-1.5 ${i === 0 ? 'text-left' : 'text-right'}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-border/60">
            {r.map((cell, j) => (
              <td key={j} className={`py-1.5 ${j === 0 ? '' : 'text-right font-mono'}`}>
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

/**
 * The month's numbers on the clinic's own letterhead — the version that gets handed
 * to an owner or an accountant. Same print rules as the bills: the document is the
 * page, not a box floating on a grey one.
 */
export const AnalyticsReport: React.FC<Props> = ({ period, collections, doctors, pharmacy, flow, onClose }) => {
  const clinic = useClinicProfile();

  return (
    <PrintPortal>
      <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto print:static print:bg-white print:p-0 print:block print:overflow-visible print:backdrop-blur-none">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-3xl w-full my-8 print:my-0 print:shadow-none print:border-0 print:max-w-none print:rounded-none print:overflow-visible">
        <div className="flex items-center justify-between p-4 border-b border-border print:hidden">
          <span className="text-xs font-semibold text-ink-primary">Clinic report — {period}</span>
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

        <div className="p-8 print:p-6 text-ink-primary space-y-6">
          <div className="text-center border-b-2 border-ink-primary pb-4">
            <h1 className="text-xl font-bold tracking-tight uppercase">{clinic?.name ?? ''}</h1>
            {clinic?.address && <p className="text-[11px] text-ink-secondary mt-0.5">{clinic.address}</p>}
            <p className="text-xs font-semibold mt-2 tracking-wider">CLINIC REPORT</p>
            <p className="text-[11px] text-ink-secondary">{period}</p>
          </div>

          {collections && (
            <Section title="Collections & GST">
              <Figures
                rows={[
                  ['Collected', money(collections.totals.total)],
                  ['Cash', money(collections.totals.cash)],
                  ['Bank', money(collections.totals.bank)],
                  ['Invoices', String(collections.totals.count)],
                ]}
              />
              <Rows
                head={['GST rate', 'Taxable value', 'CGST', 'SGST', 'Total']}
                rows={collections.gstByRate.map((g) => [
                  `${g.rate}%`,
                  money(g.taxableValue),
                  money(g.cgst),
                  money(g.sgst),
                  money(g.total),
                ])}
              />
              {collections.unreconciled.count > 0 && (
                <p className="text-[11px] text-status-warning">
                  {collections.unreconciled.count} invoice(s) unreconciled — {money(collections.unreconciled.amount)}
                </p>
              )}
            </Section>
          )}

          {doctors && (
            <Section title="Doctors & commissions">
              <Rows
                head={['Doctor', 'Visits', 'New', 'Follow-up', 'Revenue']}
                rows={doctors.doctors.map((d) => [d.name, d.visits, d.newVisits, d.followUps, money(d.revenue)])}
              />
              {doctors.commissions.length > 0 && (
                <Rows
                  head={['Beneficiary', 'Role', 'Records', 'Commission']}
                  rows={doctors.commissions.map((c) => [c.beneficiaryName, c.role, c.count, money(c.amount)])}
                />
              )}
            </Section>
          )}

          {pharmacy && (
            <Section title="Pharmacy & stock">
              <Figures
                rows={[
                  ['Stock at retail', money(pharmacy.valuation.retailValue)],
                  ['Stock at cost', money(pharmacy.valuation.batchCostValue)],
                  ['Items stocked', String(pharmacy.valuation.items)],
                  ['Low stock', String(pharmacy.lowStock.length)],
                ]}
              />
              <Rows
                head={['Expiry window', 'Units', 'Value at cost']}
                rows={pharmacy.expiry.map((e) => [e.bucket, e.quantity, money(e.value)])}
              />
            </Section>
          )}

          {flow && (
            <Section title="Patient flow">
              <Figures
                rows={[
                  ['Encounters', String(flow.totals.encounters)],
                  ['Average wait', `${flow.wait.averageMinutes} min`],
                  ['Median wait', `${flow.wait.medianMinutes} min`],
                  ['Follow-ups kept', `${flow.followUps.adherenceRate}%`],
                ]}
              />
              <p className="text-[11px] text-ink-secondary">
                {flow.totals.newPatients} new · {flow.totals.returningPatients} returning ·{' '}
                {flow.followUps.kept} of {flow.followUps.due} due follow-ups returned
              </p>
            </Section>
          )}

          <div className="pt-4 border-t border-border text-[10px] text-ink-secondary flex flex-col items-center gap-1.5">
            <p>Generated {new Date().toLocaleString('en-IN')} — figures cover {period}.</p>
            <p className="flex items-center gap-1.5">
              Powered by <BrandLogo className="h-3" />
            </p>
          </div>
        </div>
      </div>
      </div>
    </PrintPortal>
  );
};
