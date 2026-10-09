import React from 'react';
import { AddCareOrderForm } from '../AddCareOrderForm';
import { CareOrdersList, CareOrdersListProps } from './CareOrdersList';

interface Step3OrdersProps extends CareOrdersListProps {
  queueId: string;
  isAssessed: boolean;
  onOrderAdded: () => void;
}

export const Step3Orders: React.FC<Step3OrdersProps> = ({
  queueId, isAssessed, onOrderAdded, ...careOrdersProps
}) => {
  return (
    <div className="space-y-4">
      <CareOrdersList 
        {...careOrdersProps} 
        headerActions={
          isAssessed ? (
            <AddCareOrderForm queueId={queueId} onOrderAdded={onOrderAdded} />
          ) : null
        }
      />
      {!isAssessed && (
        <div className="text-xs text-ink-secondary py-6 text-center bg-surface-page rounded-lg border border-border">
          Save the assessment above before adding orders.
        </div>
      )}
    </div>
  );
};