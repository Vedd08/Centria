import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer, View, Views } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { CalendarDays, Plus } from 'lucide-react';
import { AppointmentModal } from './AppointmentModal';
import { VisitLoggingModal } from '../Visits/VisitLoggingModal';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export interface Appointment {
  id: string;
  patientId: string;
  patient: { id: string; name: string; uhid: string };
  doctorId: string;
  doctor: { id: string; name: string };
  startTime: string;
  endTime: string;
  status: string;
  reasonForVisit?: string;
}

export const AppointmentsCalendar: React.FC = () => {
  const { hasRole, apiFetch } = useAuth();
  const { addToast } = useToast();
  
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>(Views.WEEK);
  const [date, setDate] = useState(new Date());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [visitModalAppointment, setVisitModalAppointment] = useState<Appointment | null>(null);

  const canManageAppointments = hasRole('RECEPTION', 'RM', 'MASTER', 'SUPER_ADMIN', 'DOCTOR');

  const fetchAppointments = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/appointments', { signal });
      if (!res.ok) throw new Error('Failed to load appointments');
      const data = await res.json();
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      addToast('error', err.message || 'Error loading appointments');
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchAppointments(controller.signal);
    return () => controller.abort();
  }, []);

  const handleSelectSlot = (slotInfo: { start: Date; end: Date }) => {
    if (!canManageAppointments) return;
    setSelectedAppointment(null);
    setSelectedSlot(slotInfo);
    setIsModalOpen(true);
  };

  const handleSelectEvent = (event: any) => {
    setSelectedAppointment(event.resource);
    setSelectedSlot(null);
    setIsModalOpen(true);
  };

  const events = appointments.map((app) => ({
    id: app.id,
    title: `${app.patient?.name} with Dr. ${app.doctor?.name}`,
    start: new Date(app.startTime),
    end: new Date(app.endTime),
    resource: app,
  }));

  const eventStyleGetter = (event: any) => {
    const status = event.resource.status;
    // react-big-calendar takes inline styles, so these mirror the tailwind tokens.
    let backgroundColor = '#0E6193'; // brand
    if (status === 'Checked-In') backgroundColor = '#157F66'; // status.success
    if (status === 'Completed') backgroundColor = '#56657A'; // ink.secondary
    if (status === 'No-Show' || status === 'Cancelled') backgroundColor = '#B3352C'; // status.danger

    return {
      style: {
        backgroundColor,
        borderRadius: '5px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block',
      },
    };
  };

  return (
    <div className="space-y-6 font-sans text-ink-primary h-[calc(100dvh-100px)] min-h-[600px] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-5 rounded-[10px] border border-border shadow-xs shrink-0">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <CalendarDays className="w-4.5 h-4.5 text-brand" /> Advanced Scheduling & Calendar
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Manage daily appointments and staff availability.
          </p>
        </div>

        {canManageAppointments && (
          <button
            onClick={() => {
              setSelectedAppointment(null);
              setSelectedSlot(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>New Appointment</span>
          </button>
        )}
      </div>

      <div className="bg-surface-card rounded-[10px] border border-border shadow-xs p-2 sm:p-4 flex-1 flex flex-col min-h-0 overflow-x-auto">
        {loading ? (
          <LoadingSkeleton rows={10} />
        ) : (
          <div className="min-w-[800px] h-full flex-1 flex flex-col">
            <Calendar
              localizer={localizer}
              events={events}
              startAccessor="start"
              endAccessor="end"
              style={{ flex: 1 }}
              view={view}
              onView={(v) => setView(v)}
              date={date}
              onNavigate={(d) => setDate(d)}
              selectable={canManageAppointments}
              onSelectSlot={handleSelectSlot}
              onSelectEvent={handleSelectEvent}
              eventPropGetter={eventStyleGetter}
              views={[Views.MONTH, Views.WEEK, Views.DAY]}
            />
          </div>
        )}
      </div>

      <AppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={fetchAppointments}
        appointment={selectedAppointment}
        initialSlot={selectedSlot}
        onLogVisit={(app) => {
          setIsModalOpen(false);
          setVisitModalAppointment(app);
        }}
      />

      <VisitLoggingModal
        isOpen={!!visitModalAppointment}
        onClose={() => setVisitModalAppointment(null)}
        onVisitLogged={() => {
          setVisitModalAppointment(null);
          fetchAppointments();
          addToast('success', 'Visit logged successfully!');
        }}
        initialData={{
          patientId: visitModalAppointment?.patientId,
          doctorId: visitModalAppointment?.doctorId,
          date: visitModalAppointment?.startTime ? new Date(visitModalAppointment.startTime).toISOString().split('T')[0] : undefined,
        }}
      />
    </div>
  );
};
