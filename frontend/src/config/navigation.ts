import {
  LayoutDashboard,
  Users,
  Calendar,
  CalendarDays,
  Receipt,
  Package,
  FileText,
  Pill,
  ShoppingCart,
  Percent,
  BarChart3,
  Building2,
  Building,
  Stethoscope,
  BedDouble,
  ClipboardList,
  ClipboardCheck,
  ConciergeBell,
  FileStack,
  Landmark,
  ShieldCheck,
  Network,
  Tag,
  HeartHandshake,
} from 'lucide-react';
import React from 'react';

export type NavTab =
  | 'dashboard'
  | 'admin'
  | 'rmdesk'
  | 'reception'
  | 'queue'
  | 'tasks'
  | 'templates'
  | 'accounts'
  | 'opd'
  | 'ipd'
  | 'patients'
  | 'visits'
  | 'invoices'
  | 'packages'
  | 'prescriptions'
  | 'medicines'
  | 'purchases'
  | 'commissions'
  | 'users'
  | 'analytics'
  | 'calendar'
  | 'clinics'
  | 'platform'
  | 'wards'
  | 'departments'
  | 'treatments';

export interface NavItemConfig {
  id: NavTab;
  label: string;
  icon: React.ElementType;
  allowedRoles: string[];
}

/**
 * The hospital owner runs one hospital and sees all of its screens.
 *
 * SUPER_ADMIN is deliberately NOT in here. They are the software vendor, not clinical
 * staff — their own navigation is the platform console. When they step into a client
 * hospital to support it they navigate as an owner, via `effectiveRoleFor` below.
 */
const OWNER = ['MASTER'];

/**
 * PRIMARY is the day-to-day workspace for a role — the screens they live in.
 * Anything reference, configuration or reporting belongs in SECONDARY.
 */
export const PRIMARY_NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    allowedRoles: [...OWNER, 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'ACCOUNT'],
  },
  {
    id: 'platform',
    label: 'Platform',
    icon: Network,
    allowedRoles: ['SUPER_ADMIN'],
  },
  {
    id: 'admin',
    label: 'Admin Panel',
    icon: ShieldCheck,
    allowedRoles: OWNER,
  },
  {
    // The relationship manager's book of business: who to call, and what they are owed.
    id: 'rmdesk',
    label: 'Relationship Desk',
    icon: HeartHandshake,
    allowedRoles: [...OWNER, 'RM'],
  },
  {
    id: 'reception',
    label: 'Reception',
    icon: ConciergeBell,
    allowedRoles: [...OWNER, 'RECEPTION', 'RM'],
  },
  {
    id: 'queue',
    label: 'Patient Queue',
    icon: ClipboardList,
    allowedRoles: [...OWNER, 'DOCTOR', 'RECEPTION', 'RM', 'NURSE', 'STAFF', 'PHARMACY'],
  },
  {
    // Nurses see IPD work, service staff see OPD work — scoped server-side.
    id: 'tasks',
    label: 'Care Tasks',
    icon: ClipboardCheck,
    allowedRoles: [...OWNER, 'NURSE', 'STAFF'],
  },
  {
    id: 'opd',
    label: 'OPD',
    icon: Stethoscope,
    allowedRoles: [...OWNER, 'DOCTOR'],
  },
  {
    id: 'ipd',
    label: 'IPD',
    icon: BedDouble,
    allowedRoles: [...OWNER, 'DOCTOR', 'NURSE', 'RECEPTION'],
  },
  {
    id: 'medicines',
    label: 'Pharmacy',
    icon: Pill,
    allowedRoles: [...OWNER, 'PHARMACY'],
  },
  {
    id: 'accounts',
    label: 'Accounts',
    icon: Landmark,
    allowedRoles: [...OWNER, 'ACCOUNT'],
  },
];

export const SECONDARY_NAV_ITEMS: NavItemConfig[] = [
  {
    id: 'patients',
    label: 'Patients',
    icon: Users,
    allowedRoles: [...OWNER, 'DOCTOR', 'RM', 'RECEPTION', 'PHARMACY', 'NURSE', 'STAFF'],
  },
  {
    id: 'templates',
    label: 'My Templates',
    icon: FileStack,
    allowedRoles: [...OWNER, 'DOCTOR'],
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: CalendarDays,
    allowedRoles: [...OWNER, 'DOCTOR', 'RM', 'RECEPTION'],
  },
  {
    id: 'prescriptions',
    label: 'Prescriptions',
    icon: FileText,
    allowedRoles: [...OWNER, 'DOCTOR', 'PHARMACY', 'NURSE', 'STAFF'],
  },
  {
    id: 'visits',
    label: 'Visits',
    icon: Calendar,
    allowedRoles: [...OWNER, 'DOCTOR', 'RM', 'RECEPTION'],
  },
  {
    id: 'packages',
    label: 'Packages',
    icon: Package,
    allowedRoles: [...OWNER, 'DOCTOR', 'RM', 'RECEPTION', 'ACCOUNT'],
  },
  {
    id: 'invoices',
    label: 'Invoices',
    icon: Receipt,
    allowedRoles: [...OWNER, 'RECEPTION', 'ACCOUNT'],
  },
  {
    id: 'purchases',
    label: 'Purchases',
    icon: ShoppingCart,
    allowedRoles: [...OWNER, 'PHARMACY', 'ACCOUNT'],
  },
  {
    id: 'commissions',
    label: 'Commissions',
    icon: Percent,
    allowedRoles: [...OWNER, 'DOCTOR', 'ACCOUNT'],
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    allowedRoles: [...OWNER, 'DOCTOR', 'ACCOUNT'],
  },
  {
    id: 'treatments',
    label: 'Treatments & Prices',
    icon: Tag,
    allowedRoles: OWNER,
  },
  {
    id: 'departments',
    label: 'Departments',
    icon: Network,
    allowedRoles: OWNER,
  },
  {
    id: 'wards',
    label: 'Wards & Beds',
    icon: Building,
    allowedRoles: [...OWNER, 'RECEPTION', 'NURSE'],
  },
  {
    id: 'users',
    label: 'Users',
    icon: Users,
    allowedRoles: OWNER,
  },
  {
    id: 'clinics',
    label: 'Hospitals',
    icon: Building2,
    allowedRoles: ['SUPER_ADMIN'],
  },
];

export const ALL_NAV_ITEMS: NavItemConfig[] = [...PRIMARY_NAV_ITEMS, ...SECONDARY_NAV_ITEMS];

/**
 * Where each role starts. Stated explicitly rather than "first tab they're allowed",
 * so re-ordering the menus can never silently move someone's landing page.
 */
export const DEFAULT_TAB_BY_ROLE: Record<string, NavTab> = {
  SUPER_ADMIN: 'platform',
  MASTER: 'admin',
  DOCTOR: 'queue',
  NURSE: 'tasks',
  STAFF: 'tasks',
  RECEPTION: 'reception',
  RM: 'rmdesk',
  PHARMACY: 'medicines',
  ACCOUNT: 'accounts',
};


/**
 * Which role's menu to show.
 *
 * A platform admin working inside a client hospital navigates that hospital as its
 * owner would; outside of one they only see the platform console. This keeps the
 * vendor out of day-to-day clinical screens they have no business in.
 */
export function effectiveRoleFor(role: string, insideClinicContext: boolean): string {
  return role === 'SUPER_ADMIN' && insideClinicContext ? 'MASTER' : role;
}
