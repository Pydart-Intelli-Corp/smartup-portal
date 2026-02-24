# SmartUp Portal — Development Flow & Status

---

**Portal Project:** `G:\smartup\smartup-portal`  
**Teacher App:** `G:\smartup\smartup-teacher`  
**Spec Guide:** `G:\smartup\portal_dev` (build plan)  
**Server Build:** `G:\smartup\server_build` (2 servers — media + portal)  
**Last Updated:** February 24, 2026  
**Latest Commit:** `f39785d` — Remove chat button from teacher control bar, add chat slide panel to student overlay

---

## Architecture

```
┌──────────────────────────────┐     ┌─────────────────────────┐
│     SmartUp Portal           │     │   LiveKit Media Server  │
│  smartuplearning.online          │◄───►│   76.13.244.54:7880     │
│                              │     │                         │
│  Next.js 16.1.6 (Turbopack)  │     │  WebRTC Rooms           │
│  107 source files             │     │  Video / Audio          │
│  ~14,000 LOC                 │     │  Data Channels (Chat)   │
│  35 API Routes               │     │  Screen Share            │
│  8 Role Dashboards           │     └─────────────────────────┘
│  15 Classroom Components     │
│  LiveKit Token Generation    │     ┌─────────────────────────┐
│  Email Notifications (9 tpl) │     │  SmartUp Teacher App    │
│  PostgreSQL Auth (bcrypt)    │     │  Flutter / Android       │
│  Redis + BullMQ Queue        │     │  com.smartup.screenshare │
└──────────────────────────────┘     │                         │
                                     │  9 Dart files, ~1,637 LOC│
                                     │  LiveKit screen share    │
                                     │  FCM push notifications  │
                                     │  Deep link from emails   │
                                     │  Foreground service      │
                                     └─────────────────────────┘
```

**Two-Server Stack:**

| Server | IP | Domain | Stack |
|--------|-----|--------|-------|
| LiveKit Media | `76.13.244.54` | `media.smartuplearning.online` | LiveKit 1.9.11 · Nginx |
| Portal | `76.13.244.60` | `smartuplearning.online` | Next.js 16.1.6 · PostgreSQL 15 · Redis 7 · PM2 |

---

## Build Status

| Step | Name | Spec Doc | Status |
|------|------|----------|--------|
| 01 | Project Setup | `01_PROJECT_SETUP.md` | ✅ Complete |
| 02 | Database Schema | `02_DATABASE_SCHEMA.md` | ✅ Complete (8 tables, 6 migrations) |
| 03 | Auth & Sessions | `03_MOCK_AUTH.md` | ✅ Complete (DB-based bcrypt) |
| 04 | API Routes | `04_API_ROUTES.md` | ✅ 34/35 routes fully implemented |
| 05 | Email System | `05_EMAIL_SYSTEM.md` | ✅ Complete (9 templates, SMTP + queue) |
| 06 | Payment Gateway | `06_PAYMENT_GATEWAY.md` | ⬜ Not started |
| 07 | Room Lifecycle | `07_ROOM_LIFECYCLE.md` | ✅ Complete (auto-exit, 5-min warning, join rejection, cron reminders) |
| 08 | Coordinator Workflow | `08_COORDINATOR_WORKFLOW.md` | ✅ Complete (room CRUD, student add, notify, status poll) |
| 09 | Join Flow | `09_JOIN_FLOW.md` | ✅ Complete (PreJoin lobby, camera preview, device select) |
| 10 | Teacher Classroom | `10_TEACHER_CLASSROOM.md` | ✅ Complete (LiveKit, Go Live, control bar, chat, participants) |
| 11 | Whiteboard Overlay | `11_WHITEBOARD_OVERLAY.md` | ✅ Complete (two-device setup, MediaPipe bg removal, draggable overlay) |
| 12 | Student View | `12_STUDENT_VIEW.md` | ✅ Complete (teacher main stage, controls, chat, hand raise, mobile rotate) |
| 13 | Ghost Mode | `13_GHOST_MODE.md` | ✅ Complete (silent observe, private notes, multi-room monitor grid) |
| 14 | Test Dashboards | `14_TEST_DASHBOARDS.md` | ✅ Dev dashboard with role launcher, health panel, LiveKit test |
| — | HR Dashboard | (additional) | ✅ Complete (full user CRUD, password reset, credential emails) |
| — | Academic Operator | (additional) | ✅ Complete (room creation, teacher/coordinator/student assignment) |
| — | Teacher Flutter App | (additional) | ✅ Complete (login, dashboard, classroom, FCM, deep link) |

---

## What's Built

### Auth System

- **Login**: PostgreSQL DB auth via `lib/auth-db.ts` — compares bcrypt password hash in `portal_users.password_hash`
- JWT sessions via `jose` (HS256, 8-hour expiry, httpOnly cookie `smartup-session`)
- **HR creates users** with generated passwords; users receive credentials by email
- Proxy route protection with role-based access control (`proxy.ts`, 116 lines)
- Owner role can access all routes; `academic` is a legacy alias for `academic_operator`

