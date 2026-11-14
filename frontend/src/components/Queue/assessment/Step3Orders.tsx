import React from 'react';
import { AddCareOrderForm, ProcedurePackageProps } from '../AddCareOrderForm';
import { CareOrdersList, CareOrdersListProps } from './CareOrdersList';

interface Step3OrdersProps extends CareOrdersListProps, ProcedurePackageProps {
  queueId: string;
  isAssessed: boolean;
  onOrderAdded: () => void;
  /** Shown under the list — what was recommended to reception. */
  footer?: React.ReactNode;
}

/**
 * Medicines and procedures for this encounter. Orders hang off the queue entry, not
 * the saved assessment, so the doctor can prescribe before pressing Save. Procedures
 * are recommendations reception bills; packages are recommended from the same box.
 */
export const Step3Orders: React.FC<Step3OrdersProps> = ({
  queueId, isAssessed: _isAssessed, onOrderAdded, footer,
  packageTypes, patientPurchases, onRecommendPackage, onUseSitting, onPackageCreated,
  ...careOrdersProps
}) => {
  return (
    <div className="space-y-4">
      <CareOrdersList
        {...careOrdersProps}
        headerActions={
          <AddCareOrderForm
            queueId={queueId}
            onOrderAdded={onOrderAdded}
            packageTypes={packageTypes}
            patientPurchases={patientPurchases}
            onRecommendPackage={onRecommendPackage}
            onUseSitting={onUseSitting}
            onPackageCreated={onPackageCreated}
          />
        }
      />
      {footer}
    </div>
  );
};
