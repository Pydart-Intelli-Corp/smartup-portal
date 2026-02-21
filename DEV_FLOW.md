# SmartUp Portal — Development Flow & Status

---

**Project:** `D:\smartup\smartup-portal`  
**Spec Guide:** `D:\smartup\portal_dev` (build plan)  
**Server Build:** `D:\smartup\server_build` (2 servers — media + portal)  
**Last Updated:** February 21, 2026

---

## Architecture

```
┌──────────────────────┐     ┌─────────────────────┐
│   SmartUp Portal     │     │   LiveKit Media     │
│  class.smartup.live  │◄───►│  media.smartup.live │
│                      │     │                     │
│  Room CRUD & APIs    │     │  WebRTC Rooms       │
│  8 Role Dashboards   │     │  Video/Audio        │
│  LiveKit Tokens      │     │  Data Channels      │
│  Email Notifications │     │  Screen Share       │
│  Payment Gateway     │     └─────────────────────┘
│  PostgreSQL Auth     │
└──────────────────────┘
```

**Two-Server Stack:**

| Server | IP | Domain | Stack |
|--------|-----|--------|-------|
| LiveKit Media | `76.13.244.54` | `media.smartup.live` | LiveKit 1.9.11 · Nginx |
| Portal | `76.13.244.60` | `class.smartup.live` | Next.js 16.1.6 · PostgreSQL 15 · Redis 7 · PM2 |

---

## Build Status

| Step | Name | Spec Doc | Status |
|------|------|----------|--------|
| 01 | Project Setup | `01_PROJECT_SETUP.md` | ✅ Complete |
| 02 | Database Schema | `02_DATABASE_SCHEMA.md` | ✅ Complete |
| 03 | Auth & Sessions | `03_MOCK_AUTH.md` | ✅ Complete (DB-based) |
| 04 | API Routes | `04_API_ROUTES.md` | ✅ 28/35 routes built |
| 05 | Email System | `05_EMAIL_SYSTEM.md` | ✅ Complete |
| 06 | Payment Gateway | `06_PAYMENT_GATEWAY.md` | ⬜ Not started |
| 07 | Room Lifecycle | `07_ROOM_LIFECYCLE.md` | ⬜ Not started |
| 08 | Coordinator Workflow | `08_COORDINATOR_WORKFLOW.md` | 🟡 Partial (room list only) |
| 09 | Join Flow | `09_JOIN_FLOW.md` | ⬜ Stubs only |
| 10 | Teacher Classroom | `10_TEACHER_CLASSROOM.md` | ⬜ Stubs only |
| 11 | Whiteboard Overlay | `11_WHITEBOARD_OVERLAY.md` | ⬜ Stubs only |
| 12 | Student View | `12_STUDENT_VIEW.md` | ⬜ Stubs only |
| 13 | Ghost Mode | `13_GHOST_MODE.md` | 🟡 Partial |
| 14 | Test Dashboards | `14_TEST_DASHBOARDS.md` | ⬜ Not started |
| — | HR Dashboard | (additional) | ✅ Complete |

---

## What's Built

### Auth System

- **Login**: PostgreSQL DB auth via `lib/auth-db.ts` — compares bcrypt password hash in `portal_users.password_hash`
- JWT sessions via `jose` (HS256, 8-hour expiry, httpOnly cookie `smartup-session`)
- **HR creates users** with generated passwords; users receive credentials by email
- Proxy route protection with role-based access control (`proxy.ts`)
- Owner role can access all routes; `academic` is a legacy alias for `academic_operator`

