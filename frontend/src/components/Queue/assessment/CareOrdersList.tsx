import React from 'react';
import { Settings, Tag, Syringe, AlignLeft, Banknote, Package, X, Check } from 'lucide-react';
import { ORDER_TYPE_LABEL, money } from '../types';
import { StatusBadge } from '../../common/StatusBadge';

export interface CareOrdersListProps {
  orders: any[];
  groupedOrders: Record<string, any[]>;
  sortedGroupNames: string[];
  pharmacyTotal: number;
  showConfig: boolean;
  setShowConfig: (show: boolean) => void;
  showDetails: any;
  toggleDetail: (key: string) => void;
  canAssess: boolean;
  canPerform: boolean;
  canDispense: boolean;
  busyOrderId: string | null;
  dispenseOrder: (id: string) => void;
  performOrder: (id: string) => void;
  setDeleteTarget: (target: any) => void;
  headerActions?: React.ReactNode;
}

export const CareOrdersList: React.FC<CareOrdersListProps> = ({
  orders,
  groupedOrders,
  sortedGroupNames,
  pharmacyTotal,
  showConfig,
  setShowConfig,
  showDetails,
  toggleDetail,
  canAssess,
  canPerform,
  canDispense,
  busyOrderId,
  dispenseOrder,
  performOrder,
  setDeleteTarget,
  headerActions
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-secondary">
          Treatments, drugs and injections the doctor ordered. Staff mark them done; pharmacy dispenses stock items.
        </p>
        <div className="flex items-center gap-2 relative">
          <button
            type="button"
            onClick={() => setShowConfig(!showConfig)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded shadow-xs transition-colors cursor-pointer ${
              showConfig ? 'bg-brand/10 text-brand border border-brand/20' : 'text-ink-secondary bg-surface-card border border-border hover:bg-surface-page'
            }`}
          >
            <Settings className="w-3.5 h-3.5" /> Configure View
          </button>
          {showConfig && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowConfig(false)} />
              <div className="absolute right-0 top-full mt-2 w-56 p-1.5 bg-surface-card border border-border rounded-xl shadow-xl z-20 flex flex-col gap-0.5 origin-top-right animate-in fade-in zoom-in-95 duration-200">
                <div className="px-3 py-2 text-[10px] font-bold text-ink-secondary uppercase tracking-wider mb-1">
                  Display Settings
                </div>
                
                <button type="button" onClick={() => toggleDetail('showTags')} className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg hover:bg-surface-page transition-colors group cursor-pointer text-left">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-md transition-colors ${showDetails.showTags ? 'bg-brand/10 text-brand' : 'bg-surface-page text-ink-secondary group-hover:text-ink-primary'}`}>
                      <Tag className="w-3.5 h-3.5" />
                    </div>
                    <span className={`text-[11px] font-medium transition-colors ${showDetails.showTags ? 'text-ink-primary' : 'text-ink-secondary'}`}>Template Tags</span>
                  </div>
                  <div className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${showDetails.showTags ? 'bg-brand' : 'bg-border'}`}>
                    <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${showDetails.showTags ? 'translate-x-3' : 'translate-x-0.5'}`} />
                  </div>
                </button>

                <button type="button" onClick={() => toggleDetail('showDosage')} className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg hover:bg-surface-page transition-colors group cursor-pointer text-left">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-md transition-colors ${showDetails.showDosage ? 'bg-brand/10 text-brand' : 'bg-surface-page text-ink-secondary group-hover:text-ink-primary'}`}>
                      <Syringe className="w-3.5 h-3.5" />
                    </div>
                    <span className={`text-[11px] font-medium transition-colors ${showDetails.showDosage ? 'text-ink-primary' : 'text-ink-secondary'}`}>Dosage & Freq</span>
                  </div>
                  <div className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${showDetails.showDosage ? 'bg-brand' : 'bg-border'}`}>
                    <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${showDetails.showDosage ? 'translate-x-3' : 'translate-x-0.5'}`} />
                  </div>
                </button>

                <button type="button" onClick={() => toggleDetail('showInstructions')} className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg hover:bg-surface-page transition-colors group cursor-pointer text-left">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-md transition-colors ${showDetails.showInstructions ? 'bg-brand/10 text-brand' : 'bg-surface-page text-ink-secondary group-hover:text-ink-primary'}`}>
                      <AlignLeft className="w-3.5 h-3.5" />
                    </div>
                    <span className={`text-[11px] font-medium transition-colors ${showDetails.showInstructions ? 'text-ink-primary' : 'text-ink-secondary'}`}>Instructions</span>
                  </div>
                  <div className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${showDetails.showInstructions ? 'bg-brand' : 'bg-border'}`}>
                    <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${showDetails.showInstructions ? 'translate-x-3' : 'translate-x-0.5'}`} />
                  </div>
                </button>

                <button type="button" onClick={() => toggleDetail('showPrice')} className="flex items-center justify-between w-full px-2.5 py-2 rounded-lg hover:bg-surface-page transition-colors group cursor-pointer text-left">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-md transition-colors ${showDetails.showPrice ? 'bg-brand/10 text-brand' : 'bg-surface-page text-ink-secondary group-hover:text-ink-primary'}`}>
                      <Banknote className="w-3.5 h-3.5" />
                    </div>
                    <span className={`text-[11px] font-medium transition-colors ${showDetails.showPrice ? 'text-ink-primary' : 'text-ink-secondary'}`}>Prices</span>
                  </div>
                  <div className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${showDetails.showPrice ? 'bg-brand' : 'bg-border'}`}>
                    <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${showDetails.showPrice ? 'translate-x-3' : 'translate-x-0.5'}`} />
                  </div>
                </button>
              </div>
            </>
          )}
          {headerActions}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="text-ink-secondary text-xs py-8 text-center bg-surface-page rounded-lg border border-border">
          No orders yet for this patient.
        </div>
      ) : (
        <>
          <div className="space-y-5">
            {sortedGroupNames.map(groupName => {
              const groupOrders = groupedOrders[groupName];
              return (
              <div key={groupName} className="bg-surface-page border border-border rounded-xl shadow-xs overflow-hidden">
                <div className="bg-surface-card border-b border-border px-4 py-2.5 flex items-center gap-2">
                  {groupName === 'Manually Added' ? (
                     <span className="text-[11px] font-bold text-ink-primary uppercase tracking-wide">Manually Added</span>
                  ) : (
                     <span className="text-[11px] font-bold text-brand-deep uppercase tracking-wide">Template: {groupName}</span>
                  )}
                  <span className="text-[10px] font-bold bg-border/50 text-ink-secondary px-1.5 py-0.5 rounded-full">{groupOrders.length}</span>
                </div>
                <div className="p-3 space-y-2">
                  {groupOrders.map((o) => {
                    const isStock = ['MEDICINE', 'INJECTION'].includes(o.orderType);
                    const isShared = o.sourceTemplates && o.sourceTemplates.split(' | ').length > 1;
                    const otherTemplates = o.sourceTemplates?.split(' | ').filter((t: string) => t !== groupName);
                    const canDelete = o.status === 'ORDERED' && !o.dispensedAt && !o.performedAt;
                    
                    const handleRemoveClick = () => {
                      if (isShared && groupName !== 'Manually Added') {
                        setDeleteTarget({
                          id: o.id,
                          action: 'untag',
                          templateName: groupName,
                          title: 'Remove from Template',
                          message: `Remove this order from "${groupName}"? It will still remain under "${otherTemplates?.join('", "')}".`
                        });
                      } else if (canDelete) {
                        setDeleteTarget({
                          id: o.id,
                          action: 'delete',
                          title: 'Delete Care Order',
                          message: `Permanently delete "${o.description}"?`
                        });
                      } else {
                        setDeleteTarget({
                          id: o.id,
                          action: 'cancel',
                          title: 'Cancel Care Order',
                          message: `This order is already processed. Mark "${o.description}" as cancelled instead?`
                        });
                      }
                    };

                    return (
                      <div key={o.id} className="bg-surface-card p-3 rounded-lg border border-border space-y-2 relative group">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-ink-primary">{o.description}</span>
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface-page border border-border text-ink-secondary">
                                {ORDER_TYPE_LABEL[o.orderType as keyof typeof ORDER_TYPE_LABEL] || o.orderType}
                              </span>
                              {isShared && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-status-warning/10 border border-status-warning/20 text-status-warning" title={`Also in: ${otherTemplates?.join(', ')}`}>
                                  Shared
                                </span>
                              )}
                              {showDetails.showTags && o.sourceTemplates && o.sourceTemplates.split(' | ').map((t: string) => (
                                <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-brand/10 border border-brand/20 text-brand-deep">
                                  <Tag className="w-2.5 h-2.5" />
                                  From template: {t}
                                </span>
                              ))}
                            </div>
                            <p className="text-[11px] text-ink-secondary mt-0.5">
                              Qty {o.quantity}
                              {showDetails.showDosage && o.dosage && ` · ${o.dosage}`}
                              {showDetails.showDosage && o.route && ` · ${o.route}`}
                              {showDetails.showDosage && o.frequency && ` · ${o.frequency}`}
                              {showDetails.showPrice && Number(o.totalPrice) > 0 && ` · ${money(o.totalPrice)}`}
                            </p>
                            {showDetails.showInstructions && o.instructions && (
                              <p className="text-[11px] text-ink-secondary/80 italic mt-0.5">{o.instructions}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <StatusBadge
                              label={o.status === 'DONE' ? 'Done' : o.status === 'CANCELLED' ? 'Cancelled' : 'Ordered'}
                              variant={o.status === 'DONE' ? 'success' : o.status === 'CANCELLED' ? 'danger' : 'warning'}
                            />
                            {isStock && (
                              o.medicineId ? (
                                <span
                                  className={`text-[10px] font-medium ${o.dispensedAt ? 'text-status-success' : 'text-status-warning'}`}
                                >
                                  {o.dispensedAt ? 'Dispensed' : 'Not dispensed'}
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-status-danger/10 text-status-danger border border-status-danger/20">
                                  Not stocked — buy outside
                                </span>
                              )
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {canDispense && isStock && o.medicineId && !o.dispensedAt && o.status !== 'CANCELLED' && (
                            <button
                              type="button"
                              onClick={() => dispenseOrder(o.id)}
                              disabled={busyOrderId === o.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-brand-deep bg-brand-soft hover:bg-brand-soft/70 border border-brand/20 rounded cursor-pointer disabled:opacity-50"
                            >
                              <Package className="w-3 h-3" /> Dispense
                            </button>
                          )}
                          {canPerform && o.status === 'ORDERED' && (
                            <button
                              type="button"
                              onClick={() => performOrder(o.id)}
                              disabled={busyOrderId === o.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-status-success bg-status-success/10 hover:bg-status-success/20 border border-status-success/20 rounded cursor-pointer disabled:opacity-50"
                            >
                              <Check className="w-3 h-3" /> Mark Done
                            </button>
                          )}
                          {canAssess && (
                            <button
                              type="button"
                              onClick={handleRemoveClick}
                              disabled={busyOrderId === o.id}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-status-danger bg-status-danger/10 hover:bg-status-danger/20 border border-status-danger/20 rounded cursor-pointer disabled:opacity-50"
                            >
                              <X className="w-3 h-3" /> Remove
                            </button>
                          )}
                          {o.performedBy && (
                            <span className="text-[10px] text-ink-secondary/70 ml-auto">
                              Done by {o.performedBy.name}
                              {o.performedAt && ` · ${new Date(o.performedAt).toLocaleTimeString()}`}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              );
            })}
          </div>

          {pharmacyTotal > 0 && (
            <div className="flex items-center justify-between bg-brand-soft/60 border border-brand/20 rounded-lg p-3">
              <span className="text-xs font-medium text-ink-primary flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-brand-deep" /> Pharmacy total for this patient
              </span>
              <span className="text-sm font-semibold text-brand-deep">{money(pharmacyTotal)}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
};