import React, { useEffect, useState, useRef, ReactNode } from 'react';
import { Search, X, Download, Filter, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Pagination } from '../common/Pagination';
import { StatusBadge } from '../common/StatusBadge';
import { exportToCsv } from '../../utils/exportToCsv';
import { money } from '../../utils/money';
import { PatientHistoryPanel } from '../PatientHistory/PatientHistoryPanel';
import { AdmissionDetail } from '../IPD/AdmissionDetail';
import { PrintableInvoiceModal } from '../Invoices/PrintableInvoiceModal';

export type DetailKind =
  | 'patients'
  | 'visits'
  | 'revenue'
  | 'purchases'
  | 'admitted'
  | 'stock'
  | 'lowStock'
  | 'receipts'
  | 'team';

type ColumnDef = {
  key: string;
  label: string;
  render?: (row: any) => ReactNode;
  align?: 'left' | 'right';
};

interface DetailConfig {
  title: string;
  columns: ColumnDef[];
  filters?: ('search' | 'dateRange' | 'tabs')[];
  tabs?: { label: string; value: string }[];
  defaultTab?: string;
  csvName: string;
  onRowClick?: (row: any, trigger: (component: ReactNode) => void) => void;
  fetchPage: (
    apiFetch: any,
    params: { page: number; pageSize: number; search: string; from: string; to: string; tab: string },
    extraState?: string
  ) => Promise<{ rows: any[]; total: number; summary?: any }>;
}