**Auth APIs:**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/auth/login` | POST | Authenticate via `portal_users` (bcrypt) |
| `/api/v1/auth/logout` | POST | Clear session cookie |
| `/api/v1/auth/me` | GET | Return current user from JWT |

**Portal Roles (8 total):**

| Portal Role | Dashboard | Color |
|-------------|-----------|-------|
| `owner` | `/owner` | amber |
| `coordinator` | `/coordinator` | blue |
| `academic_operator` | `/academic-operator` | amber |
| `hr` | `/hr` | teal |
| `teacher` | `/teacher` | emerald |
| `student` | `/student` | violet |
| `parent` | `/parent` | rose |
| `ghost` | `/ghost` | gray |
| `academic` | → `/academic-operator` | — |

**Test Accounts (password `Test@1234`):**

| Email | Role | Name |
|-------|------|------|
| `abcdqrst404@gmail.com` | teacher | Priya M. |
| `official.tishnu@gmail.com` | student | Rahul K. |
| `official4tishnu@gmail.com` | coordinator | Seema R. |
| `dev.poornasree@gmail.com` | academic_operator | Dr. Mehta |
| `idukki.karan404@gmail.com` | parent | Nair P. |
| `tishnuvichuz143@gmail.com` | owner | Admin |
| `info.pydart@gmail.com` | ghost | Nour |

---

### Database

**8 tables** across 5 migrations on PostgreSQL 15:

| Table | Migration | Purpose |
|-------|-----------|---------|
| `rooms` | 001 | Class room records — status, schedule, LiveKit link |
| `room_events` | 001 | Event log (created, started, ended, joined, left, etc.) |
| `room_assignments` | 001 | Teacher/student assignments with payment status + join_token |
| `payment_attempts` | 001 | Federal Bank payment records |
| `email_log` | 001 | Email delivery tracking (7 template types) |
| `school_config` | 001 | Key-value platform settings |
| `portal_users` | 002 | User accounts with portal roles + `password_hash` |
| `user_profiles` | 002 | Extended profile data (phone, subjects, grade, board, etc.) |

Plus `_migrations` tracking table, 22+ indexes, triggers, and CHECK constraints.

**`portal_users` key columns:** `email` (PK), `full_name` (NOT `name`), `portal_role`, `password_hash`, `is_active`  
**`user_profiles` key columns:** `email` (FK), `phone`, `whatsapp`, `subjects TEXT[]`, `qualification`, `experience_years`, `grade`, `section`, `board`, `parent_email`, `admission_date`, `assigned_region`, `notes`, `date_of_birth`  
**`rooms` key columns:** `room_id`, `room_name`, `subject`, `grade`, `section`, `teacher_email`, `status`, `scheduled_start`, `duration_minutes`, `max_participants`, `notes_for_teacher`, `fee_paise`

> ⚠️ Always alias `full_name` in queries: `u.full_name AS name` — column is `full_name`, NOT `name`.

---

### API Routes

**24 routes built:**

| Route | Methods | Auth | Status |
|-------|---------|------|--------|
| `/api/v1/health` | GET | None | ✅ |
| `/api/v1/auth/login` | POST | None | ✅ |
| `/api/v1/auth/logout` | POST | None | ✅ |
| `/api/v1/auth/me` | GET | Session | ✅ |
| `/api/v1/room/join` | POST | Session | ✅ |
| `/api/v1/token/validate` | POST | JWT body | ✅ |
| `/api/v1/webhook/livekit` | POST | LiveKit sig | ✅ |
| `/api/v1/coordinator/rooms` | GET, POST | Session | ✅ |
| `/api/v1/coordinator/rooms/[room_id]` | GET, PATCH, DELETE | Session | ⬜ Empty stub |
| `/api/v1/coordinator/rooms/[room_id]/students` | GET, POST | Session | ⬜ Empty stub |
| `/api/v1/coordinator/rooms/[room_id]/notify` | POST | Session | ⬜ Empty stub |
| `/api/v1/coordinator/rooms/[roomId]/notify-status` | GET | Session | ⬜ Empty stub |
| `/api/v1/teacher/rooms` | GET | Session | ✅ |
| `/api/v1/teacher/profile` | GET | Session | ✅ |
| `/api/v1/student/rooms` | GET | Session | ✅ (with teacher JOIN) |
| `/api/v1/student/profile` | GET | Session | ✅ |
| `/api/v1/academic/rooms` | GET | Session | ✅ |
| `/api/v1/parent/rooms` | GET | Session | ✅ |
| `/api/v1/ghost/rooms` | GET | Session | ✅ |
| `/api/v1/owner/overview` | GET | Session | ✅ |
| `/api/v1/owner/user-stats` | GET | Session | ✅ |
| `/api/v1/hr/stats` | GET | Session (hr/owner) | ✅ |
| `/api/v1/hr/users` | GET, POST | Session (hr/owner) | ✅ |
| `/api/v1/hr/users/[email]` | GET, PATCH | Session | ⬜ Empty stub |
| `/api/v1/hr/users/[email]/reset-password` | POST | Session | ⬜ Empty stub |
| `/api/v1/users/search` | GET | Session | ✅ |
| `/api/v1/email/test` | POST | Dev only | ✅ |

**Routes not yet built:**

- `POST /api/v1/payment/initiate` — Federal Bank payment
- `POST /api/v1/payment/callback` — Bank webhook
- `GET /api/v1/payment/status` — Payment status check
- `GET /api/v1/room/[room_id]/status` — Public room status
- `POST /api/v1/admin/expire-rooms` — Room expiry cron
- `POST /api/v1/dev/token` — Dev mock token
- `GET /api/v1/dev/livekit-test` — LiveKit connectivity test

---

### Email System

- **SMTP:** Gmail via `online.poornasree@gmail.com` (App Password)
- **8 templates:** teacher_invite, student_invite, payment_confirmation, room_reminder, room_cancelled, room_rescheduled, coordinator_summary, **credentials** (new — HR user creation)
- **Queue:** BullMQ on Redis, concurrency 5, priority levels
- **Logging:** All emails tracked in `email_log` table with status (queued/sent/failed)
- **All templates tested** ✅

---

### 8 Role Dashboards

All dashboards use the shared `DashboardShell` component (sidebar, header, logout, role branding).

| Role | Page | Lines | Status | Features |
|------|------|-------|--------|---------|
| **Coordinator** | `/coordinator` | 390 | 🟡 Partial | Stats, room list with filter/search, room creation |
| **Teacher** | `/teacher` | 684 | ✅ Full | 3 tabs: Overview (live banner, stats, countdown, today timeline), My Classes (search/filter/expandable rows), My Profile |
| **Student** | `/student` | 738 | ✅ Full | 3 tabs: Overview (live join banner, payment alerts, stats, countdown, today timeline), My Classes (search/filter/expandable rows, payment badges), My Profile |
| **Academic Operator** | `/academic-operator` | 838 | ✅ Full | All rooms table, live/upcoming/stats, subject filter, coordinator notes |
| **HR** | `/hr` | 1111 | ✅ Full | 6 tabs: Overview (headcounts, alerts, recent), Teachers, Students, Parents, Coordinators, Academic Operators — create users with generated passwords, credentials email, search/filter, expand rows |
| **Parent** | `/parent` | 180 | 🟡 Basic | Live rooms with Observe, upcoming, completed; no effectiveStatus, no tabs |
| **Owner** | `/owner` | 214 | 🟡 Basic | User stats grid, live rooms, recent rooms |
| **Ghost** | `/ghost` | 187 | 🟡 Basic | Info banner, live rooms with Enter Ghost, Oversight Console; + `/ghost/monitor` (grid/list, 30s refresh) |

**Dashboard patterns (Teacher/Student/Academic pattern — fully implemented):**
- `effectiveStatus(room)` — client-side: returns `'ended'` if `scheduled_start + duration_minutes*60_000 <= now` when DB status is `'scheduled'`
- `Countdown` component — accepts `scheduledStart` + `durationMinutes`; shows "Starts in Xm Xs" before; "Started Xm ago" / "Ended Xm ago" after
- Lazy profile load on first Profile tab open; 60-second auto-refresh for rooms
- `res.text()` → `JSON.parse()` pattern for safe API fetch (handles empty response body)

---

### HR Dashboard — Detail

**6 tabs** with full CRUD:

| Tab | API Used | Features |
|-----|---------|---------|
| Overview | `/hr/stats` | Headcount cards per role (total/active), 3 alerts (students without parent, teachers without subjects), 10 recent signups |
| Teachers | `/hr/users?role=teacher` | List with search, expandable rows showing subjects, qualification, experience, WhatsApp; Create Teacher modal |
| Students | `/hr/users?role=student` | List with search, expandable rows showing grade/section/board, parent email, admission date; Create Student modal |
| Parents | `/hr/users?role=parent` | List, Create Parent modal |
| Coordinators | `/hr/users?role=coordinator` | List, Create Coordinator modal |
| Academic Operators | `/hr/users?role=academic_operator` | List, Create Academic Operator modal |

**User creation flow (HR):**
1. Fill form with name, email, phone, role-specific fields
2. Server generates 8-char random password (upper+lower+digit+special)
3. bcrypt hash stored in `portal_users.password_hash`
4. Profile data stored in `user_profiles`
5. Credentials email sent to new user (template: name, email, generated password, login URL)

**Stub routes still needed:**
- `GET/PATCH /api/v1/hr/users/[email]` — view/edit individual user
- `POST /api/v1/hr/users/[email]/reset-password` — reset password, resend credentials

---

### Teacher Dashboard — Detail

**3 tabs:**

- **Overview**: Live class alert banner, stats grid (Live/Today/Upcoming/Done This Week), Next Class card with live countdown timer, Today's schedule timeline
- **My Classes**: Search bar + filter tabs (All/Live/Scheduled/Ended/Cancelled) with counts, expandable rows showing date, duration, student count, coordinator notes, countdown for scheduled classes
- **My Profile**: Avatar card with subject badges, contact/professional info (phone, WhatsApp, DOB, qualification, experience, region, notes)

APIs: `GET /api/v1/teacher/rooms`, `GET /api/v1/teacher/profile`

---

### Student Dashboard — Detail

**3 tabs:**

- **Overview**: Live join banner ("Join Class" → `/join/${room_id}`), pending payment alert, stats grid (Live/Today/Upcoming/Done This Week), Next Class card with countdown, today's schedule timeline
- **My Classes**: Search bar + filter tabs (All/Live/Scheduled/Ended/Cancelled) with counts, expandable rows showing date, duration, teacher name, payment badge (Paid/Free/Pending), countdown, pending payment warning
- **My Profile**: Avatar card with grade/section/board badges, contact info (phone, WhatsApp, DOB, board, grade, section, parent email, admission date)

APIs: `GET /api/v1/student/rooms`, `GET /api/v1/student/profile`

---

### Coordinator Dashboard — Detail (Partial)

**Current state (~390 lines):**
- Room list with search and status filter
- Room creation (subject, grade, scheduled time, duration)
- Stats summary cards

**Missing (all 4 coordinator sub-routes are empty stubs):**
- Room detail / edit / cancel (`[room_id]` PATCH, DELETE)
- Load students into room (`[room_id]/students` POST)
- Send invite emails (`[room_id]/notify` POST)
- Notify status polling (`[room_id]/notify-status` GET)

---

### Join Flow (Step 09 — Stubs Only)

All files exist at 0 lines:

- `app/(portal)/join/[room_id]/page.tsx` — empty stub
- `app/(portal)/join/[room_id]/JoinRoomClient.tsx` — empty stub

**Needs:** DB room lookup, session auth, status checks, PreJoinLobby with camera preview, device selection, render role-appropriate classroom view.

---

### Classroom Components (Steps 10-12 — Stubs Only)

All 11 files exist at 6 lines (placeholder JSX only):

| Component | File |
|-----------|------|
| `ClassroomWrapper` | `components/classroom/ClassroomWrapper.tsx` |
| `TeacherView` | `components/classroom/TeacherView.tsx` |
| `StudentView` | `components/classroom/StudentView.tsx` |
| `GhostView` | `components/classroom/GhostView.tsx` |
| `WhiteboardComposite` | `components/classroom/WhiteboardComposite.tsx` |
| `TeacherOverlay` | `components/classroom/TeacherOverlay.tsx` |
| `ControlBar` | `components/classroom/ControlBar.tsx` |
| `ChatPanel` | `components/classroom/ChatPanel.tsx` |
| `ParticipantList` | `components/classroom/ParticipantList.tsx` |
| `PreJoinLobby` | `components/classroom/PreJoinLobby.tsx` |
| `VideoTile` | `components/classroom/VideoTile.tsx` |

Stub hooks: `useTeacherOverlay` (MediaPipe background removal), `useWhiteboard` (whiteboard composite)

Classroom page: `app/(portal)/classroom/[roomId]/page.tsx` — 0 lines

---

## Missing Pages

| Page | Spec | Purpose |
|------|------|---------|
| `/expired` | Step 07 | "This class has ended" |
| `/cancelled` | Step 07 | "This class was cancelled" |
| `/too-early` | Step 07 | Countdown timer before open_at |
| `/payment-failed` | Step 06 | Retry payment / contact coordinator |
| `/ghost/room/[roomId]` | Step 13 | Focused ghost room observation |

---

## File Inventory

```
smartup-portal/
├── .env.local                              Environment (10+ vars)
├── proxy.ts                                Route protection + role-based access (8 roles)
├── next.config.ts                          CORS headers
├── package.json                            Next.js 16.1.6 + bcryptjs + bullmq + jose + livekit
│
├── types/
│   └── index.ts                            PortalRole (8 roles), SmartUpUser, ClassRoom, JoinTokenPayload, ApiResponse, GhostRoomSummary
│
├── lib/
│   ├── auth-db.ts                          PostgreSQL bcrypt login — dbLogin()
│   ├── auth-utils.ts                       getServerUser(), requireRole()
│   ├── db.ts                               PostgreSQL pool — query(), getClient(), withTransaction()
│   ├── email.ts                            Nodemailer SMTP — sendEmail() + 8 convenience senders
│   ├── email-queue.ts                      BullMQ — enqueueEmail(), enqueueBatch(), startEmailWorker()
│   ├── email-templates.ts                  8 HTML email templates + master layout (incl. credentials)
│   ├── livekit.ts                          LiveKit SDK — token generation, room service, grants matrix
│   ├── redis.ts                            ioredis singleton
│   ├── session.ts                          JWT sign/verify (jose, HS256, 8h)
│   ├── users.ts                            portal_users CRUD — upsert, search
│   └── utils.ts                            cn(), formatTime(), generateRoomId(), isGhostRole()
│
├── hooks/
│   ├── useSession.ts                       Client auth hook (user, loading, logout)
│   ├── useTeacherOverlay.ts                Stub — MediaPipe background removal
│   └── useWhiteboard.ts                    Stub — whiteboard composite logic
│
├── components/
│   ├── auth/LoginForm.tsx                  Login form — email/password, dev panel
│   ├── dashboard/DashboardShell.tsx        Shared layout — sidebar, header, role colors (190 lines)
│   ├── classroom/                          11 stub components (6 lines each)
│   └── ui/                                 5 shadcn primitives (button, dialog, tabs, input, badge)
│
├── app/
│   ├── layout.tsx + page.tsx               Root layout (dark theme) + redirect to /login
│   ├── globals.css                         Tailwind v4 + shadcn CSS vars
│   ├── (auth)/login/page.tsx               Login page
│   ├── (portal)/
│   │   ├── layout.tsx                      Session guard wrapper
│   │   ├── coordinator/                    page.tsx + CoordinatorDashboardClient.tsx (390 lines)
│   │   ├── teacher/                        page.tsx + TeacherDashboardClient.tsx (684 lines) ✅ Full
│   │   ├── student/                        page.tsx + StudentDashboardClient.tsx (738 lines) ✅ Full
│   │   ├── academic-operator/              page.tsx + AcademicOperatorDashboardClient.tsx (838 lines) ✅ Full
│   │   ├── hr/                             page.tsx + HRDashboardClient.tsx (1111 lines) ✅ Full
│   │   ├── parent/                         page.tsx + ParentDashboardClient.tsx (180 lines) 🟡 Basic
│   │   ├── owner/                          page.tsx + OwnerDashboardClient.tsx (214 lines) 🟡 Basic
│   │   ├── ghost/                          page.tsx + GhostDashboardClient.tsx (187 lines) + /monitor
│   │   ├── classroom/[roomId]/             page.tsx + /ended page.tsx (both 0 lines)
│   │   ├── join/[room_id]/                 page.tsx + JoinRoomClient.tsx (both 0 lines)
│   │   └── dev/                            page.tsx (17 lines, stub)
│   └── api/v1/                             24+ API routes (see table above)
│
├── migrations/
│   ├── 001_initial.sql                     6 tables + indexes + seed data
│   ├── 002_portal_users.sql                portal_users + user_profiles tables
│   ├── 003_add_academic_operator.sql       academic_operator role support
│   ├── 004_password_hash.sql               password_hash column + bcrypt auth
│   ├── 004_add_hr_role_and_profiles.sql    HR role + user_profiles table
│   └── 005_remove_frappe_columns.sql       Drop all Frappe columns/tables
│
├── scripts/
│   ├── migrate.ts                          Migration runner
│   ├── seed-users.ts                       Portal users seeder
│   ├── setup-livekit-service.sh            LiveKit systemd setup
│   └── setup-redis-remote.sh              Redis remote access setup
│
└── USERS.md                                Test accounts & credentials
```

---

## Environment Variables

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=<generated>

# LiveKit
NEXT_PUBLIC_LIVEKIT_URL=ws://76.13.244.54:7880
LIVEKIT_API_KEY=APIrPJx5TK4Uccx
LIVEKIT_API_SECRET=<secret>

# Database
DATABASE_URL=postgresql://smartup:<password>@76.13.244.60:5432/smartup_portal

# Redis
REDIS_URL=redis://:<password>@76.13.244.60:6379

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=online.poornasree@gmail.com
SMTP_PASS=<app-password>
EMAIL_FROM_NAME=SmartUp Classes
EMAIL_FROM_ADDRESS=online.poornasree@gmail.com
EMAIL_MODE=smtp
```

