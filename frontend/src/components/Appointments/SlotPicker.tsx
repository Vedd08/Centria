import React from 'react';
import { Clock } from 'lucide-react';

interface Session {
  startTime: string;
  endTime: string;
  slotDurationInMinutes: number;
}

interface SlotPickerProps {
  availableSlots: string[];
  sessions: Session[];
  selectedSlot: string;
  onSelectSlot: (slot: string) => void;
  loading?: boolean;
  doctorName?: string;
  dateStr?: string;
}

export const SlotPicker: React.FC<SlotPickerProps> = ({
  availableSlots,
  sessions,
  selectedSlot,
  onSelectSlot,
  loading,
  doctorName,
  dateStr
}) => {
  if (loading) {
    return (
      <div className="w-full px-3 py-4 rounded-md border border-border text-xs bg-surface-card text-ink-secondary text-center">
        Loading slots...
      </div>
    );
  }

  if (sessions.length === 0) {
    // We need to show "no session on <weekday>"
    const d = dateStr ? new Date(dateStr) : new Date();
    const weekday = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'][d.getDay()];
    return (
      <div className="w-full px-3 py-4 rounded-md border border-status-danger/30 text-xs bg-status-danger/5 text-status-danger text-center">
        {doctorName ? `Dr. ${doctorName}` : 'This doctor'} has no session on {weekday}.
      </div>
    );
  }

  if (availableSlots.length === 0) {
    return (
      <div className="w-full px-3 py-4 rounded-md border border-status-danger/30 text-xs bg-status-danger/5 text-status-danger text-center">
        All slots are fully booked for this date.
      </div>
    );
  }

  // Group slots by session
  const groups: { session: Session; slots: string[] }[] = sessions.map(s => ({ session: s, slots: [] }));
  
  for (const slot of availableSlots) {
    const [h, m] = slot.split(':').map(Number);
    const slotMins = h * 60 + m;
    
    // Find which session this slot belongs to
    for (const group of groups) {
      const [sh, sm] = group.session.startTime.split(':').map(Number);
      const [eh, em] = group.session.endTime.split(':').map(Number);
      const sMins = sh * 60 + sm;
      const eMins = eh * 60 + em;
      
      if (slotMins >= sMins && slotMins < eMins) {
        group.slots.push(slot);
        break;
      }
    }
  }

  return (
    <div className="space-y-4">
      {groups.filter(g => g.slots.length > 0).map((group, idx) => {
        const [sh] = group.session.startTime.split(':').map(Number);
        const label = sh < 12 ? 'Morning' : sh < 16 ? 'Afternoon' : 'Evening';
        return (
          <div key={idx}>
            <div className="text-[11px] font-bold text-ink-secondary uppercase mb-2 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {label} Session ({group.session.startTime} - {group.session.endTime}) • {group.session.slotDurationInMinutes} min
            </div>
            <div className="flex flex-wrap gap-2">
              {group.slots.map(slot => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onSelectSlot(slot)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                    selectedSlot === slot
                      ? 'bg-brand text-white border-brand shadow-xs'
                      : 'bg-surface-card text-ink-primary border-border hover:border-brand/50 hover:bg-surface-page'
                  }`}
                >
                  {slot}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
