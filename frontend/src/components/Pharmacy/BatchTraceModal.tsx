import React, { useState, useEffect } from 'react';
import { X, Search, CheckCircle, Package, Receipt, Stethoscope, ArrowRight, Truck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { money } from '../Queue/types';

interface BatchTraceModalProps {
  batchId?: string; // If provided, fetch immediately.
  onClose: () => void;
}

export const BatchTraceModal: React.FC<BatchTraceModalProps> = ({ batchId, onClose }) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  
  const [searchId, setSearchId] = useState(batchId || '');
  const [loading, setLoading] = useState(!!batchId);
  const [data, setData] = useState<any>(null);

  const fetchTrace = async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiFetch(`/api/medicines/batches/${id}/trace`);
      if (res.ok) {
        setData(await res.json());
      } else {
        addToast('error', 'Batch not found');
        setData(null);
      }
    } catch (err) {
      addToast('error', 'Failed to fetch trace data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (batchId) {
      fetchTrace(batchId);
    }
  }, [batchId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTrace(searchId);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-surface-card w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 bg-brand text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Search className="w-5 h-5" /> Batch Traceability
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-border bg-surface-page">
          <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
            <input 
              type="text"
              value={searchId}
              onChange={e => setSearchId(e.target.value)}
              placeholder="Enter Batch ID..."
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:ring-1 focus:ring-brand outline-none"
            />
            <button type="submit" className="px-4 py-2 bg-ink-primary hover:bg-ink-primary/90 text-white text-sm font-semibold rounded-lg shadow-sm">
              Trace
            </button>
          </form>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <LoadingSkeleton rows={5} />
          ) : !data ? (
            <div className="py-12 text-center text-ink-secondary">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Enter a Batch ID to see its full lifecycle.</p>
            </div>
          ) : (
            <div className="space-y-8">
              
              {/* Summary Card */}
              <div className="bg-brand-soft/30 rounded-xl border border-brand/20 p-5 flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h3 className="text-xl font-bold text-ink-primary">{data.medicine.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-sm font-medium text-ink-secondary">
                    <span className="px-2 py-0.5 rounded bg-surface-card border border-border text-xs uppercase tracking-wider">
                      Batch {data.batchNumber}
                    </span>
                    <span>Expires: {data.expiryDate}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-widest text-ink-secondary font-semibold">Stock State</p>
                  <p className="text-lg font-bold text-ink-primary">
                    {data.currentQty} <span className="text-sm font-normal text-ink-secondary">/ {data.originalQty} remaining</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Purchase Info (Origin) */}
                <div className="bg-surface-card rounded-xl border border-border p-5 shadow-sm">
                  <h4 className="text-sm font-bold text-ink-primary flex items-center gap-2 mb-4">
                    <Truck className="w-4 h-4 text-emerald-500" /> Source (Wholesaler)
                  </h4>
                  {data.purchase ? (
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-ink-secondary">Supplier</span>
                        <span className="font-medium text-ink-primary">{data.purchase.vendorName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-secondary">Invoice #</span>
                        <span className="font-mono text-ink-primary">{data.purchase.invoiceNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-secondary">Invoice Date</span>
                        <span className="font-medium text-ink-primary">{data.purchase.invoiceDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-secondary">Received By</span>
                        <span className="font-medium text-ink-primary">{data.purchase.recordedBy?.name || 'System'}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-ink-secondary italic">Opening stock / Legacy batch</p>
                  )}
                </div>

                {/* Dispense Log (Destination) */}
                <div className="bg-surface-card rounded-xl border border-border p-5 shadow-sm flex flex-col max-h-[300px]">
                  <h4 className="text-sm font-bold text-ink-primary flex items-center gap-2 mb-4 shrink-0">
                    <ArrowRight className="w-4 h-4 text-brand" /> Dispensed To
                  </h4>
                  <div className="overflow-y-auto space-y-3 pr-2">
                    {data.dispenseRecords && data.dispenseRecords.length > 0 ? (
                      data.dispenseRecords.map((dr: any) => (
                        <div key={dr.id} className="p-3 rounded-lg bg-surface-page border border-border text-sm">
                          <div className="flex justify-between items-start mb-1">
                            <span className="font-bold text-ink-primary">-{dr.quantity} {data.medicine.unit}</span>
                            <span className="text-[10px] text-ink-secondary font-mono">{new Date(dr.createdAt).toLocaleString()}</span>
                          </div>
                          
                          {dr.retailSaleItem ? (
                            <div className="flex items-center gap-1.5 text-xs text-ink-secondary mt-1">
                              <Receipt className="w-3.5 h-3.5" /> 
                              Retail POS 
                              <span className="text-ink-primary font-medium ml-1">
                                {dr.retailSaleItem.retailSale.customerName}
                              </span>
                            </div>
                          ) : dr.careOrder ? (
                            <div className="flex items-center gap-1.5 text-xs text-ink-secondary mt-1">
                              <Stethoscope className="w-3.5 h-3.5" />
                              Care Order for 
                              <span className="text-ink-primary font-medium ml-1">
                                {dr.careOrder.queue?.patient?.name || 'Unknown Patient'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-ink-secondary italic">Unknown Destination</span>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-ink-secondary py-4 text-center">No stock dispensed from this batch yet.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
