import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, Clock, CalendarX2, ArrowRight } from 'lucide-react';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { money } from '../Queue/types';
import { BatchTraceModal } from './BatchTraceModal';

export const ExpiryDashboard: React.FC = () => {
  const { apiFetch } = useAuth();
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(90);
  const [tracingBatchId, setTracingBatchId] = useState<string | null>(null);

  useEffect(() => {
    const fetchExpiring = async () => {
      try {
        setLoading(true);
        const res = await apiFetch(`/api/medicines/batches/expiring?days=${days}`);
        if (res.ok) {
          setBatches(await res.json());
        }
      } catch (err) {
        console.error('Failed to load expiring batches', err);
      } finally {
        setLoading(false);
      }
    };
    fetchExpiring();
  }, [apiFetch, days]);

  const now = new Date();
  const unknownBatches = batches.filter(b => !b.expiryDate);
  const datedBatches = batches.filter(b => b.expiryDate);
  
  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex items-center justify-between bg-surface-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex items-center gap-2">
          <CalendarX2 className="w-5 h-5 text-status-danger" />
          <h2 className="text-lg font-bold text-ink-primary">Expiry Dashboard</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setTracingBatchId('')}
            className="px-3 py-1.5 text-sm font-semibold text-brand border border-brand/20 bg-brand-soft hover:bg-brand/10 rounded-lg transition-colors mr-2 cursor-pointer"
          >
            Trace a Batch
          </button>
          <select 
            value={days} 
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-3 py-1.5 border border-border rounded-lg bg-surface-page text-sm font-medium focus:ring-1 focus:ring-brand outline-none"
          >
            <option value={30}>Expiring in 30 Days</option>
            <option value={60}>Expiring in 60 Days</option>
            <option value={90}>Expiring in 90 Days</option>
            <option value={180}>Expiring in 6 Months</option>
            <option value={365}>Expiring in 1 Year</option>
          </select>
        </div>
      </div>

      {!loading && unknownBatches.length > 0 && (
        <div className="bg-surface-card rounded-xl border border-status-warning shadow-sm overflow-hidden mb-6">
          <div className="px-4 py-3 bg-status-warning/10 border-b border-status-warning/20">
            <h3 className="font-bold text-status-warning-deep flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Expiry unknown — verify
            </h3>
            <p className="text-xs text-ink-secondary mt-1">
              These batches have stock but no expiry date was recorded. Verify and update them to prevent silent expiration.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-page/30 text-ink-secondary text-xs">
                <tr>
                  <th className="px-4 py-2 font-semibold">Medicine</th>
                  <th className="px-4 py-2 font-semibold">Batch No.</th>
                  <th className="px-4 py-2 font-semibold text-right">Qty Left</th>
                  <th className="px-4 py-2 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {unknownBatches.map(batch => (
                  <tr key={batch.id} className="hover:bg-surface-page/50">
                    <td className="px-4 py-2 font-semibold text-ink-primary">
                      {batch.medicine.name}
                      <span className="block text-[10px] font-normal text-ink-secondary">Shelf: {batch.medicine.shelf || 'N/A'}</span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{batch.batchNumber}</td>
                    <td className="px-4 py-2 text-right font-medium">
                      {batch.currentQty} <span className="text-xs text-ink-secondary">{batch.medicine.unit}</span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => setTracingBatchId(batch.id)}
                        className="px-2 py-1 text-xs font-semibold text-ink-secondary hover:text-brand hover:bg-brand-soft rounded transition-colors cursor-pointer"
                      >
                        Trace
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : datedBatches.length === 0 ? (
        <div className="bg-surface-card rounded-xl border border-border p-12 text-center text-ink-secondary">
          <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p className="font-semibold text-ink-primary">No batches expiring within {days} days.</p>
        </div>
      ) : (
        <div className="bg-surface-card rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-page/50 text-ink-secondary">
                <tr>
                  <th className="px-4 py-3 font-semibold">Medicine</th>
                  <th className="px-4 py-3 font-semibold">Batch No.</th>
                  <th className="px-4 py-3 font-semibold">Supplier</th>
                  <th className="px-4 py-3 font-semibold text-right">Qty Left</th>
                  <th className="px-4 py-3 font-semibold text-right">Value at Risk</th>
                  <th className="px-4 py-3 font-semibold">Expiry Date</th>
                  <th className="px-4 py-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {datedBatches.map(batch => {
                  const expDate = new Date(batch.expiryDate);
                  const isExpired = expDate < now;
                  const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
                  const valueRisk = batch.currentQty * Number(batch.costPrice);
                  
                  return (
                    <tr key={batch.id} className={isExpired ? "bg-status-danger/5" : "hover:bg-surface-page/50"}>
                      <td className="px-4 py-3 font-semibold text-ink-primary">
                        {batch.medicine.name}
                        <span className="block text-xs font-normal text-ink-secondary">Shelf: {batch.medicine.shelf || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{batch.batchNumber}</td>
                      <td className="px-4 py-3 text-ink-secondary">
                        {batch.purchase?.vendorName || 'Unknown'}
                        <span className="block text-[10px]">Inv: {batch.purchase?.invoiceNumber || 'N/A'}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {batch.currentQty} <span className="text-xs text-ink-secondary">{batch.medicine.unit}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-ink-secondary">
                        {money(valueRisk)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {batch.expiryDate}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setTracingBatchId(batch.id)}
                            className="px-2 py-1 text-xs font-semibold text-ink-secondary hover:text-brand hover:bg-brand-soft rounded transition-colors cursor-pointer"
                          >
                            Trace
                          </button>
                          {isExpired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-status-danger/10 text-status-danger text-xs font-bold w-[90px] justify-center">
                              <AlertTriangle className="w-3 h-3" /> EXPIRED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-status-warning/10 text-status-warning-deep text-xs font-bold w-[90px] justify-center">
                              <Clock className="w-3 h-3" /> {daysLeft} Days
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tracingBatchId !== null && (
        <BatchTraceModal 
          batchId={tracingBatchId || undefined} 
          onClose={() => setTracingBatchId(null)} 
        />
      )}
    </div>
  );
};