**Auth APIs:**

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/auth/login` | POST | Authenticate via `portal_users` (bcrypt) |
| `/api/v1/auth/logout` | POST | Clear session cookie |
| `/api/v1/auth/me` | GET | Return current user from JWT |

**Portal Roles (8 active + 2 internal):**

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
| `teacher_screen` | (internal — tablet device) | — |
| `academic` | → `/academic-operator` (legacy alias) | — |

**Test Accounts (password `Test@1234`):**

| Email | Role | Name |
|-------|------|------|
| `tishnuvichuz143@gmail.com` | owner | Admin Owner |
| `official4tishnu@gmail.com` | coordinator | Seema Verma |
| `dev.poornasree@gmail.com` | academic_operator | Dr. Mehta |
| `tech.poornasree@gmail.com` | hr | Ayesha Khan |
| `abcdqrst404@gmail.com` | teacher | Priya Sharma |
| `official.tishnu@gmail.com` | student | Rahul Nair |
| `idukki.karan404@gmail.com` | parent | Nair P. |
| `info.pydart@gmail.com` | ghost | Nour Observer |

---

### Database

**8 tables** across 6 migrations on PostgreSQL 15:

| Table | Migration | Purpose |
|-------|-----------|---------|
| `rooms` | 001 | Class room records — status, schedule, LiveKit link |
| `room_events` | 001 | Event log (created, started, ended, joined, left, etc.) |
| `room_assignments` | 001 | Teacher/student assignments with payment status + join_token |
| `payment_attempts` | 001 | Federal Bank payment records |
| `email_log` | 001 | Email delivery tracking (9 template types) |
| `school_config` | 001 | Key-value platform settings |
| `portal_users` | 002 | User accounts with portal roles + `password_hash` |
| `user_profiles` | 004 | Extended profile data (phone, subjects, grade, board, etc.) |

Plus `_migrations` tracking table, 22+ indexes, triggers, and CHECK constraints.

**`portal_users` key columns:** `email` (PK), `full_name` (NOT `name`), `portal_role`, `password_hash`, `is_active`  
**`user_profiles` key columns:** `email` (FK), `phone`, `whatsapp`, `subjects TEXT[]`, `qualification`, `experience_years`, `grade`, `section`, `board`, `parent_email`, `admission_date`, `assigned_region`, `notes`, `date_of_birth`  
**`rooms` key columns:** `room_id`, `room_name`, `subject`, `grade`, `section`, `coordinator_email`, `teacher_email`, `status`, `scheduled_start`, `duration_minutes`, `max_participants`, `notes_for_teacher`, `fee_paise`, `open_at`, `expires_at`, `reminder_sent_at`  
**`room_assignments` key columns:** `room_id`, `participant_type`, `participant_email`, `participant_name`, `join_token`, `payment_status` (CHECK: paid/unpaid/exempt/scholarship/unknown), `notification_sent_at`, `joined_at`, `left_at`

> ⚠️ Always alias `full_name` in queries: `u.full_name AS name` — column is `full_name`, NOT `name`.

**Migrations:**

| File | Lines | What it does |
|------|------:|-------------|
| `001_initial.sql` | 278 | Core schema: rooms, room_events, room_assignments, payment_attempts, email_log, school_config |
| `002_portal_users.sql` | 51 | portal_users + user_profiles tables |
| `003_add_academic_operator.sql` | 37 | Adds academic_operator role to constraint; remaps academic |
| `004_add_hr_role_and_profiles.sql` | 78 | HR role + user_profiles with subjects TEXT[], GIN index |
| `004_password_hash.sql` | 28 | password_hash column for bcrypt auth |
| `005_remove_frappe_columns.sql` | 61 | Drops all Frappe ERP integration columns |

---

### API Routes (35 total — 34 complete, 1 partial)

| Route | Methods | Lines | Status |
|-------|---------|------:|--------|
| `/api/v1/health` | GET | 55 | ✅ Tests DB, Redis, LiveKit |
| `/api/v1/auth/login` | POST | 78 | ✅ DB auth with bcrypt |
| `/api/v1/auth/logout` | POST | 19 | ✅ Clear session cookie |
| `/api/v1/auth/me` | GET | 33 | ✅ Current user from JWT |
| `/api/v1/room/create` | POST | 126 | ✅ Create room + LiveKit room |
| `/api/v1/room/join` | POST | 274 | ✅ Session or email-token auth, issues LiveKit token |
| `/api/v1/room/reminders` | GET | 90 | ✅ Cron: 30-min + 5-min reminders |
| `/api/v1/room/[room_id]` | DELETE | 87 | ✅ End class, delete LiveKit room |
| `/api/v1/room/[room_id]/go-live` | POST | 114 | ✅ scheduled→live, sends go-live emails |
| `/api/v1/room/participants/[identity]` | DELETE | 61 | ✅ Teacher kicks participant |
| `/api/v1/room/participants/[identity]/mute` | POST | 70 | ✅ Teacher mutes audio |
| `/api/v1/token/validate` | POST | 104 | ✅ Validate join-token JWT |
| `/api/v1/webhook/livekit` | POST | 128 | ✅ Room started/finished, join/leave events |
| `/api/v1/coordinator/rooms` | GET, POST | 272 | ✅ List + create rooms (mandatory teacher, students, coordinator) |
| `/api/v1/coordinator/rooms/[room_id]` | GET, PATCH, DELETE | 181 | ✅ Room detail, update, cancel |
| `/api/v1/coordinator/rooms/[room_id]/students` | GET, POST | 126 | ✅ List + add students |
| `/api/v1/coordinator/rooms/[room_id]/notify` | POST | 150 | ✅ Generate tokens + send email invites |
| `/api/v1/coordinator/rooms/[room_id]/notify-status` | GET | 34 | ✅ Poll email send progress |
| `/api/v1/hr/users` | GET, POST | 243 | ✅ List + create users with credential emails |
| `/api/v1/hr/users/[email]` | GET, PATCH, DELETE | 123 | ✅ User detail, update, deactivate |
| `/api/v1/hr/users/[email]/reset-password` | POST | 74 | ✅ Reset password + email credentials |
| `/api/v1/hr/stats` | GET | 71 | ✅ Role headcounts, orphan students |
| `/api/v1/users/search` | GET | 85 | ✅ Search with subject filter + coordinator batch count |
| `/api/v1/teacher/rooms` | GET | 31 | ✅ Teacher's assigned rooms |
| `/api/v1/teacher/profile` | GET | 39 | ✅ Teacher's own profile |
| `/api/v1/student/rooms` | GET | 40 | ✅ Student's rooms with payment status |
| `/api/v1/student/profile` | GET | 40 | ✅ Student's own profile |
| `/api/v1/ghost/rooms` | GET | 30 | ✅ All live/scheduled rooms |
| `/api/v1/academic/rooms` | GET | 29 | ✅ All rooms (read-only) |
| `/api/v1/parent/rooms` | GET | 32 | 🟡 Shows all rooms (TODO: parent→child filter) |
| `/api/v1/owner/overview` | GET | 35 | ✅ All rooms for owner |
| `/api/v1/owner/user-stats` | GET | 27 | ✅ User counts by role |
| `/api/v1/email/test` | POST | 166 | ✅ Dev: test all email templates |
| `/api/v1/dev/token` | POST | 158 | ✅ Dev: generate session + LiveKit token |
| `/api/v1/dev/livekit-test` | GET | 44 | ✅ Dev: LiveKit connectivity test |

---

### Email System

- **SMTP:** Gmail via `online.poornasree@gmail.com` (App Password)
- **9 templates:** teacher_invite, student_invite, payment_confirmation, room_reminder, room_cancelled, room_rescheduled, coordinator_summary, credentials, **room_started** (class is LIVE)
- **Queue:** BullMQ on Redis, concurrency 5, priority levels
- **Logging:** All emails tracked in `email_log` table with status (queued/sent/failed)
- **Auto-notifications (`lib/room-notifications.ts`):**
  - On room creation → teacher invite + student invites
  - 30 minutes before class → reminder to all participants
  - 5 minutes before class → urgent reminder to all participants
  - On go-live → "Class is LIVE now" email to students
- **Cron endpoint:** `GET /api/v1/room/reminders?key=<JWT_SECRET>` — called every minute by server cron

---

### 8 Role Dashboards

All dashboards use the shared `DashboardShell` component (sidebar, header, logout, role branding, 191 lines).

| Role | Page File | Lines | Status | Features |
|------|-----------|------:|--------|----------|
| **Academic Operator** | `AcademicOperatorDashboardClient.tsx` | 932 | ✅ Full | Room creation (mandatory teacher with subject filter, coordinator with batch count, student add/remove, auto-suggest room name, 12h AM/PM time picker), room list with detail/edit, filter/search, stats |
| **HR** | `HRDashboardClient.tsx` | 1,036 | ✅ Full | 6 tabs: Overview (headcounts, alerts), Teachers, Students, Parents, Coordinators, Academic Operators — create users, edit, deactivate, reset password, credentials email |
| **Student** | `StudentDashboardClient.tsx` | 672 | ✅ Full | 3 tabs: Overview (live join, payment alerts, stats, countdown, timeline), My Classes (filter/search/expandable), My Profile |
| **Teacher** | `TeacherDashboardClient.tsx` | 624 | ✅ Full | 3 tabs: Overview (live banner, stats, countdown, timeline), My Classes (filter/search/expandable), My Profile |
| **Join Flow** | `JoinRoomClient.tsx` | 356 | ✅ Full | PreJoin lobby with camera/mic preview, device selection, routes to classroom |
| **Coordinator** | `CoordinatorDashboardClient.tsx` | 357 | ✅ Full | Room list, room creation, stats, sending notifications |
| **Owner** | `OwnerDashboardClient.tsx` | 201 | ✅ Full | User stats grid, live rooms, room overview |
| **Ghost** | `GhostDashboardClient.tsx` | 174 | ✅ Full | Live rooms with Enter Ghost, upcoming rooms |
| **Ghost Monitor** | `GhostMonitorClient.tsx` | 187 | ✅ Full | Multi-room grid/list view, 30s auto-refresh |
| **Parent** | `ParentDashboardClient.tsx` | 168 | 🟡 Basic | Live + upcoming + completed rooms, Observe button |
| **Dev** | `dev/page.tsx` | 381 | ✅ Full | Role launcher, health panel, LiveKit test |

**Dashboard patterns:**
- `effectiveStatus(room)` — client-side: returns `'ended'` if `scheduled_start + duration_minutes*60_000 <= now` when DB status is `'scheduled'`
- `Countdown` component — accepts `scheduledStart` + `durationMinutes`; shows "Starts in Xm Xs" before; "Started Xm ago" / "Ended Xm ago" after
- 60-second auto-refresh for rooms
- `res.text()` → `JSON.parse()` pattern for safe API fetch

---

### Classroom System (15 components, ~3,968 LOC)

| Component | Lines | Purpose |
|-----------|------:|---------|
> **Recent major changes (Feb 22–24):**
> - YouTube-fullscreen StudentView with auto-hiding overlay UI
> - Media approval flow: student requests mic/cam, teacher approves/denies
> - Video quality selector (Auto/360p/720p/1080p) on both views
> - 1080p camera capture + simulcast (h360/h720/h1080 layers)
> - HD screen share (1920×1080 @ 15fps, 3 Mbps) for crisp whiteboard
> - Student chat panel (slide from right), teacher chat in sidebar only
> - Local-only mute (teacher side), no global RoomAudioRenderer

| `ClassroomWrapper.tsx` | 296 | LiveKit `<Room>` provider (1080p capture, simulcast h360+h720, HD screen share encoding), session/role routing, auto-exit at class end (3s delay), safety-net timer |
| `TeacherView.tsx` | 646 | Google Meet-style teacher layout — student grid, whiteboard strip, self-cam PIP, sidebar (chat/participants), Go Live banner, media request approve/deny panel, hand-raise queue, local mute per student, video quality selector |
| `StudentView.tsx` | 824 | YouTube-fullscreen immersive view — teacher main stage, auto-hiding overlay controls, media approval flow (request → teacher approve/deny), hand raise, sliding chat panel, video quality selector, mobile CSS rotation, teacher popup enlargement |
| `GhostView.tsx` | 216 | Silent observation — no media, teacher screen + student grid, private notes textarea |
| `ScreenDeviceView.tsx` | 204 | Teacher's second device (tablet) — "Share Screen" button, captures at 1920×1080 @ 15fps, publishes with 3 Mbps bitrate for crisp whiteboard |
| `HeaderBar.tsx` | 173 | Live countdown timer (clamps at 00:00), 5-min warning banner (yellow, dismissible), expired banner (red pulsing), `onTimeExpired` callback |
| `ControlBar.tsx` | 243 | Google Meet-style SVG buttons — mic, camera, screen share, whiteboard, end call. Teacher: no chat button (sidebar only). Student: unused (StudentView has own overlay controls) |
| `ChatPanel.tsx` | 234 | Real-time chat via LiveKit data channel (topic `chat`), role-colored bubbles, auto-scroll, close button |
| `ParticipantList.tsx` | 201 | Participant sidebar — role badges, Mute/Unmute text button per student (local mute), teacher kick controls |
| `PreJoinLobby.tsx` | 197 | Camera/mic permission + preview, audio/video device selectors, role badge, join button |
| `TeacherOverlay.tsx` | 192 | AI-segmented teacher cutout (MediaPipe) → canvas overlay, draggable 4-corner positioning |
| `WhiteboardComposite.tsx` | 113 | Tablet screen share as whiteboard + teacher camera overlay composite (two-device setup) |
| `VideoTile.tsx` | 136 | Reusable video tile — live video with `<VideoTrack>`, optional `<AudioTrack>` via `playAudio` prop, initials avatar, speaking glow, hand-raised badge |
| `VideoQualitySelector.tsx` | 182 | YouTube-style quality picker — Auto/360p/720p/1080p, uses `setVideoQuality()` to select simulcast layer (LOW/MEDIUM/HIGH), overlay + panel variants |
| `icons.tsx` | 111 | Google Meet-style SVG vector icons — 8 icons for control bar |

**Two-device teacher setup:**
1. Teacher logs in on laptop → `TeacherView` with webcam + student grid + controls
2. Teacher uses tablet app (Flutter) → opens as `teacher_screen` via email deep link → `ScreenDeviceView` → shares screen
3. `WhiteboardComposite` composites tablet screen share + teacher webcam overlay
4. `TeacherOverlay` uses MediaPipe to segment teacher background → transparent cutout on canvas

**Video quality system:**
- **Publish side:** Camera capture at 1080p (`VideoPresets.h1080.resolution`). Simulcast enabled with 3 layers: h360 (LOW), h720 (MEDIUM), h1080/original (HIGH). Screen share at 1920×1080 @ 15fps, 3 Mbps max bitrate.
- **Subscribe side:** `VideoQualitySelector` component with Auto/360p/720p/1080p options. Calls `RemoteTrackPublication.setVideoQuality(VideoQuality.LOW|MEDIUM|HIGH)` to select simulcast layer directly — not overridden by adaptive stream.
- **Room config:** `adaptiveStream: true`, `dynacast: true`, VP8 codec, screen share simulcast disabled (single HD layer).

**Media control system:**
- **Student → Teacher approval flow:** Student taps mic/cam button → sends `media_request` via data channel → Teacher sees request panel → Approve sends `media_control` back → Student device toggles. Deny just dismisses.
- **Teacher local mute:** `mutedStudents` Set controls `playAudio` prop on `<VideoTile>`. No `<RoomAudioRenderer />` — audio only via VideoTile's AudioTrack. Students unmuted by default.
- **No student-to-student communication:** Students can only hear the teacher (via explicit `<AudioTrack>` in StudentView). No global audio renderer.

**Chat system:**
- **Teacher:** Chat in sidebar (right panel, 320px), toggled via sidebar tab buttons (Chat / Participants). No chat button in bottom control bar.
- **Student:** Chat panel slides from right edge (320px), toggled by chat button in overlay controls. Overlay stays visible while chat is open.
- **Data channel:** Topic `chat`, role-colored bubbles, auto-scroll.

**Student mobile behavior:**
- Portrait phone + screen share active → CSS-rotates entire view 90° to landscape
- Orientation lock via Screen Orientation API (Android browsers)
- Virtual keyboard detection → adjusts viewport width
- **Laptop/PC users**: rotation disabled — only triggers on actual mobile/tablet devices (touch + mobile UA check)

**Room lifecycle:**
- Timer counts down to 00:00 (no negative/overtime display)
- 5-min warning: yellow dismissible banner
- At 00:00: red "disconnecting..." banner → 3s delay → auto-disconnect + redirect to `/ended?reason=expired`
- Safety net: `setTimeout` based on scheduled end time
- Join API rejects rooms past scheduled end (410)
- `/ended` page shows ⏰ "Class Time Ended" for expired, ✅ "Class Ended" for normal

---

### Hooks (3 files, ~331 LOC)

| Hook | Lines | Purpose |
|------|------:|---------|
| `useSession.ts` | 41 | Client auth — fetches `/api/v1/auth/me`, returns `{ user, loading, logout }` |
| `useTeacherOverlay.ts` | 276 | MediaPipe selfie segmenter — loads WASM model, per-frame processing → canvas output, GPU-accelerated |
| `useWhiteboard.ts` | 14 | **Stub** — placeholder for whiteboard composite logic |

---

### Lib Files (13 files, ~1,816 LOC)

| File | Lines | Key Exports | Purpose |
|------|------:|-------------|---------|
| `auth-db.ts` | 73 | `dbLogin()` | PostgreSQL bcrypt authentication |
| `auth-utils.ts` | 52 | `getServerUser()`, `requireRole()` | Server-side user getter, role guard with redirect |
| `db.ts` | 79 | `db.query()`, `db.withTransaction()` | PostgreSQL connection pool singleton (max 10, 10s statement timeout) |
| `email.ts` | 277 | `sendEmail()`, 7 convenience senders, log helpers | Nodemailer SMTP with dev log mode, 30s retry, email_log tracking |
| `email-queue.ts` | 262 | `enqueueEmail()`, `enqueueBatch()`, `getNotifyStatus()`, `startEmailWorker()` | BullMQ background queue, priority system, worker with concurrency 5 |
| `email-templates.ts` | 484 | 9 template functions + type interfaces | HTML email templates with master layout, shared helpers |
| `livekit.ts` | 259 | `createLiveKitToken()`, `ensureRoom()`, `deleteRoom()`, `GRANTS` | LiveKit SDK — role-based grant matrix (11 roles), room CRUD, webhook receiver |
| `sounds.ts` | 96 | `sfxHandRaise()`, `sfxParticipantJoin()`, `sfxMediaControl()`, `hapticTap()`, etc. | Web Audio API sound effects + vibration haptics for classroom events |
| `redis.ts` | 25 | `redis` | ioredis singleton with lazy connect |
| `room-notifications.ts` | 211 | `sendCreationNotifications()`, `sendReminderNotifications()`, `sendGoLiveNotifications()` | Auto-emails on create, 30/5-min reminders, go-live |
| `session.ts` | 37 | `signSession()`, `verifySession()`, `COOKIE_NAME` | JWT session — jose HS256, 8h expiry |
| `users.ts` | 165 | `searchUsers()`, `searchTeachersBySubject()`, `searchCoordinatorsWithBatchCount()` | User CRUD, subject-filtered teacher search with GIN index, coordinator batch count |
| `utils.ts` | 123 | `cn()`, `fmtTimeIST()`, `fmtDateLongIST()`, `toISTDateValue()`, `istToUTCISO()`, etc. | Tailwind merge, IST date/time formatting, room ID generator |

> **Lib total:** 13 files, ~1,816 LOC

---

### UI Components (5 shadcn primitives)

| File | Lines | Purpose |
|------|------:|---------|
| `button.tsx` | 59 | Button with 6 variants (default, destructive, outline, ghost, secondary, link) |
| `dialog.tsx` | 145 | Dialog/modal (Radix-based) |
| `tabs.tsx` | 83 | Tabs component (Radix-based) |
| `badge.tsx` | 43 | Badge with variants |
| `input.tsx` | 18 | Styled input |

---

## SmartUp Teacher — Flutter App

**Project:** `G:\smartup\smartup-teacher`  
**Package:** `com.smartup.screenshare`  
**Platform:** Android (min SDK 24 / Android 7.0)  
**Dart SDK:** `^3.9.2`  
**Total:** 9 Dart files, ~1,637 LOC + 2 native Kotlin files

### Purpose

Dedicated **tablet screen-sharing device** for teachers. The teacher uses their laptop for the web portal (webcam, controls, chat) and uses this Android app on a tablet to share their screen as the whiteboard. The app connects via LiveKit and broadcasts the tablet screen to all students in the classroom.

### Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `livekit_client` | ^2.6.3 | LiveKit WebRTC screen sharing |
| `http` | ^1.6.0 | HTTP API client |
| `shared_preferences` | ^2.5.4 | Session persistence |
| `firebase_core` | ^4.4.0 | Firebase initialization |
| `firebase_messaging` | ^16.1.1 | FCM push notifications |
| `flutter_local_notifications` | ^20.1.0 | Local class reminders |
| `app_links` | ^6.4.1 | Deep link handling (email join links) |
| `intl` | ^0.20.2 | Date formatting |

### Screens (3)

| Screen | Lines | Purpose |
|--------|------:|---------|
| `LoginScreen` | 216 | Email/password login — validates teacher/owner role |
| `DashboardScreen` | 302 | Lists scheduled/live/ended rooms, join button, logout |
| `ClassroomScreen` | 292 | LiveKit connection, auto screen share (1080p/30fps), Go Live trigger, foreground service |

### Services (4)

| Service | Lines | Purpose |
|---------|------:|---------|
| `api.dart` | 229 | HTTP client to portal — login, getTeacherRooms, joinRoom, goLive. Cookie-based auth (`smartup-session`) |
| `session.dart` | 59 | SharedPreferences persistence — token, userId, userName, userRole, fcmToken |
| `notifications.dart` | 164 | FCM push + local notifications, class reminder scheduling (10-min + at-start) |
| `deep_link.dart` | 226 | App Links handler for `https://smartuplearning.online/join/*`. Auto-joins if logged in, prompts login if not |

