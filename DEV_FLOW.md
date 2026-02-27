# SmartUp Portal — Development Flow & Status

---

**Portal Project:** `G:\smartup\smartup-portal`  
**Teacher App:** `G:\smartup\smartup-teacher`  
**Spec Guide:** `G:\smartup\portal_dev` (build plan)  
**Server Build:** `G:\smartup\server_build` (2 servers — media + portal)  
**Last Updated:** February 27, 2026  
**Latest Commit:** Full system audit: catch-up migration 032 (9 missing tables, 10 column fixes), HR attendance ambiguous-status fix, payroll column name alignment, owner dashboard display_name fix — all 29 API endpoints now passing 100%

---

## Architecture

```
┌──────────────────────────────────┐     ┌─────────────────────────┐
│       SmartUp Portal             │     │   LiveKit Media Server  │
│  smartuplearning.online          │◄───►│   76.13.244.54:7880     │
│                                  │     │                         │
│  Next.js 16.1.6 (Turbopack)     │     │  WebRTC Rooms           │
│  197 source files                │     │  Video / Audio          │
│  ~42,900 LOC                     │     │  Data Channels (Chat)   │
│  76 API Routes                   │     │  Screen Share            │
│  10 Role Dashboards              │     └─────────────────────────┘
│  19 Classroom Components         │
│  LiveKit Token Generation        │     ┌─────────────────────────┐
│  Email Notifications (29+ tpl)   │     │  SmartUp Teacher App    │
│  PostgreSQL Auth (bcrypt)        │     │  Flutter / Android       │
│  Redis + BullMQ Queue            │     │  com.smartup.screenshare │
│  Permission System (RBAC)        │     │                         │
│  Batch Management System         │     │  9 Dart files, ~1,637 LOC│
│  Exam System                     │     │  LiveKit screen share    │
│  Payment & Fee Management        │     │  FCM push notifications  │
│  Payroll Engine                  │     │  Deep link from emails   │
│  Attendance Tracking             │     │  Foreground service      │
└──────────────────────────────────┘     └─────────────────────────┘
```

**Two-Server Stack:**

| Server | IP | Domain | Stack |
|--------|-----|--------|-------|
| LiveKit Media | `76.13.244.54` | `media.smartuplearning.online` | LiveKit 1.9.11 · Nginx |
| Portal | `76.13.244.60` | `smartuplearning.online` | Next.js 16.1.6 · PostgreSQL 15 · Redis 7 · PM2 |

---

## Brand Theme & Design System

### Brand Palette (defined in `globals.css`)

| Token | Value | Hex | Usage |
|-------|-------|-----|-------|
| `--brand-green` | `oklch(0.723 0.191 145)` | `#22C55E` | Primary Green — CTAs, active states, sidebar |
| `--brand-green-dark` | `oklch(0.627 0.194 145)` | `#16A34A` | Hover states, email headers |
| `--brand-green-light` | `oklch(0.792 0.209 148)` | `#4ADE80` | Highlights, badges |
| `--brand-teal` | `oklch(0.679 0.132 175)` | `#14B8A6` | Accent Teal — secondary buttons, info cards |
| `--brand-teal-dark` | `oklch(0.600 0.130 175)` | `#0D9488` | Teal hover states |
| `--brand-teal-light` | `oklch(0.750 0.140 180)` | `#2DD4BF` | Teal highlights |

### Semantic Colors

| Purpose | Color | CSS Class |
|---------|-------|-----------|
| Success | Green | `text-green-600`, `.status-success` |
| Warning | Amber | `text-amber-600`, `.status-warning` |
| Danger | Red | `text-red-600`, `.status-cancelled` |
| Info | Blue | `text-blue-600`, `.status-info` |
| Live | Green pulse | `.status-live`, `.live-pulse` |

### CSS Utilities (globals.css)

| Class | Description |
|-------|-------------|
| `.bg-brand-gradient` | `linear-gradient(135deg, green → teal)` |
| `.text-brand-gradient` | Gradient text with `background-clip: text` |
| `.btn-brand` | Gradient button with hover brightness+translate |
| `.status-live/scheduled/ended/cancelled` | Status badge color presets |
| `.classroom-root` | Disables touch callout/highlight for classroom |

### Dark Mode

Root `<html>` has `className="dark"`. All CSS custom properties have dark-mode variants with brighter brand colors and near-black backgrounds with green tint. Sidebar uses dedicated dark palette (`oklch(0.145 0.02 145)` base).

### Fonts

Geist + Geist Mono (loaded via `next/font/google`).

### Animations (4 keyframes)

| Name | Purpose |
|------|---------|
| `livePulse` | 2s opacity pulse for live indicators |
| `sidebar-ripple` | Click ripple on sidebar nav items |
| `sidebar-indicator` | Active nav indicator bar entrance |
| `sidebar-fade-in` | Sidebar item slide-in entrance |

---

## Shared Component Library

### `components/dashboard/shared.tsx` — 1,143 lines, 72 exports

The design system foundation. Every dashboard imports from this file. Organized in 15 sections:

| Section | Components | Key Exports |
|---------|------------|-------------|
| **Buttons** | 2 | `Button` (6 variants × 4 sizes, `loading` prop shows Loader2 spinner), `IconButton` |
| **Inputs** | 5 | `Input`, `Textarea`, `Select`, `SearchInput` (with search icon), `Toggle` (switch) |
| **Layout** | 4 | `PageHeader` (icon + title + action slot), `RefreshButton`, `TabBar` (pill-style), `UnderlineTabBar` |
| **Filters** | 1 | `FilterSelect` (small inline dropdown) |
| **Forms** | 4 | `FormPanel` (bordered panel), `FormField` (label + error/hint), `FormGrid` (1–4 col responsive), `FormActions` (cancel/submit bar) |
| **Modal** | 1 | `Modal` (centered overlay, body scroll lock, 4 widths: sm/md/lg/xl) |
| **Confirm** | 2 | `ConfirmProvider` + `useConfirm()` hook → `confirm({title, message, variant})` returns `Promise<boolean>` |
| **Cards** | 4 | `Card`, `StatCard` (large KPI), `StatCardSmall` (compact KPI), `InfoCard` (detail field) |
| **Tables** | 4 | `TableWrapper` (scrollable + footer), `THead`, `TH`, `TRow` (hover + selection) |
| **Detail** | 2 | `DetailPanel` (loading/empty states), `DetailHeader` (title + close) |
| **Badges** | 4 | `Badge` (7 variants), `StatusBadge` (16 auto-mapped statuses), `RoleBadge`, `ActiveIndicator` |
| **Roles** | 2 | `ROLE_CONFIG` (10 roles with label/variant/icon/color/bg), `RoleBadge` |
| **Loading** | 4 | `LoadingState`, `Spinner` (3 sizes), `Skeleton`, `EmptyState` |
| **Alerts** | 3 | `Alert` (4 variants, dismissible), `ToastProvider` + `useToast()` (success/error/warning/info, 4s auto-dismiss) |
| **Avatar** | 1 | `Avatar` (initials circle, 3 sizes) |
| **Utils** | 1 | `money(paise, currency?)` → formats to `₹1,500.00` |

**Button variants:** `primary` (emerald), `secondary` (gray), `outline` (border), `ghost` (transparent), `danger` (red), `success` (green)  
**Button sizes:** `xs`, `sm`, `md`, `lg`

### `components/dashboard/DashboardShell.tsx` — 320 lines

Wraps every dashboard page. Provides:
- **Collapsible sidebar** (256px expanded / 72px collapsed) with brand gradient header
- **Navigation** via `getNavForRole()` from `lib/nav-config.ts`
- **Active nav detection** supporting hash-based routes (e.g., `/hr#payroll`)
- **User card** at sidebar bottom with avatar, name, email, logout
- **Mobile drawer** with backdrop overlay
- **Click ripple animation** on nav items (`useRipple` hook)

### `components/dashboard/CreateUserForm.tsx` — 769 lines

Reusable multi-step user creation wizard. Used by HR module and Batch Wizard.

