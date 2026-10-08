import { HistoryPatient } from '../PatientHistory/PatientHistoryPanel';

export interface CareOrder {
  id: string;
  orderType: string;
  medicineId?: string;
  treatmentId?: string;
  description: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  instructions?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  status: string;
  performedAt?: string;
  performNotes?: string;
  dispensedAt?: string;
  medicine?: { id: string; name: string; unit: string; stockQty: number };
  patient?: HistoryPatient;
  queue?: { id: string; tokenNumber: number; queueDate: string; careType?: string; status: string };
  orderedBy?: { id: string; name: string };
  performedBy?: { id: string; name: string };
  dispensedBy?: { id: string; name: string };
  sourceTemplates?: string;
  createdAt?: string;
}

export interface QueueEntry {
  id: string;
  patientId?: string;
  tokenNumber: number;
  queueDate: string;
  complaint?: string;
  isRegular: boolean;
  status: string;
  careType?: string;
  departmentId?: string;
  department?: { id: string; name: string; code: string } | null;
  diagnosis?: string;
  doctorNotes?: string;
  /** Advice printed on the patient's prescription. */
  patientNotes?: string;
  /** Internal instructions for nurse/staff — never printed for the patient. */
  staffNotes?: string;
  consultationFee?: number;
  nextAppointmentDate?: string;
  recommendedPackageTypeId?: string;
  recommendedPackageType?: any;
  checkedInAt: string;
  seenAt?: string;
  patient: HistoryPatient;
  doctor?: { id: string; name: string };
  checkedInBy?: { id: string; name: string };
  visitId?: string;
  visit?: {
    id: string;
    treatmentId?: string;
    treatmentName: string;
    treatment?: { id: string; name: string; isGstTaxable: boolean; } | null;
    packagePurchaseId?: string | null;
    conditionTrend?: string;
  };
  admissionId?: string;
  admissionRequestedAt?: string;
  admissionRequestReason?: string;
  admissionRequestedBy?: { id: string; name: string };
  careOrders: CareOrder[];
}

export const QUEUE_STATUS_LABEL: Record<string, string> = {
  WAITING: 'Waiting',
  WITH_DOCTOR: 'With Doctor',
  AWAITING_SERVICE: 'Awaiting Service',
  IN_SERVICE: 'In Service',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};

export const queueStatusVariant = (status: string): 'success' | 'warning' | 'danger' | 'accent' | 'neutral' => {
  switch (status) {
    case 'WAITING':
      return 'warning';
    case 'WITH_DOCTOR':
      return 'accent';
    case 'AWAITING_SERVICE':
      return 'warning';
    case 'IN_SERVICE':
      return 'accent';
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
};

export const ORDER_TYPE_LABEL: Record<string, string> = {
  MEDICINE: 'Medicine',
  INJECTION: 'Injection',
  TREATMENT: 'Treatment',
  OTHER: 'Other',
};

export { money } from '../../utils/money';