### Native Android (Kotlin)

| File | Lines | Purpose |
|------|------:|---------|
| `MainActivity.kt` | 37 | Flutter activity + MethodChannel for foreground service start/stop |
| `ScreenCaptureService.kt` | 78 | Android foreground service with MediaProjection type — required for screen capture on Android 10+ |

### Permissions

| Permission | Purpose |
|-----------|---------|
| `INTERNET` | Network |
| `ACCESS_NETWORK_STATE` | Connectivity |
| `FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_MEDIA_PROJECTION` | Screen capture service |
| `WAKE_LOCK` | Keep screen on |
| `POST_NOTIFICATIONS` | Push notifications |
| `SCHEDULE_EXACT_ALARM` | Class reminders |

### Deep Link Flow

1. Teacher receives email invite with link: `https://smartuplearning.online/join/ROOM_ID?token=TOKEN&device=tablet`
2. Android App Link (`autoVerify=true`) opens the SmartUp Teacher app
3. If logged in → auto-joins LiveKit room → starts screen share
4. If not logged in → shows login screen → resumes join after auth

---

## Proxy / Middleware (`proxy.ts`, 116 lines)

| Path Pattern | Behavior |
|-------------|----------|
| `/login`, `/expired`, `/api/v1/auth/login`, `/api/v1/health` | **Public** — always allowed |
| `/api/*` | **Pass-through** — each route validates auth itself |
| `/join/*` | **Allowed** — token-based auth, sets `x-join-route` header |
| `/classroom/*` | **Allowed** — auth via sessionStorage token |
| `/dev*` | **Dev only** — blocked in production |
| All other routes | **Session required** — checks `smartup-session` cookie, redirects to `/login` if missing/invalid |