---

## Server Infrastructure

| Service | Host | Port | Protocol |
|---------|------|------|----------|
| PostgreSQL | 76.13.244.60 | 5432 | TCP |
| Redis | 76.13.244.60 | 6379 | TCP (password auth) |
| LiveKit | 76.13.244.54 | 7880 | WebSocket |
| LiveKit WebRTC | 76.13.244.54 | 50000-60000 | UDP |
| Next.js | localhost | 3000 | HTTP |

---

## Known Issues

| Severity | Location | Issue |
|----------|----------|-------|
| HIGH | `coordinator/rooms/[room_id]` etc. | 4 coordinator sub-routes are 0-byte empty files — return nothing |
| HIGH | `join/[room_id]` | Join flow page is 0 bytes — users cannot join a class at all |
| HIGH | `notify-status` route | 0-byte stub — no auth check |
| HIGH | `token/validate` | Cookie set via `cookies()` may not work in route handlers |
| MEDIUM | `coordinator PATCH/DELETE` | No room ownership check |
| MEDIUM | `room/join` | Missing `open_at`/`expires_at` time window checks |
| MEDIUM | `lib/livekit.ts` | `hidden` in VideoGrant is not a real LiveKit field |
| MEDIUM | `lib/email.ts` | 30s blocking retry, TLS validation disabled in prod |
| MEDIUM | Parent dashboard | No `effectiveStatus()` — shows stale "Scheduled" for ended classes |
| MEDIUM | Owner/Ghost dashboards | No `effectiveStatus()` — shows stale "Scheduled" for ended classes |
| LOW | `student/rooms` | Still exposes `join_token` in list response |
| LOW | `email-queue.ts` | Worker never auto-started |
| LOW | `hr/users/[email]` + `reset-password` | 0-byte stubs — HR cannot edit users or reset passwords |