**Exports:**

| Export | Type | Purpose |
|--------|------|---------|
| `SUBJECTS` | `string[]` | 7 subjects (Physics, Chemistry, Mathematics, etc.) |
| `GRADES` | `string[]` | Class 1 through Class 12 |
| `BOARDS` | `string[]` | CBSE, ICSE, State Board, IB, Cambridge, Others |
| `GCC_REGIONS` | `string[]` | Dubai, Abu Dhabi, Sharjah, Qatar, Saudi Arabia, etc. |
| `QUALIFICATIONS` | `string[]` | 15 entries (B.Ed, M.Ed, M.Sc, PhD, etc.) |
| `PwdInput` | component | Password input with show/hide toggle |
| `SubjectSelector` | component | Multi-select checkbox dropdown with tag chips |
| `QualificationSelector` | component | Select with "Other" free-text fallback |
| `CredentialsPanel` | component | Post-creation credential display with copy buttons |
| `CreateUserModal` | component | Full wizard: basic → teaching → academic → guardian → notes → review |

**Wizard steps** are dynamic per role — students get `academic` + `guardian` steps; teachers get `teaching` step.

**Features:**
- Debounced 500ms email existence check (`GET /api/v1/hr/users/:email`)
- Student parent auto-creation (creates parent account + sends credentials)
- Embedded mode (flat inline form for batch wizard) vs full overlay mode
- Post-creation `CredentialsPanel` with copy-to-clipboard + "Add Another"

---

## Navigation System (`lib/nav-config.ts` — 165 lines)

### Per-Role Navigation Items

| Role | Items | Routes |
|------|-------|--------|
| **Owner** | 11 | `/owner`, `/owner/roles`, `/owner/hr`, `/owner/academic-operator`, `/owner/batches`, `/owner/users`, `/owner/fees`, `/owner/reports`, `/owner/exams`, `/ghost`, `/owner/system` |
| **Academic Operator** | 3 | `/academic-operator`, `/academic-operator#batches`, `/academic-operator#sessions` |
| **HR** | 10 | `/hr`, `/hr#teachers`, `/hr#students`, `/hr#parents`, `/hr#coordinators`, `/hr#academic_operators`, `/hr#ghost_observers`, `/hr#cancellations`*, `/hr#attendance`*, `/hr#payroll`* |
| **Batch Coordinator** | 3 | `/batch-coordinator`, `/batch-coordinator/admissions`*, `/batch-coordinator/cancellations`* |
| **Teacher** | 4 | `/teacher`, `/teacher#classes`*, `/teacher/exams`*, `/teacher#salary`* |
| **Student** | 3 | `/student`, `/student#classes`*, `/student/exams`* |
| **Parent** | 4 | `/parent`, `/parent`, `/parent#fees`*, `/parent#complaints`* |
| **Ghost** | 3 | `/ghost`, `/ghost`, `/ghost/monitor`* |

Items marked * are permission-gated — hidden if `permissions[key] === false`.

### Functions

- `getNavForRole(role, permissions?)` — returns filtered `NavItemConfig[]`
- `resolveActiveNav(items, pathname, hash?)` — determines active nav (hash-based matching for single-page tabs, longest-prefix for sub-routes)

---

## Permission System (`lib/permissions.ts` — 249 lines, `lib/permissions-server.ts` — 33 lines)

### Architecture

```
Owner (implicit all permissions)
  │
  └─→ Sets custom_permissions JSONB per user in portal_users
        │
        └─→ getEffectivePermissions(email, role)
              │
              ├─ if role === 'owner' → return {} (all granted)
              └─ else → merge ROLE_DEFAULTS[role] + customOverrides
```

### Permission Categories (8)

| Category | Permissions |
|----------|-------------|
| **Rooms** | `rooms_create`, `rooms_manage`, `rooms_view` |
| **Users** | `users_create`, `users_edit`, `users_deactivate`, `users_reset_password` |
| **Attendance** | `attendance_view`, `attendance_mark` |
| **Exams** | `exams_create`, `exams_view` |
| **Finance** | `fees_view`, `fees_manage`, `salary_view`, `payroll_manage` |
| **Admissions** | `admissions_manage`, `cancellations_manage` |
| **Reports** | `reports_view` |
| **Ghost** | `ghost_observe` |

### Default Permissions by Role

| Permission | Coordinator | AO | HR | Teacher | Student | Parent | Ghost |
|------------|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `rooms_create/manage` | ✅/✅ | ✅/✅ | ❌/❌ | ❌/❌ | ❌/❌ | ❌/❌ | ❌/❌ |
| `users_create/edit/deactivate` | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `attendance_view/mark` | ✅/✅ | ✅/❌ | ✅/❌ | ✅/✅ | ✅/❌ | ✅/❌ | ❌ |
| `cancellations_manage` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `payroll_manage / salary_view` | ❌ | ❌ | ✅/✅ | ❌/✅ | ❌ | ❌ | ❌ |
| `ghost_observe` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| `complaints_file` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

Owner can override any permission for any user via the Roles management page.

---

## Inter-Module Communication

### Module Relationship Diagram

```
                    ┌──────────────┐
                    │    Owner     │ ← Full access to all modules
                    │  (implicit)  │   Sets permissions, manages roles
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │      HR      │  │ Academic Op  │  │    Ghost     │
  │  User CRUD   │  │ Batch CRUD   │  │  Observe     │
  │  Attendance  │  │ Sessions     │  │  Monitor     │
  │  Payroll     │  │ Timetables   │  └──────────────┘
  │  Cancellation│  │ Auto-emails  │
  └──────┬───────┘  └──────┬───────┘
         │                 │
         │    ┌────────────┤
         ▼    ▼            ▼
  ┌──────────────┐  ┌──────────────┐
  │ Coordinator  │  │   Teacher    │
  │ Monitor rooms│  │  Classroom   │
  │ Admissions   │  │  Attendance  │
  │ Cancellations│  │  Exam grading│
  └──────────────┘  └──────────────┘
                           │
                    ┌──────┴───────┐
                    ▼              ▼
             ┌──────────┐  ┌──────────┐
             │ Student  │  │  Parent  │
             │ Classes  │  │ Observe  │
             │ Exams    │  │ Fees     │
             │ Profile  │  │ Reports  │
             └──────────┘  └──────────┘
```

### Data Flow Between Modules

| From | To | Mechanism | Data |
|------|----|-----------|------|
| HR → All | User creation | `POST /api/v1/hr/users` | Creates `portal_users` + `user_profiles`, sends credential email |
| HR → Teacher | Password reset | `POST /api/v1/hr/users/[email]/reset-password` | New password + email notification |
| AO → Batch | Batch creation | `POST /api/v1/batches` | Creates batch, assigns teachers/students/coordinator |
| AO → Sessions | Session scheduling | `POST /api/v1/batch-sessions` | Creates individual or recurring sessions |
| AO → LiveKit | Session start | `POST /api/v1/batch-sessions/[id]/start` | Creates LiveKit room, generates join tokens |
| AO → Email | Timetable send | `POST /api/v1/batch-sessions/weekly-timetable` | Sends timetable to all stakeholders |
| AO → Auto | Polling (60s) | `POST /api/v1/batch-sessions/auto-start` | Auto-starts sessions in prep window |
| AO → Auto | Polling (5min) | `POST /api/v1/batch-sessions/daily-timetable` | Sends morning timetable (deduped) |
| AO → Auto | Polling (60s) | `POST /api/v1/batch-sessions/session-reminder` | Sends join links 30min before class |
| Session change → Auto | Timetable update | `scheduleTimetableUpdate()` in `timetable-auto.ts` | Debounced 5s, sends updated timetable to all |
| Coordinator → Monitor | Room status | `GET /api/v1/coordinator/rooms` | Live room monitoring with student join status |
| Teacher → Classroom | LiveKit join | Token-based auth | WebRTC room connection |
| Student → Classroom | LiveKit join | Token-based auth | WebRTC room connection |
| Parent → Observe | Ghost mode | Token-based auth | Silent observation |
| Webhook → Events | LiveKit events | `POST /api/v1/webhook/livekit` | Room started/finished, join/leave tracking |

