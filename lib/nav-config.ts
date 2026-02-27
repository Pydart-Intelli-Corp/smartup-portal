// ═══════════════════════════════════════════════════════════════
// SmartUp Portal — Centralized Navigation Config
// ═══════════════════════════════════════════════════════════════
// Single source of truth for sidebar nav items per role.
// DashboardShell auto-resolves the active item from pathname.
// ═══════════════════════════════════════════════════════════════

import {
  LayoutDashboard,
  Database,
  Users,
  CreditCard,
  BarChart3,
  BookOpen,
  Eye,
  Shield,
  GraduationCap,
  XCircle,
  Award,
  Briefcase,
  Monitor,
  UserCog,
  MessageSquare,
  ClipboardList,
  Calendar,
  CalendarClock,
  Bell,
  FileText,
  Brain,
  Activity,
  User,
  Star,
  FolderOpen,
  CheckCircle2,
  Trophy,
  ListChecks,
  DollarSign,
  Send,
  Layers,
  type LucideIcon,
} from 'lucide-react';

export interface NavItemConfig {
  label: string;
  href: string;
  icon: LucideIcon;
  /** If set, this nav item is only shown when the user has this permission */
  permissionKey?: string;
}

/* ── Per-role nav definitions ── */

const OWNER_NAV: NavItemConfig[] = [
  { label: 'Overview',        href: '/owner',                   icon: LayoutDashboard },
  { label: 'Batches',         href: '/owner/batches',           icon: Database },
  { label: 'Academic Ops',    href: '/owner/academic-operator', icon: Calendar },
  { label: 'Teachers',        href: '/owner/teachers',          icon: GraduationCap },
  { label: 'HR',              href: '/owner/hr',                icon: Briefcase },
  { label: 'Roles',           href: '/owner/roles',             icon: UserCog },
  { label: 'Fees & Payments', href: '/owner/fees',              icon: CreditCard },
  { label: 'Exams',           href: '/owner/exams',             icon: Award },
  { label: 'Reports',         href: '/owner/reports',           icon: BarChart3 },
  { label: 'Ghost Mode',      href: '/ghost',                   icon: Eye },
  { label: 'System',          href: '/owner/system',            icon: Shield },
];

const BATCH_COORDINATOR_NAV: NavItemConfig[] = [
  { label: 'Overview',        href: '/batch-coordinator',                 icon: LayoutDashboard },
  { label: 'Batches',         href: '/batch-coordinator#batches',         icon: BookOpen },
  { label: 'Live Sessions',   href: '/batch-coordinator#sessions',        icon: Activity },
  { label: 'AI Monitoring',   href: '/batch-coordinator#monitoring',      icon: Brain },
  { label: 'Reports',         href: '/batch-coordinator#reports',         icon: FileText },
  { label: 'Students',        href: '/batch-coordinator#students',        icon: Users },
  { label: 'Admissions',      href: '/batch-coordinator/admissions',      icon: GraduationCap, permissionKey: 'admissions_manage' },
  { label: 'Cancellations',   href: '/batch-coordinator/cancellations',   icon: XCircle, permissionKey: 'cancellations_manage' },
];

const ACADEMIC_OPERATOR_NAV: NavItemConfig[] = [
  { label: 'Overview',    href: '/academic-operator',               icon: LayoutDashboard },
  { label: 'Batches',     href: '/academic-operator#batches',      icon: BookOpen },
  { label: 'Sessions',    href: '/academic-operator#sessions',     icon: Activity },
  { label: 'Requests',    href: '/academic-operator#requests',     icon: ClipboardList },
  { label: 'Monitoring',  href: '/academic-operator#monitoring',   icon: Brain },
  { label: 'Materials',   href: '/academic-operator#materials',    icon: FolderOpen },
];

const HR_NAV: NavItemConfig[] = [
  { label: 'Overview',      href: '/hr',                icon: LayoutDashboard },
  { label: 'Teachers',      href: '/hr#teachers',       icon: BookOpen },
  { label: 'Students',      href: '/hr#students',       icon: GraduationCap },
  { label: 'Parents',       href: '/hr#parents',        icon: Shield },
  { label: 'Coordinators',  href: '/hr#coordinators',   icon: Users },
  { label: 'Acad. Operators', href: '/hr#academic_operators', icon: Briefcase },
  { label: 'Ghost Observers', href: '/hr#ghost_observers', icon: Eye },
  { label: 'Cancellations', href: '/hr#cancellations',  icon: XCircle,       permissionKey: 'cancellations_manage' },
  { label: 'Attendance',    href: '/hr#attendance',     icon: ClipboardList, permissionKey: 'attendance_view' },
  { label: 'Payroll',       href: '/hr#payroll',        icon: CreditCard,    permissionKey: 'payroll_manage' },
  { label: 'Fee Rates',     href: '/hr#fee_rates',      icon: DollarSign },
  { label: 'Leave Requests', href: '/hr#leave_requests', icon: CalendarClock },
];

