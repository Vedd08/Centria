import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { StatusBadge } from '../common/StatusBadge';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { AddMedicationOrderModal } from './AddMedicationOrderModal';
import { Pill, Plus, ChevronDown, ChevronRight, Check, Ban } from 'lucide-react';

interface Administration {
  id: string;
  administeredAt: string;
  status: string;
  notes?: string;
  administeredBy?: { name: string; role: string };
}

interface MedicationOrder {
  id: string;
  dosage: string;
  route: string;
  frequency: string;
  instructions?: string;
  startDate: string;
  endDate?: string;
  status: string;
  discontinuedReason?: string;
  medicine: { name: string; unit: string };
  doctor?: { name: string };
}

interface MedicationChartProps {
  admissionId: string;
  /** Discharged admissions are read-only. */
  isActiveAdmission: boolean;
}

const administrationVariant = (status: string) =>
  status === 'Given' ? 'success' : status === 'Refused' ? 'danger' : 'warning';

export const MedicationChart: React.FC<MedicationChartProps> = ({ admissionId, isActiveAdmission }) => {
  const { apiFetch, hasRole } = useAuth();
  const { addToast } = useToast();
  const [orders, setOrders] = useState<MedicationOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddOrder, setShowAddOrder] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [administrations, setAdministrations] = useState<Record<string, Administration[]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [discontinueTarget, setDiscontinueTarget] = useState<MedicationOrder | null>(null);
  const [discontinuing, setDiscontinuing] = useState(false);

  const canPrescribe = hasRole('DOCTOR');
  const canAdminister = hasRole('DOCTOR', 'NURSE');

  const fetchOrders = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/medication-orders?admissionId=${admissionId}`, { signal });
      if (!res.ok) throw new Error('Failed to load the medication chart');
      const result = await res.json();
      if (signal?.aborted) return;
      setOrders(Array.isArray(result) ? result : result.data || []);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      addToast('error', err.message || 'Failed to load the medication chart');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchOrders(controller.signal);
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId]);

  const loadAdministrations = async (orderId: string) => {
    try {
      const res = await apiFetch(`/api/medication-orders/${orderId}/administrations`);
      if (!res.ok) throw new Error('Failed to load administration history');
      const result = await res.json();
      setAdministrations((prev) => ({ ...prev, [orderId]: Array.isArray(result) ? result : result.data || [] }));
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load administration history');
    }
  };

  const toggleExpand = (orderId: string) => {
    if (expandedId === orderId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(orderId);
    if (!administrations[orderId]) loadAdministrations(orderId);
  };

  const markAdministered = async (order: MedicationOrder, status: 'Given' | 'Missed' | 'Refused') => {
    setBusyId(order.id);
    try {
      const res = await apiFetch(`/api/medication-orders/${order.id}/administrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to record administration' }));
        throw new Error(err.message || 'Failed to record administration');
      }
      addToast('success', `${order.medicine.name} recorded as ${status.toLowerCase()}`);
      await loadAdministrations(order.id);
      setExpandedId(order.id);
    } catch (err: any) {
      addToast('error', err.message || 'Failed to record administration');
    } finally {
      setBusyId(null);
    }
  };

  const handleDiscontinue = async () => {
    if (!discontinueTarget) return;
    setDiscontinuing(true);
    try {
      const res = await apiFetch(`/api/medication-orders/${discontinueTarget.id}/discontinue`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discontinuedReason: 'Discontinued by doctor from the ward chart' }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to discontinue order' }));
        throw new Error(err.message || 'Failed to discontinue order');
      }
      addToast('success', `${discontinueTarget.medicine.name} discontinued`);
      setDiscontinueTarget(null);
      fetchOrders();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to discontinue order');
    } finally {
      setDiscontinuing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-secondary">
          Active drug chart — ward staff record each dose here so the care team can see what has been given.
        </p>
        {canPrescribe && isActiveAdmission && (
          <button
            onClick={() => setShowAddOrder(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Order</span>
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSkeleton rows={3} />
      ) : orders.length === 0 ? (
        <div className="text-ink-secondary text-xs py-8 text-center bg-surface-page rounded-lg border border-border">
          No medications ordered for this admission yet.
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => {
            const isExpanded = expandedId === order.id;
            const orderAdministrations = administrations[order.id] || [];
            return (
              <div key={order.id} className="bg-surface-page rounded-lg border border-border overflow-hidden">
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={() => toggleExpand(order.id)}
                      className="flex items-start gap-2 text-left cursor-pointer flex-1"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-ink-secondary/70 mt-0.5 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-ink-secondary/70 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <span className="text-xs font-semibold text-ink-primary flex items-center gap-1.5">
                          <Pill className="w-3.5 h-3.5 text-brand" />
                          {order.medicine.name}
                        </span>
                        <p className="text-[11px] text-ink-secondary mt-0.5">
                          {order.dosage} &bull; {order.route} &bull; {order.frequency}
                          {order.instructions ? ` — ${order.instructions}` : ''}
                        </p>
                        <p className="text-[10px] text-ink-secondary/70 mt-0.5">
                          From {order.startDate}
                          {order.endDate ? ` to ${order.endDate}` : ''}
                          {order.doctor ? ` • Ordered by Dr. ${order.doctor.name}` : ''}
                        </p>
                      </div>
                    </button>
                    <StatusBadge
                      label={order.status}
                      variant={order.status === 'ACTIVE' ? 'success' : 'neutral'}
                    />
                  </div>

                  {order.status === 'ACTIVE' && isActiveAdmission && (
                    <div className="flex flex-wrap items-center gap-1.5 pl-6">
                      {canAdminister && (
                        <>
                          <button
                            onClick={() => markAdministered(order, 'Given')}
                            disabled={busyId === order.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-status-success bg-status-success/10 hover:bg-status-success/20 border border-status-success/20 rounded cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3 h-3" /> Mark Given
                          </button>
                          <button
                            onClick={() => markAdministered(order, 'Missed')}
                            disabled={busyId === order.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-status-warning bg-status-warning/10 hover:bg-status-warning/20 border border-status-warning/20 rounded cursor-pointer disabled:opacity-50"
                          >
                            Missed
                          </button>
                          <button
                            onClick={() => markAdministered(order, 'Refused')}
                            disabled={busyId === order.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/20 rounded cursor-pointer disabled:opacity-50"
                          >
                            Refused
                          </button>
                        </>
                      )}
                      {canPrescribe && (
                        <button
                          onClick={() => setDiscontinueTarget(order)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-ink-secondary bg-surface-card hover:bg-surface-page border border-border rounded cursor-pointer ml-auto"
                        >
                          <Ban className="w-3 h-3" /> Discontinue
                        </button>
                      )}
                    </div>
                  )}

                  {order.status === 'DISCONTINUED' && order.discontinuedReason && (
                    <p className="text-[11px] text-ink-secondary/70 pl-6 italic">
                      Discontinued: {order.discontinuedReason}
                    </p>
                  )}
                </div>

                {isExpanded && (
                  <div className="border-t border-border bg-surface-card p-3">
                    <p className="text-[11px] font-semibold text-ink-secondary mb-2">Administration history</p>
                    {orderAdministrations.length === 0 ? (
                      <p className="text-[11px] text-ink-secondary/70">No doses recorded yet.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {orderAdministrations.map((admin) => (
                          <li key={admin.id} className="flex items-center justify-between text-[11px]">
                            <span className="text-ink-secondary">
                              {new Date(admin.administeredAt).toLocaleString()}
                              {admin.administeredBy ? ` • ${admin.administeredBy.name}` : ''}
                              {admin.notes ? ` — ${admin.notes}` : ''}
                            </span>
                            <StatusBadge label={admin.status} variant={administrationVariant(admin.status)} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AddMedicationOrderModal
        isOpen={showAddOrder}
        admissionId={admissionId}
        onClose={() => setShowAddOrder(false)}
        onOrderCreated={fetchOrders}
      />

      <ConfirmDialog
        isOpen={!!discontinueTarget}
        title="Discontinue Medication"
        message={`Stop ${discontinueTarget?.medicine.name} for this patient? Ward staff will no longer be prompted to administer it.`}
        confirmLabel="Discontinue"
        variant="warning"
        loading={discontinuing}
        onConfirm={handleDiscontinue}
        onCancel={() => setDiscontinueTarget(null)}
      />
    </div>
  );
};