### Batch–Session–Room Lifecycle

```
Batch (persistent group)
  │
  ├── students[] (enrolled via AO wizard)
  ├── teachers[] (per subject, assigned via AO wizard)
  ├── coordinator (assigned at creation)
  │
  └── Sessions (scheduled classes within batch)
        │
        ├── status: scheduled → live → ended/cancelled
        │
        └── On START:
              ├── Creates LiveKit room (livekit_room_name)
              ├── Generates join tokens for teacher, students, parents, coordinator
              ├── Returns join URLs for distribution
              │
              └── On END:
                    ├── Records attendance (join/leave times, lateness)
                    ├── Collects teacher rating + student feedback
                    └── LiveKit room destroyed
```

---

## 10 Role Dashboards

All dashboards use `DashboardShell` (sidebar + header) and shared components from `shared.tsx`.

### Owner Dashboard — `OwnerDashboardClient.tsx` (519 lines)

**Route:** `/owner`  
**Sub-routes:** `/owner/roles` (786), `/owner/batches` (1,641), `/owner/users` (388), `/owner/fees` (332), `/owner/reports` (TBD), `/owner/exams` (481), `/owner/payroll` (373), `/owner/system` (330)

**API:** `GET /api/v1/owner/dashboard` (single call returns all data via 8 parallel queries)

**Layout:**
```
┌─ Greeting banner + Refresh + Notification bell ─────────────────┐
├─ KPI Cards (2×2→4-col): Batches, Live Now, Users, Cancelled 30d│
├─ Status Mini-Cards (4-col): Scheduled, Completed, Live, Cancel  │
├─ Charts Row: Area (30d activity) + Pie (subject distribution)   │
├─ Charts Row: Bar (batches by grade) + Users by Role grid         │
├─ Live Classes Alert (green banner, Ghost View button)            │
├─ Recent Batches Table (search + status filter, 25 rows)          │
├─ Recently Added Users (avatar, role badge, date)                 │
└─ Quick Access Cards: Fees, Reports, HR, Ghost Mode               │
```

**Charts:** Recharts — `AreaChart` (conducted vs cancelled), `PieChart` (subjects), `BarChart` (grades)

**Key features:**
- Auto-heals stale `live` rooms → `ended` on the API side
- Ghost View button links to `/classroom/{id}?mode=ghost` for live rooms
- Quick Access cards link to sub-modules

**Owner Sub-Modules:**

| Sub-route | Client Component | Lines | Purpose |
|-----------|-----------------|------:|---------|
| `/owner/roles` | `RolesClient.tsx` | 786 | Role management — per-user permission toggles, role reassignment |
| `/owner/batches` | `BatchesClient.tsx` | 1,641 | Full batch management (mirrors AO but with owner-level controls) |
| `/owner/users` | `UsersClient.tsx` | 388 | User list with role filter, links to HR for CRUD |
| `/owner/fees` | `FeesClient.tsx` | 332 | Fee structure management, invoice generation |
| `/owner/exams` | `ExamsClient.tsx` | 481 | Exam overview and management |
| `/owner/payroll` | `PayrollClient.tsx` | 373 | Payroll period management, payslip generation |
| `/owner/system` | `SystemClient.tsx` | 330 | System settings, academic config |

---

### HR Dashboard — `HRDashboardClient.tsx` (1,609 lines)

**Route:** `/hr`  
**Tabs:** 11 (Overview, Teachers, Students, Parents, Coordinators, Academic Operators, HR Associates, Ghost Observers, Cancellations*, Attendance*, Payroll*)  
*Permission-gated tabs

**API Endpoints:**

| Endpoint | Purpose |
|----------|---------|
| `GET /api/v1/hr/stats` | Role headcounts, alerts (students without parents, teachers without subjects) |
| `GET /api/v1/hr/users?role=X&q=Y` | Paginated user list with search |
| `POST /api/v1/hr/users` | Create user (auto-generates password, sends credentials email) |
| `PATCH /api/v1/hr/users/[email]` | Update user profile fields |
| `DELETE /api/v1/hr/users/[email]` | Soft deactivate (default) or permanent delete (`?permanent=true`) |
| `POST /api/v1/hr/users/[email]/reset-password` | Reset password, email new credentials |
| `GET /api/v1/cancellations` | List cancellation requests |
| `POST /api/v1/cancellations` | Approve/reject cancellation (HR is final approver for teacher-initiated) |
| `GET /api/v1/hr/attendance?resource=X&days=Y` | Attendance summary, per-teacher, per-student breakdowns |
| `GET/POST /api/v1/payroll` | Payroll periods, pay configs, payslip generation, finalization |

**Inline Sub-Components (7):**

| Component | Purpose |
|-----------|---------|
| `OverviewTab` | Stats dashboard + monitoring priority banners + role breakdown cards |
| `UsersTab` | Generic user list (reused for all 7 role tabs) — search, filter, CRUD, expandable rows |
| `UserDetailPanel` | Expanded row with all profile fields in `InfoCard` grid |
| `EditUserModal` | Edit form with role-specific fields (subjects for teachers, grade for students, etc.) |
| `ResetPasswordModal` | Password reset with auto-generate option |
| `CancellationsTab` | Cancellation request management with approval chain visualization |
| `AttendanceTab` | Attendance monitoring (7/14/30/60/90-day periods), stacked bar charts, teacher/student tables |
| `PayrollTab` | Payroll periods, pay configs, payslip generation + finalization |

**Key Workflows:**
- **User creation** → `CreateUserModal` opens → multi-step form → `POST /api/v1/hr/users` → credentials email sent → `CredentialsPanel` shown
- **Student creation with parent** → If parent email doesn't exist → auto-creates parent account in same transaction → both get credential emails
- **Cancellation approval chain** → Teacher requests → Coordinator approves → Admin approves → Academic approves → **HR gives final approval**
- **Payroll flow** → Create period → Set per-teacher pay configs → Generate payslips (auto-calculates from attendance) → Finalize → Mark Paid

---

### Academic Operator Dashboard — `AcademicOperatorDashboardClient.tsx` (4,179 lines)

**Route:** `/academic-operator`  
**Tabs:** 3 (Overview, Batches, Sessions)

**The largest component in the codebase — the operational heart of SmartUp.**

**API Endpoints (20+):**

| Domain | Endpoints |
|--------|-----------|
| Batches | `GET/POST/PATCH/DELETE /api/v1/batches`, `GET /api/v1/batches/[id]`, `GET /api/v1/batches/people` |
| Sessions | `GET/POST/PATCH/DELETE /api/v1/batch-sessions`, `POST /api/v1/batch-sessions/[id]/start` |
| Timetable | `GET/POST /api/v1/batch-sessions/weekly-timetable` |
| Auto-processes | `POST /api/v1/batch-sessions/auto-start`, `daily-timetable`, `session-reminder` |
| People | `GET /api/v1/batches/people`, `GET /api/v1/hr/users` (coordinators, AOs) |
| Settings | `GET /api/v1/academics/settings` |

**Inline Sub-Components (10):**

| Component | Lines | Purpose |
|-----------|------:|---------|
| `OverviewTab` | ~74 | 6 stat cards + live session alert + today's agenda + batch summary |
| `BatchesTab` | ~270 | Batch list table with search/filter, expandable rows, action buttons |
| `WeeklyTimetableModal` | ~246 | Mon–Sat timetable grid, send/update email, stats bar |
| `EditBatchModal` | ~624 | 4-step edit wizard (students → details → teachers → review) |
| `BatchDetailInline` | ~488 | Inline expansion: info, students/parents, sessions grouped by subject |
| `SessionCard` | ~178 | Standalone session card with start/cancel/observe actions |
| `SessionsTab` | ~508 | All sessions table grouped by subject, multi-select bulk cancel |
| `EditSessionModal` | ~28+ | Edit session fields (subject, teacher, date, time, duration, topic) |
| `TimePicker12` | ~25 | 12-hour time picker (Hour × Minute × AM/PM selects) |
| `ScheduleSessionModal` | ~773 | **Schedule Wizard** — the recurring session scheduling engine |