---

## What's Next — Build Order

1. **Coordinator sub-routes** (room detail/edit/cancel, load students, send invites, notify-status)
2. **Join Flow** (`/join/[room_id]` — lobby, camera preview, device selection, role-appropriate classroom entry)
3. **Parent/Owner/Ghost dashboards** (apply effectiveStatus + tabs pattern matching Teacher/Student)
4. **Step 06 — Payment Gateway** (Federal Bank integration, 3 routes)
5. **Step 07 — Room Lifecycle** (expiry worker, time window validation, 5 status pages)
6. **Step 10 — Teacher Classroom** (LiveKit TeacherView, ControlBar, ChatPanel, ParticipantList)
7. **Step 11 — Whiteboard Overlay** (screen share composite, MediaPipe background removal)
8. **Step 12 — Student View** (StudentView, hand raise, self-view PiP)
9. **Step 13 — Ghost Mode** (focused room view `/ghost/room/[id]`)
10. **Step 14 — Dev Tools** (`/dev` dashboard, mock token API, LiveKit test)
11. **HR stub routes** (`hr/users/[email]` edit + reset-password)
12. **Bug fixes** (notify-status auth, token/validate cookie, ownership checks)

---

## Dev Commands

```bash
# Start dev server
npm run dev          # runs: next dev

# Type check (no errors as of Feb 21 2026)
npx tsc --noEmit

# Run migrations
npm run db:migrate   # runs: npx tsx scripts/migrate.ts

# Seed test users
npm run db:seed

# Reset + re-migrate DB
npm run db:reset

# Access servers
ssh smartup          # Media server (76.13.244.54)
ssh smartup-portal   # Portal server (76.13.244.60)
