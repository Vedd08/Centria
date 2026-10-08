import React from 'react';
import { DayBookScreen } from '../DayBook/DayBookScreen';

/**
 * OPD is the outpatient day-book. A doctor sees only their own consultations
 * (scopeToOwnDoctor); admins can filter across the clinic.
 */
export const OPDScreen: React.FC = () => (
  <DayBookScreen
    visitType="OPD"
    scopeToOwnDoctor
    title="OPD — Outpatient Day Book"
    subtitle="Consultation register. Open any row to see that patient's full history, images and lifetime value."
  />
);