**Role-based route map:**

| Route | Allowed Roles |
|-------|---------------|
| `/coordinator` | coordinator, owner |
| `/teacher` | teacher, owner |
| `/student` | student, owner |
| `/parent` | parent, owner |
| `/ghost` | ghost, owner |
| `/hr` | hr, owner |
| `/academic-operator` | academic_operator, academic, owner |
| `/owner` | owner |

---

## Types (`types/index.ts`, 97 lines)

| Type | Kind | Purpose |
|------|------|---------|
| `PortalRole` | Union | 11 values: teacher, teacher_screen, student, coordinator, academic_operator, academic, hr, parent, owner, ghost |
| `SmartUpUser` | Interface | Session: id, name, role, batch_id?, token? |
| `SessionPayload` | Interface | JWT payload: extends SmartUpUser + iat, exp |
| `ClassRoom` | Interface | Room entity: all DB columns |
| `JoinTokenPayload` | Interface | Join URL JWT: sub, name, role, room_id, 6 permission booleans |
| `ApiResponse<T>` | Generic | Standard `{ success, data?, error?, message? }` |
| `GhostRoomSummary` | Interface | Ghost monitor card data |

---

## Environment Variables (17)

```env
# App
NEXT_PUBLIC_APP_URL=https://smartuplearning.online
JWT_SECRET=<secret>

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
PORTAL_BASE_URL=https://smartuplearning.online
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
| Next.js (PM2) | 76.13.244.60 | 3000 | HTTP → Nginx → HTTPS |

---

## File Inventory

### Portal (`smartup-portal/`) — 107 source files, ~14,000 LOC

```
smartup-portal/
├── .env.local                              17 environment variables
├── proxy.ts                                Route protection + role-based access (116 lines)
├── next.config.ts                          CORS headers + MediaPipe WASM headers (31 lines)
├── package.json                            Next.js 16.1.6 + 17 deps + 11 devDeps
│
├── types/
│   └── index.ts                            7 types: PortalRole, SmartUpUser, ClassRoom, etc. (97 lines)
│
├── lib/                                    13 files, ~1,816 lines
│   ├── auth-db.ts                          PostgreSQL bcrypt login (73)
│   ├── auth-utils.ts                       getServerUser(), requireRole() (52)
│   ├── db.ts                               PostgreSQL pool singleton (79)
│   ├── email.ts                            Nodemailer SMTP + 7 senders + log (277)
│   ├── email-queue.ts                      BullMQ queue + worker (262)
│   ├── email-templates.ts                  9 HTML templates with master layout (484)
│   ├── livekit.ts                          LiveKit SDK, grants matrix, room CRUD (259)
│   ├── sounds.ts                           Web Audio API SFX + vibration haptics (96)
│   ├── redis.ts                            ioredis singleton (25)
│   ├── room-notifications.ts              Auto-notify: create, remind, go-live (211)
│   ├── session.ts                          JWT sign/verify, jose HS256 (37)
│   ├── users.ts                            User CRUD, subject search, batch count (165)
│   └── utils.ts                            cn(), IST formatters, ID generator (123)
│
├── hooks/                                  3 files, ~331 lines
│   ├── useSession.ts                       Client auth hook (41)
│   ├── useTeacherOverlay.ts                MediaPipe background removal (276)
│   └── useWhiteboard.ts                    Stub — placeholder (14)
│
├── components/
│   ├── auth/LoginForm.tsx                  Login form (153)
│   ├── dashboard/DashboardShell.tsx        Shared layout (191)
│   ├── classroom/                          15 files, ~3,968 lines (see Classroom section)
│   └── ui/                                 5 shadcn primitives (348 lines total)
│
├── app/
│   ├── layout.tsx + page.tsx               Root layout (dark) + redirect to /login
│   ├── globals.css                         Tailwind v4 + shadcn CSS vars
│   ├── (auth)/login/page.tsx               Login page (26)
│   ├── (portal)/
│   │   ├── layout.tsx                      Session guard wrapper (33)
│   │   ├── coordinator/                    page.tsx (22) + CoordinatorDashboardClient.tsx (357)
│   │   ├── teacher/                        page.tsx (19) + TeacherDashboardClient.tsx (624)
│   │   ├── student/                        page.tsx (19) + StudentDashboardClient.tsx (672)
│   │   ├── academic-operator/              page.tsx (22) + AcademicOperatorDashboardClient.tsx (932)
│   │   ├── hr/                             page.tsx (16) + HRDashboardClient.tsx (1,036)
│   │   ├── parent/                         page.tsx (19) + ParentDashboardClient.tsx (168)
│   │   ├── owner/                          page.tsx (19) + OwnerDashboardClient.tsx (201)
│   │   ├── ghost/                          page.tsx (19) + GhostDashboardClient.tsx (174) + /monitor (187)
│   │   ├── classroom/[roomId]/             page.tsx (29) + /ended page.tsx (82)
│   │   ├── join/[room_id]/                 page.tsx (140) + JoinRoomClient.tsx (356)
│   │   └── dev/                            page.tsx (381)
│   └── api/v1/                             35 API routes (see Routes table)
│
├── migrations/                             6 SQL files, ~533 lines
├── scripts/                                6 files: migrate.ts, seed-users.ts, debug-login.ts, nginx config, shell scripts
└── USERS.md                                Test accounts reference (124 lines)
```

### Teacher App (`smartup-teacher/`) — 9 Dart files, ~1,637 LOC

```
smartup-teacher/
├── pubspec.yaml                            Flutter app, 8 runtime deps
├── lib/
│   ├── main.dart                           App entry, Firebase init, routing (67)
│   ├── theme.dart                          Dark theme matching portal (82)
│   ├── screens/
│   │   ├── login_screen.dart               Email/password login (216)
│   │   ├── dashboard_screen.dart           Room list, join, refresh (302)
│   │   └── classroom_screen.dart           LiveKit room, screen share, foreground service (292)
│   └── services/
│       ├── api.dart                         HTTP client, 5 endpoints, data models (229)
│       ├── session.dart                    SharedPreferences persistence (59)
│       ├── notifications.dart              FCM + local notifications (164)
│       └── deep_link.dart                  App Links handler for join URLs (226)
├── android/
│   ├── app/src/main/
│   │   ├── AndroidManifest.xml             7 permissions, deep link, foreground service
│   │   └── kotlin/.../
│   │       ├── MainActivity.kt             MethodChannel for foreground service (37)
│   │       └── ScreenCaptureService.kt     MediaProjection foreground service (78)
│   └── app/build.gradle.kts               compileSdk=flutter, minSdk=24, Google Services
└── test/                                   Default widget test
```

---

## Git Commit History (latest 15)

```
f39785d Remove chat button from teacher control bar, add chat slide panel to student overlay
f87ecad Fix video quality: 1080p capture, simulcast layers, HD screen share, setVideoQuality
39990a8 Add YouTube-style video quality selector (360p/480p/1080p/Auto) to student and teacher views
5f2615d Fix mute: remove global RoomAudioRenderer, cleanup student UI
1ea94f3 Media approval flow: student requests mic/cam toggle, teacher approves/denies
4a52a63 Simplify media control: local-only mute, student devices always on, no remote control
76d2042 Teacher media control: student mic/cam always-on, request flow, mute-all, per-student controls
7002005 Student split layout: WB left + cameras right, teacher popup, hand-raise SFX
94cc8c8 Hand-raise feature: teacher receives queue with dismiss, badge on student tiles
f3fe0f6 Add visible fullscreen button to student view control bar
5cf1c8f Student view: YouTube-style fullscreen with auto-hiding overlay UI
1f4d80c Redesign classroom: Google Meet-style student & teacher views, unified dark theme, auto-orient, cross-platform
e4b1387 Disable video rotation on laptop/PC — only rotate on mobile devices
f2dbc2a Auto notifications: creation emails, 30/5-min reminders, go-live alerts
0cf4413 Time picker: 12-hour format with AM/PM dropdowns
```

---

## Known Issues

| Severity | Location | Issue |
|----------|----------|-------|
| MEDIUM | `parent/rooms` API | No parent→child filter — shows all rooms |
| MEDIUM | Parent dashboard | No `effectiveStatus()` — stale "Scheduled" for ended classes |
| LOW | `useWhiteboard.ts` | Stub hook — not wired into classroom yet |
| LOW | `email-queue.ts` | BullMQ worker never auto-started (emails sent directly, not queued) |
| LOW | Cron reminders | Server cron job for `/api/v1/room/reminders` needs to be set up via crontab |
| LOW | `student/rooms` | Exposes `join_token` in list response |

---

## What's Next — Priority Order

1. **Set up cron job** on portal server for `/api/v1/room/reminders` (every minute)
2. **Parent dashboard upgrade** — apply effectiveStatus + parent→child filter
3. **Owner dashboard upgrade** — apply effectiveStatus + tabs pattern
4. **Step 06 — Payment Gateway** (Federal Bank integration, 3 routes)
5. **Teacher app improvements** — FCM token registration to portal, notification targeting
6. **Bug fixes** — parent rooms filter, join_token exposure, queue worker auto-start

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

# ── Teacher App (Flutter) ─────────────────────────
cd G:\smartup\smartup-teacher

flutter run                    # Run on connected device
flutter build apk --release    # Build release APK
```
