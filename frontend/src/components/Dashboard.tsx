import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { StatusBadge } from './common/StatusBadge';
import { useClinicProfile } from '../hooks/useClinicProfile';
import {
  Sun,
  CloudSun,
  Moon,
  Calendar as CalendarIcon,
  Receipt,
  AlertTriangle,
  Clock,
  RefreshCw,
  TrendingUp,
  CalendarDays,
} from 'lucide-react';

interface MetricState {
  todayVisitsCount: number;
  todayRevenueSum: number;
  unreconciledInvoicesCount: number;
  lowStockMedicinesCount: number;
}

interface VisitItem {
  id: string;
  date: string;
  patientName: string;
  patientUhid?: string;
  treatmentName: string;
  doctorName: string;
  status: string;
  treatmentPrice: number;
  nextAppointmentDate?: string;
}

export const Dashboard: React.FC = () => {
  const { user, token, apiFetch } = useAuth();
  const { addToast } = useToast();
  const clinic = useClinicProfile();
  const [metrics, setMetrics] = useState<MetricState>({
    todayVisitsCount: 0,
    todayRevenueSum: 0,
    unreconciledInvoicesCount: 0,
    lowStockMedicinesCount: 0,
  });
  const [todayVisits, setTodayVisits] = useState<VisitItem[]>([]);
  const [upcomingAppointments, setUpcomingAppointments] = useState<VisitItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 3-State Time Greeting & Matching Icon
  const now = new Date();
  const currentHour = now.getHours();
  let greetingText = 'Good morning';
  let GreetingIcon = Sun;

  if (currentHour >= 12 && currentHour < 17) {
    greetingText = 'Good afternoon';
    GreetingIcon = CloudSun;
  } else if (currentHour >= 17) {
    greetingText = 'Good evening';
    GreetingIcon = Moon;
  }

  const firstName = user?.name ? user.name.split(' ')[0] : 'Doctor';

  const formattedDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const fetchDashboardData = async (signal?: AbortSignal) => {
    if (!token) return;
    setLoading(true);
    try {
      const todayISO = new Date().toISOString().split('T')[0];

      const [visitsRes, invoicesRes, medicinesRes] = await Promise.allSettled([
        apiFetch('/api/visits', { signal }),
        apiFetch('/api/invoices', { signal }),
        apiFetch('/api/medicines', { signal }),
      ]);

      let todayVisitsList: VisitItem[] = [];
      let futureVisitsList: VisitItem[] = [];
      let todayVisitsCount = 0;
      let todayRevenueSum = 0;
      let unreconciledInvoicesCount = 0;
      let lowStockMedicinesCount = 0;

      if (visitsRes.status === 'fulfilled' && visitsRes.value.ok) {
        const result = await visitsRes.value.json();
        const visits = Array.isArray(result) ? result : (result.data || []);
        todayVisitsList = visits.filter((v: any) => v.date === todayISO);
        todayVisitsCount = todayVisitsList.length;

        // Upcoming appointments: visits in the future with nextAppointmentDate set
        futureVisitsList = visits
          .filter((v: any) => v.nextAppointmentDate && v.nextAppointmentDate >= todayISO)
          .slice(0, 5);
      }

      if (invoicesRes.status === 'fulfilled' && invoicesRes.value.ok) {
        const result = await invoicesRes.value.json();
        const invoices = Array.isArray(result) ? result : (result.data || []);
        invoices.forEach((inv: any) => {
          const invDate = inv.issuedAt ? inv.issuedAt.split('T')[0] : '';
          if (invDate === todayISO) {
            todayRevenueSum += Number(inv.totalAmount) || 0;
          }
          if (inv.reconciled === false) {
            unreconciledInvoicesCount += 1;
          }
        });
      }

      if (medicinesRes.status === 'fulfilled' && medicinesRes.value.ok) {
        const result = await medicinesRes.value.json();
        const medicines = Array.isArray(result) ? result : (result.data || []);
        lowStockMedicinesCount = medicines.filter(
          (m: any) => (m.stockQty ?? 0) <= (m.reorderPoint ?? 10)
        ).length;
      }

      setMetrics({
        todayVisitsCount,
        todayRevenueSum,
        unreconciledInvoicesCount,
        lowStockMedicinesCount,
      });
      setTodayVisits(todayVisitsList);
      setUpcomingAppointments(futureVisitsList);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      addToast('error', err.message || 'Failed to load dashboard data');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchDashboardData(controller.signal);
    return () => controller.abort();
  }, [token]);

  const getInitials = (name: string) => {
    if (!name) return 'PT';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const getAvatarStyles = (index: number) => {
    const cycle = index % 3;
    if (cycle === 0) return 'bg-brand-soft text-brand-deep border-brand/20';
    if (cycle === 1) return 'bg-tint2-bg text-tint2-text border-tint2-text/20';
    return 'bg-tint3-bg text-tint3-text border-tint3-text/20';
  };

  if (!user) return null;

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-ink-primary tracking-tight">
          {clinic ? `${clinic.name} Dashboard` : 'Dashboard'}
        </h1>
        <button
          onClick={() => fetchDashboardData()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-ink-secondary hover:text-ink-primary bg-surface-card border border-border shadow-xs transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* 1. Welcome Banner */}
      <div className="bg-brand-soft rounded-[16px] p-4 sm:p-6 text-brand-deep border border-brand/20 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <GreetingIcon className="w-5 h-5 text-brand-deep shrink-0" />
            <h2 className="text-xl font-bold tracking-tight text-ink-primary">
              {greetingText}, {firstName}
            </h2>
          </div>
          <p className="text-xs text-ink-secondary font-medium">
            {formattedDate} &bull;{' '}
            <span className="font-semibold text-brand-deep font-mono">
              {metrics.todayVisitsCount}
            </span>{' '}
            visits scheduled today
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-white/80 text-brand-deep border border-brand/20 shadow-xs">
            Role: {user.role}
          </span>
        </div>
      </div>

      {/* 2. Unified Stats Card */}
      <div className="bg-surface-card rounded-[10px] border border-border p-3 sm:p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 md:flex md:flex-row gap-2 sm:gap-0 divide-y-0 md:divide-y-0 md:divide-x divide-border/60">
        <div className="flex-1 p-3 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-brand-soft text-brand-deep flex items-center justify-center shrink-0 border border-brand/20">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-ink-secondary">Today's Visits</div>
            <div className="text-[22px] font-bold text-ink-primary font-mono leading-tight">
              {metrics.todayVisitsCount}
            </div>
          </div>
        </div>

        <div className="flex-1 p-3 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-tint3-bg text-tint3-text flex items-center justify-center shrink-0 border border-tint3-text/20">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-ink-secondary">Today's Revenue</div>
            <div className="text-[22px] font-bold text-ink-primary font-mono leading-tight">
              ₹{metrics.todayRevenueSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <div className="flex-1 p-3 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-tint2-bg text-tint2-text flex items-center justify-center shrink-0 border border-tint2-text/20">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-ink-secondary">Unreconciled Invoices</div>
            <div className="text-[22px] font-bold text-ink-primary font-mono leading-tight">
              {metrics.unreconciledInvoicesCount}
            </div>
          </div>
        </div>

        <div className="flex-1 p-3 flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-lg bg-status-danger/10 text-status-danger flex items-center justify-center shrink-0 border border-status-danger/20">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-medium text-ink-secondary">Low-Stock Items</div>
            <div className="text-[22px] font-bold text-ink-primary font-mono leading-tight">
              {metrics.lowStockMedicinesCount}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Two-column layout: Today's Visits + Upcoming Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Visits */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-primary tracking-tight">
              Today's Scheduled Visits
            </h3>
            <span className="text-xs text-ink-secondary font-mono">{todayVisits.length} Records</span>
          </div>

          {todayVisits.length === 0 ? (
            <div className="bg-surface-card rounded-[10px] border border-border py-8 text-center text-xs text-ink-secondary shadow-xs">
              No visits logged yet today
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {todayVisits.map((visit, index) => (
                <div
                  key={visit.id || index}
                  className="bg-surface-card rounded-[10px] border border-border p-3.5 flex items-center justify-between shadow-xs hover:border-brand/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-xs border shrink-0 ${getAvatarStyles(index)}`}>
                      {getInitials(visit.patientName)}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-ink-primary">{visit.patientName}</div>
                      <div className="text-xs text-ink-secondary flex items-center gap-2">
                        <span>{visit.treatmentName}</span>
                        <span>&bull;</span>
                        <span>Dr. {visit.doctorName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <StatusBadge
                      label={visit.status || 'Scheduled'}
                      variant={visit.status === 'New' ? 'success' : 'accent'}
                    />
                    <div className="font-mono text-xs text-ink-secondary flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-ink-secondary/70" />
                      <span>{visit.date}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Appointments */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-primary tracking-tight">
              Upcoming Appointments
            </h3>
            <span className="text-xs text-ink-secondary font-mono">{upcomingAppointments.length} Scheduled</span>
          </div>

          {upcomingAppointments.length === 0 ? (
            <div className="bg-surface-card rounded-[10px] border border-border py-8 text-center text-xs text-ink-secondary shadow-xs">
              No upcoming appointments scheduled
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {upcomingAppointments.map((visit, index) => (
                <div
                  key={visit.id || index}
                  className="bg-surface-card rounded-[10px] border border-border p-3.5 flex items-center justify-between shadow-xs hover:border-brand/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-brand-soft text-brand-deep flex items-center justify-center font-semibold text-xs border border-brand/20 shrink-0">
                      <CalendarDays className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-ink-primary">{visit.patientName}</div>
                      <div className="text-xs text-ink-secondary flex items-center gap-2">
                        <span>{visit.treatmentName}</span>
                        <span>&bull;</span>
                        <span>Dr. {visit.doctorName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-xs font-semibold text-brand-deep">
                      {visit.nextAppointmentDate || visit.date}
                    </div>
                    <StatusBadge
                      label={visit.status || 'Scheduled'}
                      variant="accent"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
