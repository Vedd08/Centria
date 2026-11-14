import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Pill, Stethoscope, X } from 'lucide-react';
import { ORDER_TYPE_LABEL } from './types';
import { QuickAddProcedure } from '../Treatments/QuickAddProcedure';
import { QuickAddPackage } from './assessment/QuickAddPackage';

/** Sentinel select value for adding a procedure to the catalogue. */
const NEW_PROCEDURE = '__new__';

interface MedicineOption {
  id: string;
  name: string;
  unit: string;
  stockQty: number;
  unitPrice: number;
  isActive: boolean;
}

interface TreatmentOption {
  id: string;
  name: string;
}

/** Package hooks for the procedure flow — the doctor recommends packages from here. */
export interface ProcedurePackageProps {
  packageTypes?: any[];
  patientPurchases?: any[];
  /** Sends the recommendation to reception right away. Returns whether it worked. */
  onRecommendPackage?: (packageTypeId: string) => Promise<boolean>;
  /** The patient already owns a package for this procedure: count today as a sitting. */
  onUseSitting?: (purchase: any) => void;
  onPackageCreated?: (pkg: any) => void;
}

interface AddCareOrderFormProps extends ProcedurePackageProps {
  queueId: string;
  onOrderAdded: () => void;
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

const ROUTES = ['Oral', 'IV', 'IM', 'Subcutaneous', 'Topical', 'Inhalation'];

/** Doctor's order entry — one line per medicine, injection or treatment. */
export const AddCareOrderForm: React.FC<AddCareOrderFormProps> = ({
  queueId, onOrderAdded, packageTypes = [], patientPurchases = [], onRecommendPackage, onUseSitting, onPackageCreated,
}) => {
  const { apiFetch } = useAuth();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [orderType, setOrderType] = useState('MEDICINE');
  const [medicines, setMedicines] = useState<MedicineOption[]>([]);
  const [treatments, setTreatments] = useState<TreatmentOption[]>([]);
  const [medicineId, setMedicineId] = useState('');
  const [treatmentId, setTreatmentId] = useState('');
  const [description, setDescription] = useState('');
  const [dosage, setDosage] = useState('');
  const [route, setRoute] = useState('Oral');
  const [frequency, setFrequency] = useState('');
  const [instructions, setInstructions] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [addingProcedure, setAddingProcedure] = useState(false);
  const [packageId, setPackageId] = useState('');
  const [addingPackage, setAddingPackage] = useState(false);
  const [useSitting, setUseSitting] = useState(true);

  const openAs = (type: string) => {
    setOrderType(type);
    setAddingProcedure(false);
    setOpen(true);
  };

  const isStockBacked = orderType === 'MEDICINE' || orderType === 'INJECTION';
  const isProcedure = orderType === 'TREATMENT';

  // A package the patient already bought that covers this procedure, with sittings left.
  const activePurchase = isProcedure && treatmentId
    ? patientPurchases.find((p) => p.packageType?.treatmentId === treatmentId && p.sittingsRemaining > 0)
    : null;
  const coveredBySitting = !!activePurchase && useSitting;
  const activePackages = packageTypes.filter((pt) => pt.isActive !== false);
  const packagesForProcedure = treatmentId ? activePackages.filter((pt) => pt.treatmentId === treatmentId) : [];
  const otherPackages = activePackages.filter((pt) => !treatmentId || pt.treatmentId !== treatmentId);
  const formatPkg = (pt: any) =>
    `${pt.name} — ${pt.totalSittings} sittings, ₹${Number(pt.price).toLocaleString('en-IN')}${pt.sittingGapDays ? ` (every ${pt.sittingGapDays} days)` : ''}`;

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const [medRes, trtRes] = await Promise.all([apiFetch('/api/medicines'), apiFetch('/api/treatments')]);
        const medData = await medRes.json();
        const trtData = await trtRes.json();
        const meds: MedicineOption[] = Array.isArray(medData) ? medData : medData.data || [];
        setMedicines(meds.filter((m) => m.isActive));
        setTreatments(Array.isArray(trtData) ? trtData : trtData.data || []);
      } catch {
        addToast('error', 'Failed to load the medicine/treatment catalogue');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const reset = () => {
    setMedicineId('');
    setTreatmentId('');
    setDescription('');
    setDosage('');
    setFrequency('');
    setInstructions('');
    setQuantity('1');
    setPackageId('');
    setAddingPackage(false);
    setUseSitting(true);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (isStockBacked && !medicineId) {
      addToast('error', 'Select a medicine from pharmacy stock');
      return;
    }
    if (!isStockBacked && orderType !== 'TREATMENT' && !description.trim()) {
      addToast('error', 'Enter what should be done');
      return;
    }
    if (isProcedure && !treatmentId) {
      addToast('error', 'Select a procedure');
      return;
    }
    setSubmitting(true);
    try {
      // A procedure is only a recommendation that reception bills at the catalogue
      // price — no quantity, dosage or staff instructions.
      const body = isProcedure
        ? { queueId, orderType, treatmentId, quantity: 1, coveredByPackage: coveredBySitting || undefined }
        : {
            queueId,
            orderType,
            medicineId: isStockBacked ? medicineId : undefined,
            description: description.trim() || undefined,
            dosage: dosage.trim() || undefined,
            route: isStockBacked ? route : undefined,
            frequency: frequency.trim() || undefined,
            instructions: instructions.trim() || undefined,
            quantity: Number(quantity) || 1,
          };
      const res = await apiFetch('/api/care-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to add order');
      if (isProcedure && coveredBySitting) {
        onUseSitting?.(activePurchase);
        addToast('success', `Procedure added as a sitting of ${activePurchase.packageName} — no charge`);
      } else if (isProcedure && packageId && onRecommendPackage) {
        const ok = await onRecommendPackage(packageId);
        addToast(ok ? 'success' : 'warning', ok
          ? 'Procedure and package recommended — reception can see them now'
          : 'Procedure added, but the package recommendation failed — try again');
      } else {
        addToast('success', isProcedure ? 'Procedure recommended — reception will bill it' : 'Order added to the patient');
      }
      reset();
      setOpen(false);
      onOrderAdded();
    } catch (err: any) {
      addToast('error', err.message || 'Failed to add order');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => openAs('MEDICINE')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer"
        >
          <Pill className="w-3.5 h-3.5" />
          <span>Add Medicine</span>
        </button>
        <button
          type="button"
          onClick={() => openAs('TREATMENT')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-brand-deep bg-brand-soft hover:bg-brand/15 border border-brand/30 rounded-md transition-colors cursor-pointer"
        >
          <Stethoscope className="w-3.5 h-3.5" />
          <span>Add Procedure</span>
        </button>
      </div>
    );
  }

  return (
    // A div, not a <form>: this sits inside the doctor's assessment form, and a nested
    // form made "Add Order" do a native page submit that reloaded the whole app.
    // Enter in a field adds the order instead of submitting the outer assessment.
    <div
      className="bg-surface-page p-4 rounded-lg border border-border space-y-3 w-full"
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
          e.preventDefault();
          handleSubmit();
        }
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-primary">
          {isStockBacked ? 'Add medicine' : isProcedure ? 'Recommend procedure' : 'Add order'}
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="p-1 rounded text-ink-secondary hover:text-ink-primary cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-ink-secondary mb-1">
            Type <span className="text-status-danger">*</span>
          </label>
          <select value={orderType} onChange={(e) => setOrderType(e.target.value)} className={inputClass}>
            {Object.entries(ORDER_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        {isStockBacked ? (
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Medicine <span className="text-status-danger">*</span>
            </label>
            <select required value={medicineId} onChange={(e) => setMedicineId(e.target.value)} className={inputClass}>
              <option value="">Select from pharmacy stock</option>
              {medicines.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.stockQty} {m.unit} in stock)
                </option>
              ))}
            </select>
          </div>
        ) : orderType === 'TREATMENT' ? (
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Procedure</label>
            <select
              value={addingProcedure ? NEW_PROCEDURE : treatmentId}
              onChange={(e) => {
                if (e.target.value === NEW_PROCEDURE) {
                  setAddingProcedure(true);
                  return;
                }
                setAddingProcedure(false);
                setTreatmentId(e.target.value);
              }}
              className={inputClass}
            >
              <option value="">Select procedure</option>
              {treatments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              <option value={NEW_PROCEDURE}>+ Add a new procedure…</option>
            </select>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Description <span className="text-status-danger">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should be done"
              className={inputClass}
            />
          </div>
        )}
      </div>

      {orderType === 'TREATMENT' && addingProcedure && (
        <QuickAddProcedure
          onCancel={() => setAddingProcedure(false)}
          onCreated={(t) => {
            setTreatments((prev) => [...prev, t].sort((a, b) => a.name.localeCompare(b.name)));
            setTreatmentId(t.id);
            setAddingProcedure(false);
          }}
        />
      )}

      {isProcedure ? (
        <div className="space-y-3">
          {activePurchase ? (
            <label className="flex items-start gap-2 p-3 rounded-lg bg-brand-soft border border-brand/20 cursor-pointer">
              <input
                type="checkbox"
                checked={useSitting}
                onChange={(e) => setUseSitting(e.target.checked)}
                className="mt-0.5 rounded border-brand/30 text-brand focus:ring-brand"
              />
              <span className="text-xs text-brand-deep">
                <span className="font-semibold">Count as a sitting of {activePurchase.packageName}</span>
                <span className="block text-[11px] text-brand-deep/80">
                  Sitting {activePurchase.sittingsUsed + 1} of {activePurchase.totalSittings} · already paid, no charge today
                </span>
              </span>
            </label>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">
                Recommend a package to reception <span className="font-normal text-ink-secondary/70">(optional, multiple sittings)</span>
              </label>
              <select
                value={addingPackage ? NEW_PROCEDURE : packageId}
                onChange={(e) => {
                  if (e.target.value === NEW_PROCEDURE) {
                    setAddingPackage(true);
                    return;
                  }
                  setAddingPackage(false);
                  setPackageId(e.target.value);
                }}
                className={inputClass}
              >
                <option value="">No package — just this procedure</option>
                {packagesForProcedure.length > 0 && (
                  <optgroup label="For this procedure">
                    {packagesForProcedure.map((pt) => <option key={pt.id} value={pt.id}>{formatPkg(pt)}</option>)}
                  </optgroup>
                )}
                {otherPackages.length > 0 && (
                  <optgroup label={treatmentId ? 'Other packages' : 'All packages'}>
                    {otherPackages.map((pt) => <option key={pt.id} value={pt.id}>{formatPkg(pt)}</option>)}
                  </optgroup>
                )}
                {onPackageCreated && <option value={NEW_PROCEDURE}>+ Create a new package…</option>}
              </select>
              {addingPackage && (
                <QuickAddPackage
                  treatmentId={treatmentId}
                  treatmentName={treatments.find((t) => t.id === treatmentId)?.name}
                  onCancel={() => setAddingPackage(false)}
                  onCreated={(pkg) => {
                    onPackageCreated?.(pkg);
                    setPackageId(pkg.id);
                    setAddingPackage(false);
                  }}
                />
              )}
            </div>
          )}
          <p className="text-[11px] text-ink-secondary">
            {coveredBySitting
              ? 'Printed on the prescription. Not billed — the package was paid for when it was sold.'
              : 'Printed on the prescription as a recommendation. Reception bills the procedure at its price and sees any package you recommend.'}
          </p>
        </div>
      ) : (
      <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-ink-secondary mb-1">Quantity</label>
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-secondary mb-1">Dosage</label>
          <input
            type="text"
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            placeholder="500mg"
            className={inputClass}
          />
        </div>
        {isStockBacked && (
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">Route</label>
            <select value={route} onChange={(e) => setRoute(e.target.value)} className={inputClass}>
              {ROUTES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-semibold text-ink-secondary mb-1">Frequency</label>
          <input
            type="text"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            placeholder="1-0-1"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-ink-secondary mb-1">Instructions for staff</label>
        <input
          type="text"
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="e.g. After food, monitor for reaction"
          className={inputClass}
        />
      </div>
      </>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3.5 py-1.5 text-xs font-medium text-ink-primary bg-surface-card hover:bg-surface-page border border-border rounded-md cursor-pointer"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="px-3.5 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
        >
          {submitting ? 'Adding...' : isProcedure ? 'Recommend' : 'Add Order'}
        </button>
      </div>
    </div>
  );
};
