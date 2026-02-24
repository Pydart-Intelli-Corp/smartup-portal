// ═══════════════════════════════════════════════════════════════
// SmartUp Portal — Dashboard Shell (shared layout)
// ═══════════════════════════════════════════════════════════════
// Wraps all role dashboards with sidebar, header, and user info.
// Uses SmartUp brand theme colors via CSS variables
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

// Role colors using SmartUp theme - primary green with tint variations
const ROLE_COLORS: Record<string, string> = {
  coordinator:        'bg-primary',
  academic_operator:  'bg-secondary',
  hr:                 'bg-secondary',
  teacher:            'bg-primary',
  student:            'bg-primary',
  academic:           'bg-secondary',
  parent:             'bg-secondary',
  owner:              'bg-primary',
  ghost:              'bg-muted',
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

  const roleColor = ROLE_COLORS[role] || 'bg-muted';
  const roleLabel = ROLE_LABELS[role] || role;
  const RoleIcon = ROLE_ICONS[role] || LayoutDashboard;

  async function handleLogout() {
    await fetch('/api/v1/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <div className="flex h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-border bg-card transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 border-b border-border px-5">
          <img src="/logo/IMG_3579.PNG" alt="SmartUp" className="h-8 w-8 object-contain" />
          <div>
            <h1 className="text-sm font-bold tracking-wide text-foreground">SmartUp</h1>
            <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-muted-foreground hover:text-foreground"
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
                    ? `${roleColor} text-primary-foreground`
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* User card */}
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full ${roleColor} text-sm font-bold text-primary-foreground`}>
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium truncate text-foreground">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
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
        <header className="flex h-14 items-center gap-3 border-b border-border bg-card/80 px-4 backdrop-blur-sm lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-muted-foreground hover:text-foreground">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-sm font-bold text-foreground">SmartUp</h1>
          <span className={`ml-auto rounded px-2 py-0.5 text-xs font-medium text-primary-foreground ${roleColor}`}>
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
