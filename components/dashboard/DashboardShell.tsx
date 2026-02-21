// ═══════════════════════════════════════════════════════════════
// SmartUp Portal — Dashboard Shell (shared layout)
// ═══════════════════════════════════════════════════════════════
// Wraps all role dashboards with sidebar, header, and user info.
// ═══════════════════════════════════════════════════════════════

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  BookOpen,
  Users,
  GraduationCap,
  Eye,
  Shield,
  UserCheck,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  active?: boolean;
}

interface DashboardShellProps {
  role: string;
  userName: string;
  userEmail: string;
  navItems: NavItem[];
  children: React.ReactNode;
}

const ROLE_COLORS: Record<string, string> = {
  coordinator:        'bg-blue-600',
  academic_operator:  'bg-amber-600',
  hr:                 'bg-teal-600',
  teacher:            'bg-emerald-600',
  student:            'bg-violet-600',
  academic:           'bg-amber-700',
  parent:             'bg-rose-600',
  owner:              'bg-slate-700',
  ghost:              'bg-gray-600',
};

const ROLE_LABELS: Record<string, string> = {
  coordinator:        'Batch Coordinator',
  academic_operator:  'Academic Operator',
  hr:                 'HR Associate',
  teacher:            'Teacher',
  student:            'Student',
  academic:           'Academic (Legacy)',
  parent:             'Parent',
  owner:              'Owner / Admin',
  ghost:              'Ghost Observer',
};

const ROLE_ICONS: Record<string, LucideIcon> = {
  coordinator:        Users,
  academic_operator:  UserCheck,
  hr:                 Users,
  teacher:            BookOpen,
  student:            GraduationCap,
  academic:           UserCheck,
  parent:             Shield,
  owner:              LayoutDashboard,
  ghost:              Eye,
};

export default function DashboardShell({
  role,
  userName,
  userEmail,
  navItems,
  children,
}: DashboardShellProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const roleColor = ROLE_COLORS[role] || 'bg-gray-700';
  const roleLabel = ROLE_LABELS[role] || role;
  const RoleIcon = ROLE_ICONS[role] || LayoutDashboard;

  async function handleLogout() {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-gray-800 bg-gray-900 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-gray-800 px-5">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${roleColor}`}>
            <RoleIcon className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wide">SmartUp</h1>
            <p className="text-[10px] text-gray-400">{roleLabel}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-gray-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  item.active
                    ? `${roleColor} text-white`
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* User card */}
        <div className="border-t border-gray-800 p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${roleColor} text-sm font-bold`}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-xs text-gray-500 truncate">{userEmail}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-sm text-gray-400 transition-colors hover:border-red-700 hover:bg-red-950/30 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar (mobile) */}
        <header className="flex h-14 items-center gap-3 border-b border-gray-800 bg-gray-900/80 px-4 backdrop-blur-sm lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-white">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-bold">SmartUp</h1>
          <span className={`ml-auto rounded px-2 py-0.5 text-xs font-medium text-white ${roleColor}`}>
            {roleLabel}
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