const DETAIL_CONFIG: Record<string, DetailConfig> = {
  patients: {
    title: 'Patient Records',
    csvName: 'patients',
    filters: ['search', 'tabs'],
    tabs: [
      { label: 'All Patients', value: 'all' },
      { label: 'In today\'s queue', value: 'queue' },
    ],
    defaultTab: 'all',
    columns: [
      { key: 'name', label: 'Name', render: (r) => <div className="font-medium">{r.name}<br /><span className="text-[11px] text-ink-secondary">{r.uhid}</span></div> },
      { key: 'phone', label: 'Phone', render: (r) => <span className="font-mono">{r.phone}</span> },
      { key: 'demographics', label: 'Age/Gender', render: (r) => `${r.gender} · ${r.dob || '—'}` },
      { key: 'createdAt', label: 'Registered On', render: (r) => new Date(r.createdAt).toLocaleDateString() },
    ],
    onRowClick: (row, trigger) => trigger(<PatientHistoryPanel patient={row} />),
    fetchPage: async (apiFetch, params) => {
      if (params.tab === 'queue') {
        const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
        const res = await apiFetch(`/api/queue?date=${d}`);
        const data = await res.json();
        return { rows: data.map((q: any) => q.patient), total: data.length };
      } else {
        const res = await apiFetch(`/api/patients?page=${params.page}&pageSize=${params.pageSize}${params.search ? `&search=${encodeURIComponent(params.search)}` : ''}`);
        const data = await res.json();
        return { rows: data.data, total: data.total };
      }
    },
  },
  visits: {
    title: 'Visits & Admissions',
    csvName: 'visits',
    filters: ['dateRange', 'tabs'],
    tabs: [
      { label: 'All', value: 'all' },
      { label: 'OPD', value: 'OPD' },
      { label: 'Admissions', value: 'ADMITTED' },
    ],
    defaultTab: 'all',
    columns: [
      { key: 'date', label: 'Date', render: (r) => <span className="font-mono">{r.date || new Date(r.admissionDate).toISOString().split('T')[0]}</span> },
      { key: 'patient', label: 'Patient', render: (r) => <div className="font-medium">{r.patient?.name}<br/><span className="text-[11px] text-ink-secondary">{r.patient?.uhid}</span></div> },
      { key: 'doctor', label: 'Doctor', render: (r) => r.doctor?.name || r.operator },
      { key: 'type', label: 'Type', render: (r) => <StatusBadge label={r.status === 'ADMITTED' ? 'Admission' : r.visitType} variant={r.status === 'ADMITTED' ? 'warning' : 'accent'} /> },
      { key: 'treatment', label: 'Treatment/Condition', render: (r) => r.treatmentName || r.reasonForAdmission },
      { key: 'status', label: 'Status', render: (r) => r.status },
    ],
    fetchPage: async (apiFetch, params) => {
      if (params.tab === 'ADMITTED') {
        const res = await apiFetch(`/api/admissions?status=ADMITTED&page=${params.page}&pageSize=${params.pageSize}`);
        const data = await res.json();
        return { rows: data.data, total: data.total };
      } else {
        let url = `/api/visits?page=${params.page}&pageSize=${params.pageSize}`;
        if (params.tab !== 'all') url += `&visitType=${params.tab}`;
        if (params.from) url += `&from=${params.from}`;
        if (params.to) url += `&to=${params.to}`;
        
        const res = await apiFetch(url);
        const data = await res.json();
        // Fallback for endpoints that haven't been paginated yet
        if (Array.isArray(data)) {
           return { rows: data.slice((params.page - 1) * params.pageSize, params.page * params.pageSize), total: data.length };
        }
        return { rows: data.data, total: data.total };
      }
    },
  },
  revenue: {
    title: 'Lifetime Revenue',
    csvName: 'revenue',
    filters: ['dateRange'],
    columns: [
      { key: 'date', label: 'Date', render: (r) => <span className="font-mono">{r.date}</span> },
      { key: 'patient', label: 'Patient', render: (r) => <span className="font-medium">{r.patient}</span> },
      { key: 'source', label: 'Source', render: (r) => <span className="capitalize text-ink-secondary">{r.source}</span> },
      { key: 'method', label: 'Method', render: (r) => <span className="capitalize">{r.method}</span> },
      { key: 'amount', label: 'Amount', align: 'right', render: (r) => <span className="font-mono">{money(r.amount)}</span> },
    ],
    fetchPage: async (apiFetch, params) => {
      let url = `/api/admin/revenue?page=${params.page}&pageSize=${params.pageSize}`;
      if (params.from) url += `&from=${params.from}`;
      if (params.to) url += `&to=${params.to}`;
      const res = await apiFetch(url);
      const data = await res.json();
      return { rows: data.data, total: data.total, summary: data.summary };
    },
  },
  purchases: {
    title: 'Stock Purchases',
    csvName: 'purchases',
    filters: ['search'],
    columns: [
      { key: 'date', label: 'Bill Date', render: (r) => <span className="font-mono">{r.invoiceDate}</span> },
      { key: 'supplier', label: 'Supplier', render: (r) => r.vendorName },
      { key: 'billNo', label: 'Bill No', render: (r) => <span className="font-mono">{r.invoiceNumber}</span> },
      { key: 'items', label: 'Items', render: (r) => r.itemDescription },
      { key: 'gst', label: 'GST', align: 'right', render: (r) => <span className="font-mono">{money(Number(r.igst||0) + Number(r.cgst||0) + Number(r.sgst||0))}</span> },
      { key: 'total', label: 'Total', align: 'right', render: (r) => <span className="font-mono font-medium">{money(r.totalValue)}</span> },
    ],
    fetchPage: async (apiFetch, params) => {
      const res = await apiFetch('/api/purchases'); // Unpaginated, so we slice in frontend if needed
      let data = await res.json();
      if (params.search) {
        const q = params.search.toLowerCase();
        data = data.filter((d: any) => d.vendorName.toLowerCase().includes(q) || d.invoiceNumber.toLowerCase().includes(q));
      }
      return { rows: data.slice((params.page - 1) * params.pageSize, params.page * params.pageSize), total: data.length };
    },
  },
  admitted: {
    title: 'Currently Admitted',
    csvName: 'admissions',
    columns: [
      { key: 'patient', label: 'Patient', render: (r) => <div className="font-medium">{r.patient?.name}<br/><span className="text-[11px] text-ink-secondary">{r.patient?.uhid}</span></div> },
      { key: 'wardBed', label: 'Ward / Bed', render: (r) => `${r.bed?.ward?.name} / ${r.bed?.bedNumber}` },
      { key: 'admittedOn', label: 'Admitted On', render: (r) => new Date(r.admissionDate).toLocaleString() },
      { key: 'doctor', label: 'Doctor', render: (r) => r.doctor?.name },
      { key: 'condition', label: 'Condition', render: (r) => r.reasonForAdmission },
    ],
    onRowClick: (row, trigger) => trigger(<AdmissionDetail admission={row} onDischarged={() => trigger(null)} onBack={() => trigger(null)} />),
    fetchPage: async (apiFetch, params) => {
      const res = await apiFetch(`/api/admissions?status=ADMITTED&page=${params.page}&pageSize=${params.pageSize}`);
      const data = await res.json();
      return { rows: data.data, total: data.total };
    },
  },
  stock: {
    title: 'Pharmacy Stock Value',
    csvName: 'stock',
    columns: [
      { key: 'name', label: 'Item Name', render: (r) => <span className="font-medium">{r.name}</span> },
      { key: 'unit', label: 'Unit', render: (r) => r.unit },
      { key: 'qty', label: 'Stock Qty', align: 'right', render: (r) => <span className="font-mono">{r.stockQty}</span> },
      { key: 'price', label: 'Unit Price', align: 'right', render: (r) => <span className="font-mono">{money(r.unitPrice)}</span> },
      { key: 'value', label: 'Value', align: 'right', render: (r) => <span className="font-mono font-medium">{money(r.stockQty * Number(r.unitPrice))}</span> },
      { key: 'reorder', label: 'Reorder Point', align: 'right', render: (r) => <span className="font-mono text-ink-secondary">{r.reorderPoint}</span> },
    ],
    fetchPage: async (apiFetch, params) => {
      const res = await apiFetch('/api/medicines');
      let data = await res.json();
      data.sort((a: any, b: any) => (b.stockQty * Number(b.unitPrice)) - (a.stockQty * Number(a.unitPrice)));
      const sum = data.reduce((a: number, b: any) => a + (b.stockQty * Number(b.unitPrice)), 0);
      return { rows: data.slice((params.page - 1) * params.pageSize, params.page * params.pageSize), total: data.length, summary: { totalStockValue: sum } };
    },
  },
  lowStock: {
    title: 'Low Stock Items',
    csvName: 'low_stock',
    columns: [
      { key: 'name', label: 'Item Name', render: (r) => <span className="font-medium">{r.name}</span> },
      { key: 'stock', label: 'Stock', align: 'right', render: (r) => <span className={`font-mono ${r.stockQty < 0 ? 'text-status-danger font-semibold' : ''}`}>{r.stockQty}</span> },
      { key: 'reorder', label: 'Reorder Point', align: 'right', render: (r) => <span className="font-mono">{r.reorderPoint}</span> },
      { key: 'shortfall', label: 'Shortfall', align: 'right', render: (r) => <span className="font-mono text-status-warning">{r.reorderPoint - r.stockQty}</span> },
    ],
    fetchPage: async (apiFetch, params) => {
      const res = await apiFetch('/api/medicines?lowStock=true');
      const data = await res.json();
      return { rows: data.slice((params.page - 1) * params.pageSize, params.page * params.pageSize), total: data.length };
    },
  },
  receipts: {
    title: 'Receipts Issued',
    csvName: 'receipts',
    filters: ['dateRange'],
    columns: [
      { key: 'no', label: 'Receipt No', render: (r) => <span className="font-mono">{r.invoiceNumber}</span> },
      { key: 'date', label: 'Date', render: (r) => <span className="font-mono">{new Date(r.issuedAt).toISOString().split('T')[0]}</span> },
      { key: 'patient', label: 'Patient', render: (r) => <span className="font-medium">{r.patientName}</span> },
      { key: 'taxable', label: 'Taxable', align: 'right', render: (r) => <span className="font-mono">{money(r.taxableValue)}</span> },
      { key: 'gst', label: 'GST', align: 'right', render: (r) => <span className="font-mono">{money(Number(r.cgst) + Number(r.sgst))}</span> },
      { key: 'total', label: 'Total', align: 'right', render: (r) => <span className="font-mono font-medium">{money(r.totalAmount)}</span> },
      { key: 'method', label: 'Method', render: (r) => <span className="capitalize">{r.paymentMethod}</span> },
    ],
    onRowClick: (row, trigger) => trigger(<div className="bg-white rounded-lg"><PrintableInvoiceModal invoice={row} onClose={() => trigger(null)} /></div>),
    fetchPage: async (apiFetch, params) => {
      let url = `/api/invoices?page=${params.page}&pageSize=${params.pageSize}`;
      if (params.from) url += `&from=${params.from}`;
      if (params.to) url += `&to=${params.to}`;
      const res = await apiFetch(url);
      const data = await res.json();
      return { rows: data.data, total: data.total };
    },
  },
  team: {
    title: 'Team Records',
    csvName: 'team',
    filters: ['tabs'],
    tabs: [
      { label: 'Doctors', value: 'DOCTOR' },
      { label: 'Nurses', value: 'NURSE' },
      { label: 'Staff', value: 'STAFF' },
      { label: 'Reception', value: 'RECEPTION' },
      { label: 'Admins', value: 'MASTER' },
    ],
    defaultTab: 'DOCTOR',
    columns: [
      { key: 'name', label: 'Name', render: (r) => <span className="font-medium">{r.name}</span> },
      { key: 'email', label: 'Email', render: (r) => r.email },
      { key: 'role', label: 'Role', render: (r) => <StatusBadge label={r.role} variant="accent" /> },
    ],
    fetchPage: async (apiFetch, params, extraState) => {
      const role = params.tab || extraState || 'DOCTOR';
      const res = await apiFetch(`/api/users?role=${role}`);
      const data = await res.json();
      return { rows: data.slice((params.page - 1) * params.pageSize, params.page * params.pageSize), total: data.length };
    },
  }
};