**Batch Templates (4 types):**

| Type | Label | Max Students |
|------|-------|:---:|
| `one_to_one` | One-to-One | 1 |
| `one_to_three` | One-to-Three | 3 |
| `one_to_many` | Classroom | 15 |
| `custom` | Custom | 999 |

**CreateBatchWizard (5 steps):**

```
template → students → details → teachers → review
   │          │          │          │          └─ Summary, confirm create
   │          │          │          └─ Subject toggle chips + per-subject teacher dropdown
   │          │          └─ Grade (auto-section), name, board, coordinator, AO, notes
   │          └─ Student search/select, parent linking, "Add Parent" modal
   └─ 4 batch type cards (One-to-One / One-to-Three / Classroom / Custom)
```

- Grade selection auto-assigns next available section (skips sections used by other batches)
- Batch name auto-generated: `"Class {grade} {section}"`
- Teacher dropdown filtered by subject competency (from `user_profiles.subjects[]`)
- Parent creation opens embedded `CreateUserModal` → auto-links parent to student via `PATCH /api/v1/hr/users/[email]`

**ScheduleSessionModal (Schedule Wizard, 4–5 steps):**

```
[batch] → class → schedule → details → review
   │        │        │          │         └─ Summary + participant list
   │        │        │          └─ Topic + notes (optional)
   │        │        └─ Date, time (12h), duration (6 presets), recurring toggle
   │        └─ Subject dropdown, teacher auto-select (override option)
   └─ Batch picker (only if no batch pre-selected)
```

**Recurring scheduling:**
- Select weekdays (Mon–Sun toggle buttons)
- Unit: Weeks (1–24) or Months (1–12)
- `getDatesForDays()` generates all dates
- Preview shows all generated dates
- Submit loops through dates, creating one session per date via separate `POST` calls
- Reports created/failed counts

**Conflict detection:**
- Fetches existing sessions for the batch on mount
- `findAvailableTime()` auto-adjusts start time to avoid overlaps
- Shows warning banner if manual time creates conflict

**Background Auto-Processes (3 polling effects):**

| Process | Interval | Endpoint | Purpose |
|---------|----------|----------|---------|
| Auto-start | 60s | `POST /api/v1/batch-sessions/auto-start` | Starts sessions when prep window opens |
| Daily timetable | 5 min | `POST /api/v1/batch-sessions/daily-timetable` | Morning timetable email (deduped) |
| Session reminders | 60s | `POST /api/v1/batch-sessions/session-reminder` | Sends join links 30min before class |

**Timetable Auto-Send (`lib/timetable-auto.ts` — 219 lines):**
- Triggered after session changes (create/edit/cancel)
- Debounced 5 seconds per batch_id (prevents spam during bulk operations)
- Derives weekly pattern from all sessions → sends `weeklyTimetableTemplate()` email
- Fire-and-forget (errors logged, never blocks API response)

---

### Batch Coordinator Dashboard — `CoordinatorDashboardClient.tsx` (394 lines)

**Route:** `/batch-coordinator`  
**Sub-routes:** `/batch-coordinator/admissions` (AdmissionsClient), `/batch-coordinator/cancellations` (CancellationsClient, 244 lines)

**Role:** Monitoring-focused (not creation). Watches live rooms, tracks student join status, handles admissions and cancellations.

**Features:**
- Room card list with status filter + search
- Expandable cards showing assigned students' join/leave status
- Stats: total rooms, live, scheduled, ended
- Links to Admissions and Cancellations sub-routes

**Coordinator vs Academic Operator:**

| Aspect | Coordinator | Academic Operator |
|--------|-------------|-------------------|
| Primary function | **Monitor** rooms, admissions, cancellations | **Create & manage** batches, schedule sessions |
| Component size | 394 lines | 4,179 lines |
| Batch creation | ❌ | ✅ Full wizard |
| Session scheduling | ❌ | ✅ Recurring scheduler |
| Room observation | ✅ | ✅ |
| Admissions | ✅ Dedicated sub-route | ✅ Permission exists |
| Cancellations | ✅ Dedicated sub-route | ❌ |

Both are linked via `batches` table: `coordinator_email` + `academic_operator_email` columns.

---

### Teacher Dashboard — `TeacherDashboardClient.tsx` (841 lines)

**Route:** `/teacher`  
**Tabs:** 4 (Overview, My Classes, Profile, Salary*)  
**Sub-routes:** `/teacher/exams` (466 lines)

**Features:**
- Live class join banner with countdown
- Today's schedule timeline
- Stats: live rooms, upcoming, completed, total hours
- Class list with status filter + search, expandable detail rows
- Profile tab with personal info
- Salary tab (permission-gated): earnings overview
- Exam management: create exams, enter marks, publish results

---

### Student Dashboard — `StudentDashboardClient.tsx` (764 lines)

**Route:** `/student`  
**Tabs:** 3 (Overview, My Classes, Profile)  
**Sub-routes:** `/student/exams/[id]` (TakeExamClient, 420 lines)

**Features:**
- Live class join button with countdown
- Payment status alerts
- Stats: upcoming classes, completed, total hours
- Class list with search + expandable detail
- Profile tab
- Exam taking interface

---

### Parent Dashboard — `ParentDashboardClient.tsx` (937 lines)

**Route:** `/parent`  
**Tabs:** 6 (Overview, Attendance, Exams, Fees, Reports, Complaints)

**Features:**
- Child's class schedule + live class observe button
- Attendance tracking with present/late/absent stats
- Exam results viewing
- Fee ledger + payment history + PDF receipt download
- AI-generated academic reports
- Complaint filing system

---

### Ghost Dashboard — `GhostDashboardClient.tsx` (195 lines)

**Route:** `/ghost`  
**Sub-routes:** `/ghost/monitor` (GhostMonitorClient)

**Features:**
- Live room list with "Observe Silently" buttons
- Upcoming rooms list
- Multi-room monitor grid (`/ghost/monitor`) with 30s auto-refresh

---

### Dev Dashboard — `dev/page.tsx` (380 lines)

**Route:** `/dev` (blocked in production)

**Features:**
- Role launcher (quick-switch to any dashboard)
- Health panel (DB, Redis, LiveKit connectivity test)
- LiveKit room test
- Token generation for testing

---

## Build Status

