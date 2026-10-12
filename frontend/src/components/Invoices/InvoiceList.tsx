import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { GenerateInvoiceModal } from './GenerateInvoiceModal';
import { PrintableInvoiceModal, InvoiceItem } from './PrintableInvoiceModal';
import { Receipt, Search, Plus, RefreshCw, Printer, Banknote, CreditCard, CheckCircle2, Filter, CalendarDays, Download } from 'lucide-react';
import { exportToCsv } from '../../utils/exportToCsv';
import { Pagination } from '../common/Pagination';
import { LoadingSkeleton } from '../common/LoadingSkeleton';

export const InvoiceList: React.FC = () => {
  const { token, hasRole , apiFetch } = useAuth();
  
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const pageSize = 15;
  
  const [isGenerateOpen, setIsGenerateOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  
  // Filters
  const [reconciledFilter, setReconciledFilter] = useState<'all' | 'pending' | 'reconciled'>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  const { addToast } = useToast();
  const canInvoice = hasRole('RECEPTION', 'MASTER', 'SUPER_ADMIN');
  const canReconcile = hasRole('ACCOUNT', 'MASTER', 'SUPER_ADMIN');

  const fetchInvoices = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (reconciledFilter !== 'all') params.set('reconciled', reconciledFilter === 'reconciled' ? 'true' : 'false');
      if (dateFilter !== 'all') {
        const now = new Date();
        if (dateFilter === 'today') params.set('from', now.toISOString().split('T')[0]);
        else if (dateFilter === 'week') params.set('from', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
        else if (dateFilter === 'month') params.set('from', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
      }
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      const res = await apiFetch(`/api/invoices?${params}`, { signal });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Failed to fetch invoices' }));
        throw new Error(err.message || 'Failed to fetch invoices');
      }
      const result = await res.json();
      if (signal?.aborted) return;
      if (result.data) {
        setInvoices(result.data);
        setTotalInvoices(result.total);
      } else if (Array.isArray(result)) {
        setInvoices(result);
        setTotalInvoices(result.length);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      addToast('error', err.message || 'Failed to load invoices');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, reconciledFilter, dateFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchInvoices(controller.signal);
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, page, reconciledFilter, dateFilter]);

  const handleToggleReconcile = async (id: string) => {
    setReconcilingId(id);
    try {
      const res = await apiFetch(`/api/invoices/${id}/reconcile`, {
        method: 'PATCH',
        });
      if (res.ok) fetchInvoices();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to toggle reconciliation');
    } finally {
      setReconcilingId(null);
    }
  };

  const totalBilledValue = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const pendingCount = invoices.filter((inv) => !inv.reconciled).length;

  return (
    <div className="space-y-6 font-sans text-ink-primary">
      
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-surface-card p-5 rounded-[10px] border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
            <Receipt className="w-4.5 h-4.5 text-brand" /> Billing & GST Invoicing
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            {pendingCount > 0 && <span className="font-medium text-status-warning">{pendingCount} unreconciled.</span>} GST split per Business Rule 4.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-4 h-4 text-ink-secondary/60 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Invoice #, Patient, Item..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-border text-xs focus:outline-none focus:ring-1 focus:ring-brand bg-surface-card"
            />
          </div>

          <button
            onClick={() => exportToCsv('invoices', invoices, [
              { key: 'invoiceNumber', label: 'Invoice #' },
              { key: 'patientName', label: 'Patient Name' },
              { key: 'patientUhid', label: 'UHID' },
              { key: 'itemTitle', label: 'Item' },
              { key: 'discountAmount', label: 'Discount' },
              { key: 'discountReason', label: 'Discount Reason' },
              { key: 'taxableValue', label: 'Taxable' },
              { key: 'totalAmount', label: 'Total' },
              { key: 'paymentMethod', label: 'Payment' },
              { key: 'reconciled', label: 'Reconciled', format: (v: boolean) => v ? 'Yes' : 'No' },
              { key: 'issuedAt', label: 'Date' },
            ])}
            className="p-2 rounded-md text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border transition-colors cursor-pointer shrink-0"
            title="Export to CSV"
          >
            <Download className="w-4 h-4" />
          </button>

          {canInvoice && (
            <button
              onClick={() => setIsGenerateOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Generate Invoice</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <Filter className="w-3.5 h-3.5 text-ink-secondary" />
          {(['all', 'pending', 'reconciled'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setReconciledFilter(f)}
              className={`px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                reconciledFilter === f
                  ? 'bg-brand text-white border-brand font-semibold'
                  : 'bg-surface-card text-ink-secondary border-border hover:bg-surface-page'
              }`}
            >
              {f === 'all' ? 'All' : f === 'pending' ? 'Unreconciled' : 'Reconciled'}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5 text-xs font-medium">
          <CalendarDays className="w-3.5 h-3.5 text-ink-secondary" />
          {(['all', 'today', 'week', 'month'] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className={`px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                dateFilter === d
                  ? 'bg-brand text-white border-brand font-semibold'
                  : 'bg-surface-card text-ink-secondary border-border hover:bg-surface-page'
              }`}
            >
              {d === 'all' ? 'All Time' : d.charAt(0).toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>
        <div className="ml-auto text-xs text-ink-secondary font-mono">
          {totalInvoices} total &bull; ₹{totalBilledValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      </div>

      {/* Invoices Data Table */}
      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : invoices.length === 0 ? (
        <div className="bg-surface-card rounded-[10px] border border-border p-12 text-center space-y-2 shadow-xs">
          <p className="text-sm font-semibold text-ink-primary">No invoices found</p>
          <p className="text-xs text-ink-secondary">Try adjusting your filters or generate a new invoice.</p>
        </div>
      ) : (
        <div className="bg-surface-card rounded-[10px] border border-border overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-page border-b border-border text-ink-secondary font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Patient (UHID)</th>
                  <th className="py-3 px-4">Billed Item</th>
                  <th className="py-3 px-4 text-right">Taxable</th>
                  <th className="py-3 px-4 text-right">CGST/SGST</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface-page/60 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-brand-deep">{inv.invoiceNumber}</td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-ink-primary">{inv.patientName}</div>
                      <div className="font-mono text-[11px] text-ink-secondary">{inv.patientUhid}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-ink-primary">{inv.itemTitle}</div>
                      {Number(inv.discountAmount ?? 0) > 0 && (
                        <div className="text-[10px] font-semibold text-status-warning" title={inv.discountReason || undefined}>
                          Discount ₹{Number(inv.discountAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          {inv.discountReason ? ` · ${inv.discountReason}` : ''}
                        </div>
                      )}
                      <span className={`text-[10px] font-bold ${inv.isGstTaxable ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {inv.isGstTaxable ? 'GST Taxable' : 'GST Exempt'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">₹{inv.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 px-4 text-right font-mono text-ink-secondary">
                      {inv.isGstTaxable ? `₹${inv.cgst.toFixed(2)} / ₹${inv.sgst.toFixed(2)}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold font-mono">₹{inv.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 capitalize text-ink-secondary">
                        {inv.paymentMethod === 'bank' ? <CreditCard className="w-3 h-3 text-sky-600" /> : <Banknote className="w-3 h-3 text-emerald-600" />}
                        {inv.paymentMethod}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                        inv.reconciled
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-50 text-amber-800 border border-amber-200'
                      }`}>
                        {inv.reconciled ? 'Reconciled' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="p-1.5 rounded text-ink-secondary hover:text-ink-primary hover:bg-surface-page border border-border transition-colors cursor-pointer"
                          title="View invoice"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        {canReconcile && (
                          <button
                            onClick={() => handleToggleReconcile(inv.id)}
                            disabled={reconcilingId === inv.id}
                            className={`p-1.5 rounded border border-border transition-colors cursor-pointer disabled:opacity-50 ${
                              inv.reconciled
                                ? 'text-amber-700 hover:bg-amber-50'
                                : 'text-emerald-700 hover:bg-emerald-50'
                            }`}
                            title={inv.reconciled ? 'Mark as unreconciled' : 'Mark as reconciled'}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {!loading && invoices.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={totalInvoices} onPageChange={setPage} />
      )}

      <GenerateInvoiceModal
        isOpen={isGenerateOpen}
        onClose={() => setIsGenerateOpen(false)}
        onInvoiceGenerated={fetchInvoices}
      />

      <PrintableInvoiceModal
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />

    </div>
  );
};
