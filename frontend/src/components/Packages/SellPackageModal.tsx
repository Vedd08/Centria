import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Tag, BadgePercent } from 'lucide-react';
import { money } from '../../utils/money';
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
  const { apiFetch, user } = useAuth();
  const { addToast } = useToast();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [packageTypes, setPackageTypes] = useState<PackageTypeItem[]>([]);
  
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId);
  const [selectedPackageTypeId, setSelectedPackageTypeId] = useState(initialPackageTypeId);
  const [discountMode, setDiscountMode] = useState<'amount' | 'percent'>('amount');
  const [discountInput, setDiscountInput] = useState('');
  const [discountReason, setDiscountReason] = useState('');
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
  };

  // List price comes from the package; the discount is taken off it, so the amount
  // charged can't drift from what accounts sees as list − discount.
  const listPrice = Number(packageTypes.find((t) => t.id === selectedPackageTypeId)?.price ?? 0);
  const rawDiscount = Number(discountInput) || 0;
  const discount = Math.round(
    Math.min(listPrice, Math.max(0, discountMode === 'percent' ? (listPrice * rawDiscount) / 100 : rawDiscount)) * 100,
  ) / 100;
  const finalAmount = Math.round((listPrice - discount) * 100) / 100;
  const discountTooBig = discountMode === 'percent' ? rawDiscount > 100 : rawDiscount > listPrice;

  const handleSellSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId || !selectedPackageTypeId) return;
    if (discountTooBig) {
      setError('Discount cannot be more than the package price');
      return;
    }
    if (discount > 0 && !discountReason.trim()) {
      setError('Enter a reason for the discount');
      return;
    }

    setSelling(true);
    setError(null);

    try {
      const res = await apiFetch('/api/packages/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatientId,
          packageTypeId: selectedPackageTypeId,
          discount,
          discountReason: discount > 0 ? discountReason.trim() : undefined,
          linkToQueueId: linkToQueueId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to complete package sale');

      addToast('success', discount > 0 ? `Package sold with ${money(discount)} discount` : 'Package sold successfully');
      setDiscountInput('');
      setDiscountReason('');
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

          <div className="flex justify-between text-xs">
            <span className="text-ink-secondary">Package price</span>
            <span className="font-mono font-semibold">{money(listPrice)}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1 flex items-center gap-1.5">
              <BadgePercent className="w-3.5 h-3.5" /> Discount <span className="font-normal text-ink-secondary/70">(optional)</span>
            </label>
            <div className="flex gap-2">
              <div className="flex rounded-md border border-border overflow-hidden shrink-0">
                {(['amount', 'percent'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDiscountMode(m)}
                    className={`px-3 py-2 text-xs font-semibold cursor-pointer ${
                      discountMode === m ? 'bg-brand text-white' : 'bg-surface-card text-ink-secondary hover:bg-surface-page'
                    }`}
                  >
                    {m === 'amount' ? '₹' : '%'}
                  </button>
                ))}
              </div>
              <input
                type="number"
                min={0}
                max={discountMode === 'percent' ? 100 : listPrice}
                step="0.01"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                placeholder={discountMode === 'percent' ? 'e.g. 10' : 'e.g. 2000'}
                className={`w-full px-3 py-2 rounded-md border text-xs focus:ring-1 focus:ring-brand bg-surface-card ${
                  discountTooBig ? 'border-status-danger' : 'border-border'
                }`}
              />
            </div>
            {discountTooBig && <p className="text-[11px] text-status-danger mt-1">Discount cannot be more than the package price.</p>}
          </div>

          {discount > 0 && (
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Reason for discount <span className="text-status-danger">*</span>
              </label>
              <input
                type="text"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="e.g. Regular patient, festival offer, doctor approved"
                className="w-full px-3 py-2 rounded-md border border-border text-xs focus:ring-1 focus:ring-brand bg-surface-card"
              />
              <p className="text-[10px] text-ink-secondary mt-1">
                Recorded in Accounts as given by <span className="font-semibold text-ink-primary">{user?.name || 'you'}</span>.
              </p>
            </div>
          )}

          <div className="flex justify-between items-center text-sm border-t border-border pt-3">
            <span className="font-semibold">Amount to collect</span>
            <span className="font-mono font-bold text-brand-deep">
              {money(finalAmount)}
              {discount > 0 && <span className="ml-2 text-[11px] font-normal text-status-success">({money(discount)} off)</span>}
            </span>
          </div>
          <p className="text-[10px] text-ink-secondary -mt-2">GST, if the package is taxable, is added on the receipt.</p>

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
              disabled={selling || discountTooBig}
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