| Step | Name | Spec Doc | Status |
|------|------|----------|--------|
| 01 | Project Setup | `01_PROJECT_SETUP.md` | ✅ Complete |
| 02 | Database Schema | `02_DATABASE_SCHEMA.md` | ✅ Complete (20+ tables, 28 migrations) |
| 03 | Auth & Sessions | `03_MOCK_AUTH.md` | ✅ Complete (DB-based bcrypt) |
| 04 | API Routes | `04_API_ROUTES.md` | ✅ Complete (76 routes) |
| 05 | Email System | `05_EMAIL_SYSTEM.md` | ✅ Complete (29+ templates, SMTP + queue, payment/payroll emails) |
| 06 | Payment Gateway | `06_PAYMENT_GATEWAY.md` | ✅ Complete (fee structures, invoices, receipts) |
| 07 | Room Lifecycle | `07_ROOM_LIFECYCLE.md` | ✅ Complete (auto-exit, warnings, join rejection) |
| 08 | Coordinator Workflow | `08_COORDINATOR_WORKFLOW.md` | ✅ Complete (monitoring, admissions, cancellations) |
| 09 | Join Flow | `09_JOIN_FLOW.md` | ✅ Complete (PreJoin lobby, camera preview) |
| 10 | Teacher Classroom | `10_TEACHER_CLASSROOM.md` | ✅ Complete (LiveKit, Go Live, controls, chat) |
| 11 | Whiteboard Overlay | `11_WHITEBOARD_OVERLAY.md` | ✅ Complete (two-device setup, MediaPipe) |
| 12 | Student View | `12_STUDENT_VIEW.md` | ✅ Complete (fullscreen, auto-hiding overlay) |
| 13 | Ghost Mode | `13_GHOST_MODE.md` | ✅ Complete (silent observe, multi-room monitor) |
| 14 | Test Dashboards | `14_TEST_DASHBOARDS.md` | ✅ Dev dashboard with role launcher |
| — | HR Module | (additional) | ✅ Full CRUD, payroll, attendance, cancellations |
| — | Academic Operator | (additional) | ✅ Batches, sessions, timetables, auto-processes |
| — | Owner Module | (additional) | ✅ Dashboard, roles, batches, users, fees, exams, payroll, system |
| — | Permission System | (additional) | ✅ RBAC with owner overrides |
| — | Batch Management | (additional) | ✅ CRUD, multi-subject, recurring schedule |
| — | Exam System | (additional) | ✅ Create, take (learner's test style), grade, publish, highlights |
| — | Payment & Fees | (additional) | ✅ Fee structures, invoices, receipts |
| — | Timetable System | (additional) | ✅ Weekly Mon–Sat, auto-send, manual send |
| — | Attendance Tracking | (additional) | ✅ Join/leave, media events, attention reports |
| — | Teacher Flutter App | (additional) | ✅ Login, dashboard, screen share |

---

## Auth System

- **Login**: PostgreSQL DB auth via `lib/auth-db.ts` — bcrypt hash comparison
- JWT sessions via `jose` (HS256, 8-hour expiry, httpOnly cookie `smartup-session`)
- **HR creates users** with generated passwords; users receive credentials by email
- Proxy route protection with role-based access control (`proxy.ts`)
- Owner role bypasses all route restrictions

**Auth APIs:**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/auth/login` | POST | Authenticate via `portal_users` (bcrypt) |
| `/api/v1/auth/logout` | POST | Clear session cookie |
| `/api/v1/auth/me` | GET | Return current user from JWT |

**Portal Roles (10):**

| Portal Role | Dashboard Route | Nav Items |
|-------------|----------------|:---------:|
| `owner` | `/owner` | 11 |
| `batch_coordinator` | `/batch-coordinator` | 3 |
| `academic_operator` | `/academic-operator` | 3 |
| `hr` | `/hr` | 10 |
| `teacher` | `/teacher` | 4 |
| `student` | `/student` | 3 |
| `parent` | `/parent` | 4 |
| `ghost` | `/ghost` | 3 |
| `teacher_screen` | (internal — tablet device) | — |
| `academic` | → `/academic-operator` (legacy alias) | — |

**Test Accounts (password `Test@1234`):**

| Email | Role | Name |
|-------|------|------|
| `smartuplearningventures@gmail.com` | owner | Admin Owner |
| `official4tishnu@gmail.com` | coordinator | Seema Verma |
| `dev.poornasree@gmail.com` | academic_operator | Dr. Mehta |
| `tech.poornasree@gmail.com` | hr | Ayesha Khan |
| `abcdqrst404@gmail.com` | teacher | Priya Sharma |
| `official.tishnu@gmail.com` | student | Rahul Nair |
| `idukki.karan404@gmail.com` | parent | Nair P. |
| `info.pydart@gmail.com` | ghost | Nour Observer |

---

## Database

**20+ tables** across 28 migrations on PostgreSQL 15:

| Table | Migration | Purpose |
|-------|-----------|---------|
| `portal_users` | 002 | User accounts: email (PK), `full_name`, `portal_role`, `password_hash`, `is_active`, `custom_permissions` JSONB |
| `user_profiles` | 004 | Extended profile: phone, subjects TEXT[], grade, board, parent_email, qualification, etc. |
| `batches` | 018 | Batch groups: name, type, grade, section, subjects, coordinator, AO, max_students, status |
| `batch_students` | 018 | Batch enrollment: student_email, parent_email, added_at |
| `batch_teachers` | 019 | Batch teacher assignments: teacher_email, subject, is_primary |
| `batch_sessions` | 021 | Scheduled sessions: subject, teacher, date, time, duration, status, livekit_room_name |
| `rooms` | 001 | Class room records (legacy — now sessions are primary) |
| `room_events` | 001 | Event log (created, started, ended, joined, left, etc.) |
| `room_assignments` | 001 | Teacher/student assignments with join_token |
| `attendance_sessions` | 006 | Attendance records: join/leave times, late detection |
| `attendance_logs` | 006 | Detailed join/leave/rejoin timeline |
| `email_log` | 001 | Email delivery tracking (12+ template types) |
| `payment_attempts` | 001 | Payment records |
| `fee_structures` | 009 | Fee configurations per grade/board |
| `invoices` | 009 | Student invoices with line items |
| `exam_papers` | 008 | Exam definitions: subject, grade, marks, date |
| `exam_marks` | 008 | Per-student exam scores |
| `payroll_periods` | 010 | Payroll period definitions |
| `payroll_payslips` | 010 | Teacher payslips with breakdown |
| `teacher_pay_configs` | 010 | Per-teacher pay rates |
| `school_config` | 001 | Key-value platform settings |
| `_migrations` | — | Migration tracking |

**Key columns:**
- `portal_users.full_name` — always use `full_name`, NOT `name`
- `portal_users.custom_permissions` — JSONB for owner overrides
- `batches.coordinator_email` + `batches.academic_operator_email` — links to people
- `batch_sessions.livekit_room_name` — set on session start, NULL before

---

## API Routes (76 total)

### Auth (3)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/auth/login` | POST | DB auth with bcrypt |
| `/api/v1/auth/logout` | POST | Clear session cookie |
| `/api/v1/auth/me` | GET | Current user from JWT |

### Owner (6)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/owner/dashboard` | GET | Full dashboard data (8 parallel queries) |
| `/api/v1/owner/overview` | GET | Room overview (legacy) |
| `/api/v1/owner/user-stats` | GET | User counts by role |
| `/api/v1/owner/roles` | GET, POST | Role management + permission overrides |
| `/api/v1/owner/users/[email]` | GET, PATCH | Per-user management |
| `/api/v1/owner/permissions/[email]` | GET, PATCH | Per-user permission toggles |

### HR (5)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/hr/users` | GET, POST | List + create users with credential emails |
| `/api/v1/hr/users/[email]` | GET, PATCH, DELETE | User detail, update, deactivate |
| `/api/v1/hr/users/[email]/reset-password` | POST | Reset password + email |
| `/api/v1/hr/stats` | GET | Role headcounts, alerts |
| `/api/v1/hr/attendance` | GET | Attendance breakdowns (summary/by_teacher/by_student) |

### Batches & Sessions (10)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/batches` | GET, POST | List + create batches |
| `/api/v1/batches/[batchId]` | GET, PATCH, DELETE | Batch detail, update, archive |
| `/api/v1/batches/people` | GET | List students/teachers for picker |
| `/api/v1/batch-sessions` | GET, POST, DELETE | List + create + bulk-cancel sessions |
| `/api/v1/batch-sessions/[sessionId]` | PATCH, DELETE | Update/cancel single session |
| `/api/v1/batch-sessions/[sessionId]/start` | POST | Start session → create LiveKit room + join tokens |
| `/api/v1/batch-sessions/auto-start` | POST | Auto-start sessions in prep window |
| `/api/v1/batch-sessions/weekly-timetable` | GET, POST | Get/send weekly timetable |
| `/api/v1/batch-sessions/daily-timetable` | POST | Send daily timetable (deduped) |
| `/api/v1/batch-sessions/session-reminder` | POST | Send session reminders (30min) |

### Room Lifecycle (7)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/room/create` | POST | Create room + LiveKit room |
| `/api/v1/room/join` | POST | Auth + issue LiveKit token |
| `/api/v1/room/reminders` | GET | Cron: 30/5-min reminders |
| `/api/v1/room/[room_id]` | DELETE | End class, destroy LiveKit room |
| `/api/v1/room/[room_id]/go-live` | POST | Transition scheduled → live |
| `/api/v1/room/[room_id]/attendance` | GET | Room attendance records |
| `/api/v1/room/[room_id]/feedback` | GET, POST | Student feedback + teacher rating |

### Coordinator (5)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/coordinator/rooms` | GET, POST | List + create rooms |
| `/api/v1/coordinator/rooms/[room_id]` | GET, PATCH, DELETE | Room CRUD |
| `/api/v1/coordinator/rooms/[room_id]/students` | GET, POST | Student management |
| `/api/v1/coordinator/rooms/[room_id]/notify` | POST | Send email invites |
| `/api/v1/coordinator/rooms/[room_id]/notify-status` | GET | Email send progress poll |

### Participant Control (3)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/room/participants/[identity]` | DELETE | Kick participant |
| `/api/v1/room/participants/[identity]/mute` | POST | Mute audio |
| `/api/v1/room/contact-violation` | POST | Contact info violation alert |

### Payment & Fees (7)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/payment/initiate` | POST | Start Razorpay payment order |
| `/api/v1/payment/callback` | POST | Payment gateway callback + receipt email |
| `/api/v1/payment/ledger` | GET | Fee ledger |
| `/api/v1/payment/invoices` | GET | Invoice list (auto-flips overdue) |
| `/api/v1/payment/generate-monthly` | POST | Auto-generate monthly invoices + email notifications |
| `/api/v1/payment/fee-structures` | GET, POST | Fee structure CRUD |
| `/api/v1/payment/receipt/[id]` | GET | Printable receipt/invoice HTML |
| `/api/v1/payment/invoice-pdf/[id]` | GET | Professional invoice PDF |
| `/api/v1/payment/send-reminder` | POST | Send payment reminder email |
| `/api/v1/payment/session-check` | POST | Session payment verification |
| `/api/v1/payment/session-rates` | GET, POST | Per-session fee rates |

### Exams (3)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/exams` | GET, POST | List + create exams |
| `/api/v1/exams/[id]` | GET, PATCH, DELETE | Exam CRUD |
| `/api/v1/exams/[id]/marks` | GET, POST | Marks entry + retrieval |

### Other (20+)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/health` | GET | DB, Redis, LiveKit connectivity |
| `/api/v1/admissions` | GET, POST | Admission requests |
| `/api/v1/cancellations` | GET, POST | Cancellation workflow |
| `/api/v1/attention` | GET | Attention monitoring |
| `/api/v1/notifications` | GET | Notification list |
| `/api/v1/payroll` | GET, POST | Payroll CRUD |
| `/api/v1/reports` | GET | Reports generation |
| `/api/v1/recording` | GET, POST | Session recording |
| `/api/v1/question-bank` | GET, POST | Question bank for exams |
| `/api/v1/academics/settings` | GET, PATCH | Academic settings (subjects list) |
| `/api/v1/users/search` | GET | Search with subject filter |
| `/api/v1/token/validate` | POST | Validate join-token JWT |
| `/api/v1/webhook/livekit` | POST | LiveKit event webhook |
| `/api/v1/email/test` | POST | Dev: test email templates |
| `/api/v1/dev/token` | POST | Dev: generate tokens |
| `/api/v1/dev/livekit-test` | GET | Dev: LiveKit connectivity |
| Role-specific | GET | `/api/v1/teacher/rooms`, `/api/v1/teacher/profile`, `/api/v1/student/rooms`, `/api/v1/student/profile`, `/api/v1/ghost/rooms`, `/api/v1/parent/*` |

---

## Email System

- **SMTP:** Gmail via `info.pydart@gmail.com` (App Password)
- **12+ templates** in `lib/email-templates.ts` (1,044 lines)
- **Queue:** BullMQ on Redis, concurrency 5, priority levels
- **Logging:** All emails tracked in `email_log` table
- **Auth error handling:** No retry on EAUTH/535 errors, transporter cache flushed

**Template Types:**

| Template | Purpose |
|----------|---------|
| `teacher_invite` | Teacher assigned to room |
| `student_invite` | Student added to room |
| `payment_confirmation` | Payment received |
| `room_reminder` | 30/5-min class reminders |
| `room_cancelled` | Class cancelled |
| `room_rescheduled` | Class rescheduled |
| `coordinator_summary` | Coordinator room summary |
| `credentials` | New user credentials (HR creates) |
| `room_started` | Class is LIVE now |
| `weekly_timetable` | Manual timetable send |
| `weekly_timetable_auto` | Auto-sent timetable on session changes |
| `daily_timetable` | Morning daily schedule |
| `session_reminder` | Join link reminder (30min before) |

---

## Classroom System (19 components, ~5,500 LOC)

| Component | Lines | Purpose |
|-----------|------:|---------|
| `StudentView.tsx` | 1,230 | YouTube-fullscreen immersive view, auto-hiding overlay, media approval |
| `TeacherView.tsx` | 964 | Google Meet-style layout, student grid, sidebar, media controls |
| `ClassroomWrapper.tsx` | 336 | LiveKit `<Room>` provider, 1080p capture, simulcast, auto-exit |
| `AttendancePanel.tsx` | 337 | Post-session attendance + teacher rating dialog |
| `ChatPanel.tsx` | 305 | Real-time chat via LiveKit data channel |
| `ControlBar.tsx` | 264 | Google Meet-style SVG control buttons |
| `GhostView.tsx` | 231 | Silent observation, private notes |
| `ScreenDeviceView.tsx` | 221 | Tablet screen share (1920×1080 @ 15fps) |
| `ParticipantList.tsx` | 219 | Participant sidebar with mute/kick controls |
| `TeacherOverlay.tsx` | 218 | MediaPipe AI background segmentation |
| `PreJoinLobby.tsx` | 218 | Camera/mic preview + device selection |
| `VideoQualitySelector.tsx` | 201 | Auto/360p/720p/1080p quality picker |
| `HeaderBar.tsx` | 192 | Live countdown, 5-min warning, expired banner |
| `LoginForm.tsx` | 190 | Auth login form |
| `FeedbackDialog.tsx` | 187 | Post-session student feedback |
| `VideoTile.tsx` | 148 | Reusable video tile with avatar fallback |
| `TimeWarningDialog.tsx` | 140 | 5-minute warning modal |
| `WhiteboardComposite.tsx` | 127 | Tablet screen + teacher camera composite |
| `LoginSlideshow.tsx` | 126 | Login page slideshow |
| `icons.tsx` | 123 | Google Meet-style SVG icons |

**Two-device teacher setup:**
1. Teacher laptop → `TeacherView` (webcam + controls + chat + student grid)
2. Teacher tablet (Flutter app) → `ScreenDeviceView` → shares screen as whiteboard
3. `WhiteboardComposite` composites tablet screen + teacher webcam overlay
4. `TeacherOverlay` uses MediaPipe to segment teacher background

**Video quality system:**
- Capture: 1080p, simulcast h360/h720/h1080 layers
- Subscribe: `setVideoQuality(LOW|MEDIUM|HIGH)` via `VideoQualitySelector`
- Screen share: 1920×1080 @ 15fps, 3 Mbps

**Chat system:**
- Teacher: sidebar panel (320px), toggled via sidebar tabs
- Student: slide-from-right panel, toggled via overlay button
- Transport: LiveKit data channel, topic `chat`

---

## Lib Files (25 files, ~5,300 LOC)

| File | Lines | Key Exports | Purpose |
|------|------:|-------------|---------|
| `email-templates.ts` | 1,044 | 12+ template functions + interfaces | HTML email templates with master layout |
| `reports.ts` | 749 | Report generation functions | AI-powered academic report generation |
| `exam.ts` | 529 | Exam CRUD, marks management | Exam system backend |
| `payment.ts` | 325 | Payment initiation, callback, ledger | Fee management backend |
| `email.ts` | 319 | `sendEmail()`, convenience senders | Nodemailer SMTP with EAUTH handling |
| `email-queue.ts` | 261 | `enqueueEmail()`, BullMQ worker | Background email queue |
| `livekit.ts` | 258 | `createLiveKitToken()`, `ensureRoom()` | LiveKit SDK, role-based grants |
| `permissions.ts` | 249 | `ROLE_DEFAULT_PERMISSIONS`, `mergePermissions()` | Client-side RBAC definitions |
| `payroll.ts` | 244 | Payroll period/payslip CRUD | Payroll engine |
| `whatsapp.ts` | 232 | WhatsApp message sending | WhatsApp integration |
| `timetable-auto.ts` | 219 | `scheduleTimetableUpdate()`, `deriveWeeklySlots()` | Debounced auto-send timetable |
| `attendance.ts` | 217 | `recordJoin()`, `recordLeave()`, late detection | Attendance tracking |
| `room-notifications.ts` | 210 | Auto-notify: create, remind, go-live | Room lifecycle emails |
| `recording.ts` | 180 | Session recording management | Recording system |
| `contact-detection.ts` | 166 | Contact info leak detection | Safety monitoring |
| `nav-config.ts` | 165 | `getNavForRole()`, `resolveActiveNav()` | Navigation structure |
| `users.ts` | 164 | `searchUsers()`, subject/coordinator search | User search with GIN index |
| `utils.ts` | 122 | `cn()`, `fmtTimeIST()`, `toISTDateValue()` | Tailwind merge, IST formatting |
| `sounds.ts` | 111 | `sfxHandRaise()`, `hapticTap()` | Web Audio API SFX |
| `db.ts` | 78 | `db.query()`, `db.withTransaction()` | PostgreSQL pool singleton |
| `auth-db.ts` | 72 | `dbLogin()` | bcrypt authentication |
| `auth-utils.ts` | 51 | `getServerUser()`, `requireRole()` | Server-side auth guards |
| `session.ts` | 36 | `signSession()`, `verifySession()` | JWT session (jose HS256) |
| `permissions-server.ts` | 33 | `getEffectivePermissions()` | DB lookup + merge permissions |
| `redis.ts` | 24 | `redis` singleton | ioredis with lazy connect |

---

## Hooks (3 files, ~331 LOC)

| Hook | Lines | Purpose |
|------|------:|---------|
| `useSession.ts` | 41 | Client auth — fetches `/api/v1/auth/me`, returns `{ user, loading, logout }` |
| `useTeacherOverlay.ts` | 276 | MediaPipe selfie segmenter — per-frame GPU-accelerated background removal |
| `useWhiteboard.ts` | 14 | Stub — placeholder for whiteboard composite logic |

---

## Proxy / Middleware (`proxy.ts`)

| Path Pattern | Behavior |
|-------------|----------|
| `/login`, `/expired`, `/api/v1/auth/login`, `/api/v1/health` | **Public** — always allowed |
| `/api/*` | **Pass-through** — each route handles its own auth |
| `/join/*`, `/classroom/*` | **Allowed** — token-based auth |
| `/dev*` | **Dev only** — blocked in production |
| All other routes | **Session required** — redirects to `/login` if invalid |

**Role → Route map:**

| Route Prefix | Allowed Roles |
|-------------|---------------|
| `/owner` | owner |
| `/batch-coordinator` | batch_coordinator, owner |
| `/academic-operator` | academic_operator, academic, owner |
| `/hr` | hr, owner |
| `/teacher` | teacher, owner |
| `/student` | student, owner |
| `/parent` | parent, owner |
| `/ghost` | ghost, owner |

---

## Types (`types/index.ts`)

| Type | Kind | Fields |
|------|------|--------|
| `PortalRole` | Union | 10 values: teacher, teacher_screen, student, batch_coordinator, academic_operator, academic, hr, parent, owner, ghost |
| `SmartUpUser` | Interface | id, name, role, batch_id?, token? |
| `SessionPayload` | Interface | extends SmartUpUser + iat, exp |
| `ClassRoom` | Interface | Room entity with all DB columns |
| `JoinTokenPayload` | Interface | sub, name, role, room_id, batch_id, class_session_id, permissions (6 booleans) |
| `ApiResponse<T>` | Generic | `{ success, data?, error?, message? }` |
| `GhostRoomSummary` | Interface | Ghost monitor card data |

---

## Migrations (29 files)

| File | What it does |
|------|-------------|
| `001_initial.sql` | Core schema: rooms, room_events, room_assignments, payment_attempts, email_log, school_config |
| `002_portal_users.sql` | portal_users + user_profiles tables |
| `003_add_academic_operator.sql` | Adds academic_operator role |
| `004_add_hr_role_and_profiles.sql` | HR role + user_profiles with subjects TEXT[] |
| `004_password_hash.sql` | password_hash column for bcrypt |
| `005_remove_frappe_columns.sql` | Drops Frappe ERP columns |
| `006_attendance.sql` | attendance_sessions + attendance_logs tables |
| `006_branches.sql` | Branch/location support |
| `007_feedback.sql` | Student feedback + teacher rating |
| `008_exam_system.sql` | exam_papers + exam_marks tables |
| `009_payment_invoices.sql` | fee_structures + invoices tables |
| `010_payroll.sql` | payroll_periods + payslips + teacher_pay_configs |
| `011_reports_notifications.sql` | Reports + notification tables |
| `012_workflow_alignment.sql` | Admissions, cancellations, session limits |
| `013_parent_complaints_and_ledger.sql` | Parent complaints + fee ledger |
| `014_plain_password.sql` | Plain password storage for credential emails |
| `015_rename_coordinator.sql` | Rename coordinator to batch_coordinator |
| `016_user_permissions.sql` | custom_permissions JSONB column |
| `017_teacher_per_hour_rate.sql` | Per-hour rate for teachers |
| `018_batches.sql` | batches + batch_students tables |
| `019_academic_settings.sql` | Academic settings table |
| `019_batch_multi_subject_teacher.sql` | Multi-subject teacher support |
| `019_batch_teachers_and_cancellations.sql` | batch_teachers table |
| `020_batch_academic_operator.sql` | AO column on batches |
| `021_batch_sessions.sql` | batch_sessions table |
| `022_batch_email_types.sql` | Email types for batch notifications |
| `023_attendance_confirmed.sql` | Attendance confirmation fields |
| `024_timetable_email_types.sql` | Timetable email template types |
| `030_attendance_media_tracking.sql` | mic/camera off counts, leave request count, attention avg on attendance_sessions |

---

## SmartUp Teacher — Flutter App

**Project:** `G:\smartup\smartup-teacher`  
**Package:** `com.smartup.screenshare`  
**Platform:** Android (min SDK 24)

### Structure (9 Dart files, ~1,637 LOC)

| File | Lines | Purpose |
|------|------:|---------|
| `main.dart` | 67 | App entry, Firebase init, routing |
| `theme.dart` | 82 | Dark theme matching portal |
| `login_screen.dart` | 216 | Email/password login |
| `dashboard_screen.dart` | 302 | Room list, join, refresh |
| `classroom_screen.dart` | 292 | LiveKit room, screen share, foreground service |
| `api.dart` | 229 | HTTP client, cookie-based auth |
| `session.dart` | 59 | SharedPreferences persistence |
| `notifications.dart` | 164 | FCM push + local notifications |
| `deep_link.dart` | 226 | App Links for join URLs |

### Native Android

| File | Lines | Purpose |
|------|------:|---------|
| `MainActivity.kt` | 37 | MethodChannel for foreground service |
| `ScreenCaptureService.kt` | 78 | MediaProjection foreground service |

---

## Server Infrastructure

| Service | Host | Port | Protocol |
|---------|------|------|----------|
| PostgreSQL | 76.13.244.60 | 5432 | TCP |
| Redis | 76.13.244.60 | 6379 | TCP (password auth) |
| LiveKit | 76.13.244.54 | 7880 | WebSocket |
| LiveKit WebRTC | 76.13.244.54 | 50000-60000 | UDP |
| Next.js (PM2) | 76.13.244.60 | 3000 | HTTP → Nginx → HTTPS |

---

## Environment Variables (17)

```env
NEXT_PUBLIC_APP_URL=https://smartuplearning.online
JWT_SECRET=<secret>
NEXT_PUBLIC_LIVEKIT_URL=ws://76.13.244.54:7880
LIVEKIT_API_KEY=APIrPJx5TK4Uccx
LIVEKIT_API_SECRET=<secret>
DATABASE_URL=postgresql://smartup:<password>@76.13.244.60:5432/smartup_portal
REDIS_URL=redis://:<password>@76.13.244.60:6379
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=info.pydart@gmail.com
SMTP_PASS=<app-password>
EMAIL_FROM_NAME=SmartUp Classes
EMAIL_FROM_ADDRESS=info.pydart@gmail.com
PORTAL_BASE_URL=https://smartuplearning.online
EMAIL_MODE=smtp
OWNER_EMAIL=smartuplearningventures@gmail.com
OWNER_PASSWORD=Test@1234
```

---

## File Inventory

### Portal (`smartup-portal/`) — 197 source files, ~42,900 LOC

```
smartup-portal/
├── .env.local                              17 environment variables
├── proxy.ts                                Route protection + role-based access
├── next.config.ts                          CORS + MediaPipe WASM headers
├── package.json                            Next.js 16.1.6 + dependencies
│
├── types/index.ts                          7 types: PortalRole, SmartUpUser, etc.
│
├── lib/                                    25 files, ~5,300 LOC
│   ├── auth-db.ts                          PostgreSQL bcrypt login (72)
│   ├── auth-utils.ts                       getServerUser(), requireRole() (51)
│   ├── db.ts                               PostgreSQL pool singleton (78)
│   ├── email.ts                            Nodemailer SMTP + EAUTH handling (319)
│   ├── email-queue.ts                      BullMQ queue + worker (261)
│   ├── email-templates.ts                  12+ HTML templates with master layout (1,044)
│   ├── livekit.ts                          LiveKit SDK, grants matrix, room CRUD (258)
│   ├── sounds.ts                           Web Audio API SFX + vibration (111)
│   ├── redis.ts                            ioredis singleton (24)
│   ├── room-notifications.ts              Auto-notify: create, remind, go-live (210)
│   ├── session.ts                          JWT sign/verify, jose HS256 (36)
│   ├── users.ts                            User search, subject/coordinator search (164)
│   ├── utils.ts                            cn(), IST formatters, ID generator (122)
│   ├── nav-config.ts                       Per-role navigation structure (165)
│   ├── permissions.ts                      RBAC definitions + merge logic (249)
│   ├── permissions-server.ts               DB lookup for effective permissions (33)
│   ├── timetable-auto.ts                   Debounced auto-send timetable (219)
│   ├── attendance.ts                       Join/leave tracking, late detection (217)
│   ├── exam.ts                             Exam CRUD, marks management (529)
│   ├── payment.ts                          Fee/invoice/receipt management (325)
│   ├── payroll.ts                          Payroll engine (244)
│   ├── reports.ts                          Report generation (749)
│   ├── recording.ts                        Session recording (180)
│   ├── contact-detection.ts                Contact info leak detection (166)
│   └── whatsapp.ts                         WhatsApp integration (232)
│
├── hooks/                                  3 files, ~331 LOC
│
├── components/
│   ├── auth/                               LoginForm (190), LoginSlideshow (126)
│   ├── dashboard/
│   │   ├── shared.tsx                      Shared component library (1,143) — 72 exports
│   │   ├── DashboardShell.tsx              Sidebar + header layout (320)
│   │   └── CreateUserForm.tsx              Multi-step user creation wizard (769)
│   ├── classroom/                          19 files, ~5,500 LOC
│   └── ui/                                 5 shadcn primitives (382 LOC)
│
├── app/
│   ├── layout.tsx + page.tsx               Root layout (dark theme) + redirect
│   ├── globals.css                         Brand theme + animations + utilities
│   ├── (auth)/login/                       Login page
│   ├── (portal)/
│   │   ├── layout.tsx + providers.tsx       Session guard + context providers
│   │   ├── owner/                          Dashboard (519) + 8 sub-modules (4,851 LOC)
│   │   ├── hr/                             Dashboard (1,609)
│   │   ├── academic-operator/              Dashboard (4,179)
│   │   ├── batch-coordinator/              Dashboard (394) + 2 sub-modules
│   │   ├── teacher/                        Dashboard (841) + exams (466)
│   │   ├── student/                        Dashboard (764) + exams (420)
│   │   ├── parent/                         Dashboard (937)
│   │   ├── ghost/                          Dashboard (195) + monitor
│   │   ├── classroom/[roomId]/             Classroom + ended page (337)
│   │   ├── join/[room_id]/                 PreJoin + JoinClient (391)
│   │   └── dev/                            Dev tools (380)
│   └── api/v1/                             76 API routes
│
├── migrations/                             28 SQL files
├── scripts/                                migrate.ts, seed-users.ts, debug-login, shell scripts
└── USERS.md                                Test accounts reference
```

---

## Git Commit History (latest 20)

```
52d5e4a HR: show parent children names, batch wizard student step reorder
660c477 Auto-create parent account when adding student in HR module
6990a0c Fix coordinator/academic_operator dropdown empty
4fa16d8 HR dashboard upgrades, batch system, subject/qualification dropdowns
9717778 Parent dashboard rebuild (6 tabs), complaints, fee ledger, PDF receipts
0069ee1 Fix: include all existing event_types in room_events constraint
d56ae1b Workflow alignment — admissions, cancellations, session limits
4650b94 Phase 1 completion: exams, payments, recording, attention, payroll
3e8a7fc Domain update: smartup.pydart.com → smartuplearning.online
c870579 Fix room_events constraint update
42e8752 Rejoin gating, student feedback, contact violation alerts
09a1d74 Attendance management system + contact detection
7608ed7 Leave request approval flow
2fb5f92 Mute all students by default in teacher room
2102453 Fix mobile fullscreen for iOS
6f31bac Update DEV_FLOW.md
f39785d Remove chat button from teacher control bar
f87ecad Fix video quality: 1080p capture, simulcast, HD screen share
39990a8 YouTube-style video quality selector
5f2615d Fix mute: remove global RoomAudioRenderer
```

---

## Known Issues

| Severity | Location | Issue |
|----------|----------|-------|
| LOW | `useWhiteboard.ts` | Stub hook — not wired into classroom |
| LOW | `email-queue.ts` | BullMQ worker never auto-started (emails sent directly) |
| LOW | `student/rooms` | Exposes `join_token` in list response |

---

## Dev Commands

```bash
# ── Portal (Next.js) ──────────────────────────────
cd G:\smartup\smartup-portal

npm run dev                    # Start dev server (Turbopack)
npx next build                 # Production build
npx tsc --noEmit               # Type check
npm run db:migrate             # Run migrations
npm run db:seed                # Seed test users
npm run db:reset               # Reset + re-migrate

# ── Deploy to production ──────────────────────────
git add -A && git commit -m "message" && git push origin master
ssh smartup-portal "cd /var/www/smartup-portal && git pull origin master && npm run build && pm2 restart smartup-portal"

# ── Access servers ────────────────────────────────
ssh smartup                    # Media server (76.13.244.54)
ssh smartup-portal             # Portal server (76.13.244.60)

# ── Database ──────────────────────────────────────
# From PowerShell (pipe SQL via stdin for quote safety):
"SELECT * FROM rooms LIMIT 5;" | ssh smartup-portal "sudo -u postgres psql -d smartup_portal"

# ── Database ownership note ───────────────────────
# Tables are owned by 'postgres', not 'smartup'.
# All DDL migrations must go through SSH:
Get-Content migrations/024_timetable_email_types.sql | ssh smartup-portal "sudo -u postgres psql -d smartup_portal"

# ── Teacher App (Flutter) ─────────────────────────
cd G:\smartup\smartup-teacher

flutter run                    # Run on connected device
flutter build apk --release    # Build release APK
```
