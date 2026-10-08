import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { BrandLogo } from './components/common/BrandLogo';
import { TopNav } from './components/TopNav';
import { NavTab, ALL_NAV_ITEMS, DEFAULT_TAB_BY_ROLE, effectiveRoleFor } from './config/navigation';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { RMDesk } from './components/RM/RMDesk';
import { PatientList } from './components/Patients/PatientList';
import { VisitList } from './components/Visits/VisitList';
import { InvoiceList } from './components/Invoices/InvoiceList';
import { PackageList } from './components/Packages/PackageList';
import { PrescriptionList } from './components/Prescriptions/PrescriptionList';
import { PurchaseList } from './components/Purchases/PurchaseList';
import { CommissionList } from './components/Commissions/CommissionList';
import { UserList } from './components/Users/UserList';
import { AnalyticsDashboard } from './components/Analytics/AnalyticsDashboard';
import { AppointmentsCalendar } from './components/Appointments/AppointmentsCalendar';
import { ClinicList } from './components/Clinics/ClinicList';
import { OPDScreen } from './components/OPD/OPDScreen';
import { IPDScreen } from './components/IPD/IPDScreen';
import { WardBedAdmin } from './components/Wards/WardBedAdmin';
import { DepartmentAdmin } from './components/Departments/DepartmentAdmin';
import { TreatmentMaster } from './components/Treatments/TreatmentMaster';
import { QueueBoard } from './components/Queue/QueueBoard';
import { ReceptionDesk } from './components/Reception/ReceptionDesk';
import { PrescriptionTemplates } from './components/Templates/PrescriptionTemplates';
import { AccountsDashboard } from './components/Accounts/AccountsDashboard';
import { AdminPanel } from './components/Admin/AdminPanel';
import { PlatformConsole } from './components/Platform/PlatformConsole';
import { StaffTasks } from './components/Staff/StaffTasks';
import { PharmacyCounter } from './components/Pharmacy/PharmacyCounter';

/** Every tab has exactly one screen; a missing entry here is what previously showed
 *  the "coming soon" placeholder for Medicines and Purchases. */
const TAB_SCREENS: Record<NavTab, React.ComponentType> = {
  dashboard: Dashboard,
  reception: ReceptionDesk,
  queue: QueueBoard,
  tasks: StaffTasks,
  templates: PrescriptionTemplates,
  accounts: AccountsDashboard,
  admin: AdminPanel,
  platform: PlatformConsole,
  opd: OPDScreen,
  ipd: IPDScreen,
  patients: PatientList,
  visits: VisitList,
  invoices: InvoiceList,
  packages: PackageList,
  prescriptions: PrescriptionList,
  medicines: PharmacyCounter,
  purchases: PurchaseList,
  commissions: CommissionList,
  users: UserList,
  analytics: AnalyticsDashboard,
  calendar: AppointmentsCalendar,
  clinics: ClinicList,
  wards: WardBedAdmin,
  departments: DepartmentAdmin,
  rmdesk: RMDesk,
  treatments: TreatmentMaster,
};

function renderTab(tab: NavTab, role: string) {
  // The nav already hides tabs a role cannot use; this re-checks so a stale
  // activeTab (e.g. after switching accounts) cannot render a restricted screen.
  const config = ALL_NAV_ITEMS.find((item) => item.id === tab);
  if (config && !config.allowedRoles.includes(role)) {
    return (
      <div className="bg-surface-card rounded-[10px] border border-border p-8 text-center space-y-2 shadow-xs">
        <h2 className="text-base font-semibold text-ink-primary">Access restricted</h2>
        <p className="text-xs text-ink-secondary max-w-md mx-auto">
          Your role ({role}) does not have access to the {config.label} module.
        </p>
      </div>
    );
  }

  const Screen = TAB_SCREENS[tab];
  return (
    <ErrorBoundary key={tab}>
      <Screen />
    </ErrorBoundary>
  );
}

/** Each role opens on its own workspace; falls back to the first tab it may use. */
function defaultTabForRole(role: string): NavTab {
  const preferred = DEFAULT_TAB_BY_ROLE[role];
  if (preferred && ALL_NAV_ITEMS.find((i) => i.id === preferred)?.allowedRoles.includes(role)) {
    return preferred;
  }
  const firstAllowed = ALL_NAV_ITEMS.find((item) => item.allowedRoles.includes(role));
  return firstAllowed ? firstAllowed.id : 'dashboard';
}

/**
 * Which screen this tab was last on. Kept in sessionStorage so it is per browser
 * tab, matching where the session itself lives — refreshing the pharmacy counter
 * returns to the pharmacy counter, and does not disturb the ward screen open
 * next to it. Navigation is state-driven rather than routed, so without this a
 * refresh drops every screen back to the role's landing page.
 */
const ACTIVE_TAB_KEY = 'hms_active_tab';

const readStoredTab = (): NavTab | null => {
  try {
    return (sessionStorage.getItem(ACTIVE_TAB_KEY) as NavTab) || null;
  } catch {
    return null;
  }
};

function MainAppContent() {
  const { user, loading, clinicContext, exitClinic } = useAuth();
  const [activeTab, setActiveTab] = useState<NavTab | null>(readStoredTab);

  const selectTab = (tab: NavTab) => {
    setActiveTab(tab);
    try {
      sessionStorage.setItem(ACTIVE_TAB_KEY, tab);
    } catch {
      /* Non-fatal — the tab just won't be remembered across a refresh. */
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-page flex flex-col items-center justify-center gap-6 text-ink-secondary text-xs font-sans">
        <BrandLogo variant="lockup" className="h-16 sm:h-20" />
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border-2 border-brand border-t-transparent animate-spin" />
          Starting Centria…
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const navRole = effectiveRoleFor(user.role, !!clinicContext);
  // A remembered tab is only honoured if this role may actually open it —
  // signing out and back in as someone else in the same browser tab would
  // otherwise land them on a screen they have no access to.
  const remembered =
    activeTab && ALL_NAV_ITEMS.find((i) => i.id === activeTab)?.allowedRoles.includes(navRole)
      ? activeTab
      : null;
  const currentTab = remembered ?? defaultTabForRole(navRole);

  return (
    <div className="min-h-screen bg-surface-page text-ink-primary flex flex-col font-sans">
      <TopNav activeTab={currentTab} onSelectTab={selectTab} />
      {clinicContext && (
        <div className="bg-triage-active text-white px-4 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs">
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-white/80 shrink-0 animate-pulse" />
            <span className="truncate">
              Viewing <strong className="font-semibold">{clinicContext.name}</strong> as platform admin
            </span>
          </span>
          <button
            onClick={() => {
              exitClinic();
              selectTab('platform');
            }}
            className="shrink-0 px-2.5 py-1 rounded bg-white/15 hover:bg-white/25 font-medium transition-colors cursor-pointer"
          >
            Leave hospital
          </button>
        </div>
      )}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {renderTab(currentTab, navRole)}
      </main>
      <footer className="bg-shell border-t border-shell-line py-3 px-6 flex items-center justify-center gap-2.5">
        <BrandLogo tone="onDark" className="h-3.5" />
        <span className="w-1 h-1 rounded-full bg-shell-line" />
        <span className="text-[11px] text-shell-muted">Hospital Management System</span>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <MainAppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
