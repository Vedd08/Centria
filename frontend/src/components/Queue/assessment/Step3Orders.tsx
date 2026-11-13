import React from 'react';
import { AddCareOrderForm } from '../AddCareOrderForm';
import { CareOrdersList, CareOrdersListProps } from './CareOrdersList';

interface Step3OrdersProps extends CareOrdersListProps {
  queueId: string;
  isAssessed: boolean;
  onOrderAdded: () => void;
}

/**
 * Medicines and procedures for this encounter. Orders hang off the queue entry, not
 * the saved assessment, so the doctor can prescribe before pressing Save.
 */
export const Step3Orders: React.FC<Step3OrdersProps> = ({
  queueId, isAssessed: _isAssessed, onOrderAdded, ...careOrdersProps
}) => {
  return (
    <div className="space-y-4">
      <CareOrdersList
        {...careOrdersProps}
        headerActions={<AddCareOrderForm queueId={queueId} onOrderAdded={onOrderAdded} />}
      />
    </div>
  );
};
