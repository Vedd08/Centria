import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Clock, Users } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

interface Appointment {
  id: string;
  date: string;
  nextAppointmentDate?: string;
  patientName: string;
  patientUhid: string;
  treatmentName: string;
  doctorName?: string;
  status: string;
}

export const CalendarView: React.FC = () => {
  const { token , apiFetch } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const { addToast } = useToast();
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/visits', {
        });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to fetch appointments' }));
        throw new Error(err.message || 'Failed to fetch appointments');
      }
      const result = await res.json();
      const data = Array.isArray(result) ? result : (result.data || []);
      if (Array.isArray(data)) {
        const mapped = data
          .filter((v: any) => v.nextAppointmentDate || v.date)
          .map((v: any) => ({
            id: v.id,
            date: v.date,
            nextAppointmentDate: v.nextAppointmentDate,
            patientName: v.patient?.name || 'Unknown',
            patientUhid: v.patient?.uhid || '',
            treatmentName: v.treatmentName || 'Treatment',
            doctorName: v.doctor?.name,
            status: v.status || 'Scheduled',
          }));
        setAppointments(mapped);
      }
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAppointments(); }, []);

  const getAppointmentsForDate = (dateStr: string) =>
    appointments.filter((a) => a.nextAppointmentDate === dateStr || a.date === dateStr);

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const todayStr = new Date().toISOString().split('T')[0];
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  const goToday = () => {
    const now = new Date();
    setCurrentMonth(now.getMonth());
    setCurrentYear(now.getFullYear());
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <CalendarDays className="w-4.5 h-4.5 text-brand" /> Appointment Calendar
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            View all scheduled appointments and upcoming visits
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium text-ink-primary bg-surface-page border border-border rounded-md hover:bg-surface-page/80 transition-colors cursor-pointer">
            Today
          </button>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-1.5 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold min-w-[140px] text-center">{monthNames[currentMonth]} {currentYear}</span>
            <button onClick={nextMonth} className="p-1.5 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page cursor-pointer">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button onClick={fetchAppointments} disabled={loading} className="p-1.5 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : (
        <>
          {/* Calendar Grid */}
          <div className="bg-surface-card rounded-[10px] border border-border overflow-hidden shadow-xs">
            <div className="grid grid-cols-7 border-b border-border bg-surface-page">
              {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
                <div key={d} className="py-2.5 text-center text-[11px] font-semibold text-ink-secondary uppercase tracking-wider">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[90px] border-r border-b border-border/60 p-1.5 bg-surface-page/30" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const dayApps = getAppointmentsForDate(dateStr);
                const isToday = dateStr === todayStr;

                return (
                  <div
                    key={day}
                    className={`min-h-[90px] border-r border-b border-border/60 p-1.5 transition-colors ${
                      isToday ? 'bg-brand-soft/40' : 'hover:bg-surface-page/50'
                    }`}
                  >
                    <div className={`text-xs font-semibold mb-1 inline-flex items-center justify-center w-6 h-6 rounded-full ${
                      isToday ? 'bg-brand text-white' : 'text-ink-secondary'
                    }`}>
                      {day}
                    </div>
                    <div className="space-y-0.5">
                      {dayApps.slice(0, 3).map((app) => (
                        <div
                          key={app.id}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-brand-soft text-brand-deep truncate leading-tight cursor-default"
                          title={`${app.patientName} - ${app.treatmentName}`}
                        >
                          {app.patientName}
                        </div>
                      ))}
                      {dayApps.length > 3 && (
                        <div className="text-[9px] text-ink-secondary font-medium px-1">+{dayApps.length - 3} more</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Upcoming Appointments List */}
          {appointments.filter((a) => a.nextAppointmentDate && a.nextAppointmentDate >= todayStr).length > 0 && (
            <div className="bg-surface-card rounded-[10px] border border-border p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-ink-primary flex items-center gap-2">
                <Clock className="w-4 h-4 text-brand" /> Upcoming Scheduled Appointments
              </h3>
              <div className="space-y-2">
                {appointments
                  .filter((a) => a.nextAppointmentDate && a.nextAppointmentDate >= todayStr)
                  .sort((a, b) => (a.nextAppointmentDate || '').localeCompare(b.nextAppointmentDate || ''))
                  .slice(0, 10)
                  .map((app) => (
                    <div key={app.id} className="flex items-center justify-between bg-surface-page p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-soft text-brand-deep flex items-center justify-center font-semibold text-xs border border-brand/20">
                          <Users className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-ink-primary">{app.patientName}</div>
                          <div className="text-xs text-ink-secondary">{app.treatmentName} &bull; {app.doctorName ? `Dr. ${app.doctorName}` : ''}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-xs font-semibold text-brand-deep">{app.nextAppointmentDate}</div>
                        <StatusBadge label={app.status} variant={app.status === 'New' ? 'success' : 'accent'} />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