export const StatDetailModal: React.FC<{
  kind: DetailKind;
  extraState?: string;
  subLabel: string;
  totalValue: string;
  onClose: () => void;
  triggerElement?: HTMLElement | null;
}> = ({ kind, extraState, subLabel, totalValue, onClose, triggerElement }) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const modalRef = useRef<HTMLDivElement>(null);
  
  const config = DETAIL_CONFIG[kind];
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<any>(null);
  
  const [page, setPage] = useState(1);
  const pageSize = 15;
  
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tab, setTab] = useState(extraState || config.defaultTab || '');

  const [activeComponent, setActiveComponent] = useState<ReactNode>(null);

  useEffect(() => {
    // Focus trap setup
    const modal = modalRef.current;
    if (modal) {
      modal.focus();
    }
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (activeComponent) setActiveComponent(null);
        else handleClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [activeComponent]);

  const handleClose = () => {
    onClose();
    if (triggerElement) {
      triggerElement.focus();
    }
  };

  const loadPage = async (pg: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await config.fetchPage(apiFetch, { page: pg, pageSize, search, from, to, tab }, extraState);
      setRows(res.rows);
      setTotal(res.total);
      if (res.summary) setSummary(res.summary);
    } catch (err: any) {
      setError(err.message || 'Failed to load details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    loadPage(1);
  }, [search, from, to, tab, kind]);

  useEffect(() => {
    loadPage(page);
  }, [page]);

  const handleExport = async () => {
    try {
      addToast('success', 'Starting export... This may take a moment.');
      let allRows: any[] = [];
      let currentPage = 1;
      let hasMore = true;
      
      while (hasMore && allRows.length < 10000) {
        const res = await config.fetchPage(apiFetch, { page: currentPage, pageSize: 100, search, from, to, tab }, extraState);
        allRows = [...allRows, ...res.rows];
        if (allRows.length >= res.total || res.rows.length === 0) {
          hasMore = false;
        }
        currentPage++;
      }
      
      if (allRows.length >= 10000) {
        addToast('warning', 'Export limit reached. Showing first 10,000 rows.');
      }
      
      const columns = config.columns.map(c => ({ key: c.key, label: c.label }));
      // We need to un-reactify the rows for export. For now, pass rows as is, but mapped
      const exportData = allRows.map(r => {
         const obj: any = {};
         for (const col of config.columns) {
           obj[col.key] = r[col.key] || '';
         }
         return r; // exportToCsv usually accepts raw objects and renders them based on keys
      });
      
      exportToCsv(`${config.csvName}-${new Date().toISOString().split('T')[0]}`, exportData, columns);
      addToast('success', 'Export complete.');
    } catch (err: any) {
      addToast('error', 'Failed to export CSV: ' + err.message);
    }
  };

  if (activeComponent) {
    return (
      <div className="fixed inset-0 z-50 bg-ink-primary/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-surface-page w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-[10px] shadow-xl relative">
          <button onClick={() => setActiveComponent(null)} className="absolute top-4 right-4 p-2 text-ink-secondary hover:text-ink-primary bg-surface-page rounded-full shadow-sm z-10"><X className="w-5 h-5"/></button>
          {activeComponent}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-40 bg-ink-primary/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div 
        ref={modalRef}
        tabIndex={-1}
        className="bg-surface-card w-full max-w-5xl max-h-[85vh] rounded-[10px] shadow-xl border border-border flex flex-col outline-none"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">{config.title}</h2>
            <div className="flex items-end gap-3 mt-1">
              <span className="text-2xl font-semibold text-ink-primary leading-none">{totalValue}</span>
              <span className="text-sm text-ink-secondary mb-0.5">{subLabel}</span>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 text-ink-secondary hover:bg-surface-page rounded-md">
            <X className="w-5 h-5" />
          </button>
        </div>

        {summary && kind === 'revenue' && (
          <div className="bg-brand/5 p-4 border-b border-brand/10 flex gap-6 text-sm">
            <div><span className="text-ink-secondary">Cash:</span> <span className="font-mono font-medium">{money(summary.cash)}</span></div>
            <div><span className="text-ink-secondary">Bank:</span> <span className="font-mono font-medium">{money(summary.bank)}</span></div>
            <div><span className="text-ink-secondary">Total:</span> <span className="font-mono font-medium">{money(summary.total)}</span></div>
          </div>
        )}

        {(config.filters?.length ?? 0) > 0 && (
          <div className="p-4 bg-surface-page border-b border-border flex flex-wrap gap-4 items-center">
            {config.filters?.includes('tabs') && config.tabs && (
              <div className="flex bg-surface-card rounded-md border border-border p-1 gap-1">
                {config.tabs.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTab(t.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded ${tab === t.value ? 'bg-surface-page shadow-sm' : 'text-ink-secondary hover:text-ink-primary'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
            
            {config.filters?.includes('search') && (
              <form onSubmit={e => { e.preventDefault(); setSearch(searchInput); }} className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-surface-card border border-border rounded-md focus:outline-none focus:border-brand"
                />
              </form>
            )}

            {config.filters?.includes('dateRange') && (
              <div className="flex items-center gap-2 text-sm">
                <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-3 py-2 bg-surface-card border border-border rounded-md" />
                <span className="text-ink-secondary">to</span>
                <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-3 py-2 bg-surface-card border border-border rounded-md" />
              </div>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-[300px]">
          {loading ? (
            <div className="p-8 flex justify-center"><div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin"/></div>
          ) : error ? (
            <div className="p-8 text-center text-status-danger">
              <p>{error}</p>
              <button onClick={() => loadPage(page)} className="mt-4 px-4 py-2 bg-surface-page border border-border rounded text-sm text-ink-primary">Retry</button>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-16 text-center text-ink-secondary flex flex-col items-center">
              <FileText className="w-8 h-8 mb-3 opacity-20" />
              <p>No records found for the selected filters.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-surface-page sticky top-0 z-10 shadow-sm">
                <tr className="border-b border-border text-ink-secondary font-medium">
                  {config.columns.map((c, i) => (
                    <th key={c.key} className={`py-3 px-4 ${c.align === 'right' ? 'text-right' : ''}`}>
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row, i) => (
                  <tr 
                    key={row.id || i} 
                    className={`hover:bg-surface-page/60 ${config.onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={() => config.onRowClick && config.onRowClick(row, setActiveComponent)}
                  >
                    {config.columns.map(c => (
                      <td key={c.key} className={`py-3 px-4 ${c.align === 'right' ? 'text-right' : ''}`}>
                        {c.render ? c.render(row) : row[c.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {kind === 'stock' && summary?.totalStockValue && (
                <tfoot className="bg-surface-page sticky bottom-0 border-t border-border font-medium">
                  <tr>
                    <td colSpan={config.columns.length - 2} className="py-3 px-4 text-right">Total Value</td>
                    <td className="py-3 px-4 text-right font-mono">{money(summary.totalStockValue)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        <div className="p-4 border-t border-border flex items-center justify-between bg-surface-card rounded-b-[10px]">
          <div className="text-xs text-ink-secondary">
            Showing {rows.length > 0 ? (page - 1) * pageSize + 1 : 0} to {Math.min(page * pageSize, total)} of {total}
          </div>
          
          <div className="flex-1 flex justify-center">
            {total > pageSize && (
              <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
            )}
          </div>
          
          <button
            onClick={handleExport}
            disabled={total === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-primary bg-surface-page hover:bg-surface-page/80 border border-border rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>
      </div>
    </div>
  );
};
