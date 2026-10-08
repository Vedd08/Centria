/** Response shapes from `/api/analytics/*`, shared by the dashboard and the report. */

export interface RevenueStats {
  totalRevenue: number;
  totalInvoices: number;
  averagePerInvoice: number;
  monthlyBreakdown: { month: string; total: number; count: number }[];
}

export interface PatientStats {
  totalPatients: number;
  genderDistribution: { Male: number; Female: number; Other: number };
  monthlyRegistrations: { month: string; count: number }[];
}

export interface TreatmentStats {
  totalVisits: number;
  newVisits: number;
  followUpVisits: number;
  topTreatments: { name: string; count: number; revenue: number }[];
  referralSources: { source: string; count: number }[];
}

export interface Collections {
  from: string;
  to: string;
  totals: { cash: number; bank: number; total: number; count: number };
  daily: { date: string; cash: number; bank: number; total: number; count: number }[];
  gstByRate: {
    rate: number;
    taxableValue: number;
    cgst: number;
    sgst: number;
    tax: number;
    total: number;
    count: number;
  }[];
  bySource: { source: string; count: number; total: number }[];
  unreconciled: { count: number; amount: number };
}

export interface DoctorPerformance {
  from: string;
  to: string;
  doctors: {
    id: string;
    name: string;
    visits: number;
    revenue: number;
    newVisits: number;
    followUps: number;
    averagePerVisit: number;
    topTreatment: { name: string; count: number } | null;
  }[];
  commissions: { beneficiaryName: string; role: string; amount: number; count: number }[];
  totals: { visits: number; revenue: number; commission: number };
}

export interface PharmacyStats {
  windowDays: number;
  valuation: { retailValue: number; batchCostValue: number; items: number };
  expiry: { bucket: string; quantity: number; value: number }[];
  lowStock: { name: string; stockQty: number; reorderPoint: number; shortfall: number }[];
  topMovers: { name: string; quantity: number }[];
  stagnant: { name: string; stockQty: number; value: number }[];
  dispensingMix: { channel: string; units: number }[];
}

export interface PatientFlow {
  from: string;
  to: string;
  totals: { encounters: number; newPatients: number; returningPatients: number };
  wait: { averageMinutes: number; medianMinutes: number; longestMinutes: number; measured: number };
  daily: { date: string; opd: number; ipd: number; total: number; averageWaitMinutes: number }[];
  statusMix: { status: string; count: number }[];
  followUps: { scheduled: number; due: number; kept: number; adherenceRate: number };
}