const TEACHER_NAV: NavItemConfig[] = [
  { label: 'Overview',       href: '/teacher',             icon: LayoutDashboard },
  { label: 'My Profile',     href: '/teacher#profile',     icon: User },
  { label: 'My Batches',     href: '/teacher#batches',     icon: BookOpen },
  { label: 'Schedule',       href: '/teacher#schedule',    icon: ClipboardList },
  { label: 'Exams',          href: '/teacher/exams',       icon: Award,          permissionKey: 'exams_create' },
  { label: 'Salary',         href: '/teacher#salary',      icon: CreditCard,     permissionKey: 'salary_view' },
  { label: 'Ratings',        href: '/teacher#ratings',     icon: Star },
  { label: 'Materials',      href: '/teacher#materials',   icon: FolderOpen },
  { label: 'Leave',          href: '/teacher#leave',       icon: CalendarClock },
];

const STUDENT_NAV: NavItemConfig[] = [
  { label: 'Dashboard',   href: '/student',              icon: LayoutDashboard },
  { label: 'Batches',     href: '/student#batches',      icon: BookOpen },
  { label: 'Classes',     href: '/student#classes',      icon: Calendar,       permissionKey: 'rooms_view' },
  { label: 'Sessions',    href: '/student#sessions',     icon: ListChecks },
  { label: 'Attendance',  href: '/student#attendance',   icon: CheckCircle2 },
  { label: 'Exams',       href: '/student#exams',        icon: Trophy,         permissionKey: 'exams_view' },
  { label: 'Fees',        href: '/student#fees',         icon: CreditCard,     permissionKey: 'fees_view' },
  { label: 'Materials',   href: '/student#materials',    icon: FolderOpen },
  { label: 'Profile',     href: '/student#profile',      icon: User },
  { label: 'Requests',   href: '/student#requests',     icon: Send },
];

const PARENT_NAV: NavItemConfig[] = [
  { label: 'Dashboard',    href: '/parent',               icon: LayoutDashboard },
  { label: 'Attendance',   href: '/parent#attendance',    icon: ClipboardList, permissionKey: 'attendance_view' },
  { label: 'Exams',        href: '/parent#exams',         icon: GraduationCap, permissionKey: 'exams_view' },
  { label: 'Fee Ledger',   href: '/parent#fees',          icon: CreditCard,    permissionKey: 'fees_view' },
  { label: 'Reports',      href: '/parent#reports',       icon: BarChart3,     permissionKey: 'reports_view' },
  { label: 'AI Monitoring', href: '/parent#monitoring',   icon: Brain },
  { label: 'Complaints',   href: '/parent#complaints',    icon: MessageSquare, permissionKey: 'complaints_file' },
  { label: 'Requests',     href: '/parent#requests',      icon: CalendarClock },
];

const GHOST_NAV: NavItemConfig[] = [
  { label: 'Dashboard', href: '/ghost',          icon: LayoutDashboard },
  { label: 'Observe',   href: '/ghost',          icon: Eye, permissionKey: 'ghost_observe' },
  { label: 'Oversight',  href: '/ghost/monitor',  icon: Monitor, permissionKey: 'ghost_observe' },
  { label: 'By Batch',   href: '/ghost#batch',    icon: BookOpen, permissionKey: 'ghost_observe' },
  { label: 'By Teacher',  href: '/ghost#teacher',  icon: User, permissionKey: 'ghost_observe' },
];

const ROLE_NAV: Record<string, NavItemConfig[]> = {
  owner:             OWNER_NAV,
  batch_coordinator: BATCH_COORDINATOR_NAV,
  academic_operator: ACADEMIC_OPERATOR_NAV,
  hr:                HR_NAV,
  teacher:           TEACHER_NAV,
  student:           STUDENT_NAV,
  parent:            PARENT_NAV,
  ghost:             GHOST_NAV,
};

/** Get the nav items for a given role, optionally filtered by permissions */
export function getNavForRole(
  role: string,
  permissions?: Record<string, boolean>,
): NavItemConfig[] {
  const items = ROLE_NAV[role] ?? [];
  if (!permissions) return items;
  return items.filter(item => {
    if (!item.permissionKey) return true;
    return permissions[item.permissionKey] !== false;
  });
}

/** Resolve the active nav item based on current pathname.
 *  Picks the item whose base href (sans hash) is the longest prefix match. */
export function resolveActiveNav(
  items: NavItemConfig[],
  pathname: string,
  currentHash?: string,
): (NavItemConfig & { active: boolean })[] {
  const fullPath = pathname + (currentHash || '');
  let bestIdx = 0;
  let bestLen = 0;

  items.forEach((item, idx) => {
    const hasHash = item.href.includes('#');
    if (hasHash) {
      // For hash-based nav items, match pathname + hash exactly
      const [base, hash] = item.href.split('#');
      if ((pathname === base || pathname.startsWith(base + '/')) && currentHash === '#' + hash) {
        const matchLen = item.href.length;
        if (matchLen > bestLen) { bestLen = matchLen; bestIdx = idx; }
      }
    } else {
      // For non-hash nav items, match by pathname prefix
      if (pathname === item.href || pathname.startsWith(item.href + '/')) {
        // Only pick this if no hash-based item matched and no hash is present
        if (item.href.length > bestLen && !currentHash) {
          bestLen = item.href.length;
          bestIdx = idx;
        } else if (item.href.length > bestLen && bestLen === 0) {
          // Fallback: if nothing matched yet, use this as default
          bestLen = item.href.length;
          bestIdx = idx;
        }
      }
    }
  });

  return items.map((item, idx) => ({ ...item, active: idx === bestIdx }));
}
