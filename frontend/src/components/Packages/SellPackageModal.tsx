import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Tag } from 'lucide-react';
import { Patient } from '../Patients/PatientList';
import { PackageTypeItem } from './PackageList';

interface SellPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialPatientId?: string;
  initialPackageTypeId?: string;
  linkToQueueId?: string; // If selling from Reception for a specific queue entry
}

export const SellPackageModal: React.FC<SellPackageModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPatientId = '',
  initialPackageTypeId = '',
  linkToQueueId = '',
}) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [packageTypes, setPackageTypes] = useState<PackageTypeItem[]>([]);
  
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId);
  const [selectedPackageTypeId, setSelectedPackageTypeId] = useState(initialPackageTypeId);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [selling, setSelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      if (initialPatientId) setSelectedPatientId(initialPatientId);
      if (initialPackageTypeId) setSelectedPackageTypeId(initialPackageTypeId);
    }
  }, [isOpen, initialPatientId, initialPackageTypeId]);

  const fetchData = async () => {
    try {
      const [resTypes, resPatients] = await Promise.all([
        apiFetch('/api/packages/types'),
        apiFetch('/api/patients'),
      ]);
      const dataTypes = await resTypes.json();
      if (Array.isArray(dataTypes)) setPackageTypes(dataTypes);
      
      if (dataTypes.length > 0 && !initialPackageTypeId) {
        setSelectedPackageTypeId(dataTypes[0].id);
        setAmountPaid(dataTypes[0].price);
      } else if (initialPackageTypeId) {
        const found = dataTypes.find((t: any) => t.id === initialPackageTypeId);
        if (found) setAmountPaid(found.price);
      }

      if (initialPatientId) {
        // Fetch just this one patient to display their name
        const pRes = await apiFetch(`/api/patients/${initialPatientId}`);
        if (pRes.ok) {
          const pData = await pRes.json();
          setPatients([pData]);
        }
      }
    } catch (err: any) {
      addToast('error', 'Failed to load options for selling package');
    }
  };

  const [search, setSearch] = useState('');
  useEffect(() => {
    if (!isOpen || initialPatientId) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ pageSize: '8' });
        if (search.trim()) params.set('search', search.trim());
        const res = await apiFetch(`/api/patients?${params}`, { signal: controller.signal });
        const result = await res.json();
        const pList = Array.isArray(result) ? result : result.data || [];
        setPatients(pList);
      } catch (err: any) {
        if (err.name !== 'AbortError') addToast('error', 'Failed to search patients');
      }
    }, search.trim() ? 300 : 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [search, isOpen, initialPatientId, apiFetch]);

  const handlePackageTypeSelect = (typeId: string) => {
    setSelectedPackageTypeId(typeId);
    const found = packageTypes.find((t) => t.id === typeId);
    if (found) setAmountPaid(found.price);
  };

  const handleSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedPackageTypeId) return;

    setSelling(true);
    setError(null);

    try {
      const res = await apiFetch('/api/packages/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatientId,
          packageTypeId: selectedPackageTypeId,
          amountPaid: Number(amountPaid),
          linkToQueueId: linkToQueueId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to complete package sale');

      addToast('success', 'Package sold successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error selling package');
    } finally {
      setSelling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface-card rounded-[10px] border border-border shadow-xl max-w-md w-full p-6 space-y-5 mx-2 sm:mx-0 my-4 sm:my-8">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <h3 className="text-base font-bold text-ink-primary flex items-center gap-2">
            <Tag className="w-4 h-4 text-brand" /> Sell Package to Patient
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-ink-secondary hover:bg-surface-page text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-status-danger/10 border border-status-danger/20 text-status-danger text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSellSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Select Patient <span className="text-status-danger">*</span>
            </label>
            {initialPatientId ? (
              <div className="w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-page font-medium text-ink-primary">
                {patients.length > 0 ? `${patients[0].name} (${patients[0].phone})` : 'Loading patient...'}
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or mobile..."
                  className="w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card focus:ring-1 focus:ring-brand mb-2"
                />
                <select
                  required
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full px-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
                >
                  <option value="" disabled>Select a patient</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.phone})
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Select Package <span className="text-status-danger">*</span>
            </label>
            <select
              required
              value={selectedPackageTypeId}
              onChange={(e) => handlePackageTypeSelect(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card font-semibold text-ink-primary"
            >
              <option value="" disabled>Select a package type...</option>
              {packageTypes.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} ({pkg.totalSittings} Sittings — ₹{pkg.price})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Amount Paid (₹) <span className="text-status-danger">*</span>
            </label>
            <input
              type="number"
              required
              min={0}
              value={amountPaid}
              onChange={(e) => setAmountPaid(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card font-bold"
            />
          </div>

          <div className="pt-2 border-t border-border flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink-primary rounded-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={selling}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
            >
              {selling ? 'Issuing...' : 'Issue Package & Create Sittings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
