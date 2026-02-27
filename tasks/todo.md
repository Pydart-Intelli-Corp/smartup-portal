# SmartUp Portal — Task Tracker

## Phase: Terminology Migration — "Class" → "Session" (Feb 28, 2026)

### Rename all user-facing "class" text to "session"
- [x] Student dashboard (StudentDashboardClient.tsx): 19 string changes — tabs, headings, badges, placeholders, empty states, attendance labels
- [x] Teacher dashboard (TeacherDashboardClient.tsx): 16 string changes — workflow rules, stat labels, payroll table headers
- [x] Classroom components (9 files): 27 string changes — TimeWarningDialog, TeacherView, StudentView, ControlBar, HeaderBar, ClassroomWrapper, ChatPanel, FeedbackDialog, ParticipantList
- [x] Join flow (2 files): 13 string changes — JoinRoomClient.tsx, join page.tsx
- [x] Owner dashboard (OwnerDashboardClient.tsx): 10 string changes — tab labels, live counts, section headers
- [x] Owner sub-pages (4 files): 17 string changes — SystemClient, OwnerTeachersClient, BatchesClient, PayrollClient
- [x] Parent/Ghost/HR/Coordinator dashboards (6 files): 24 string changes
- [x] Academic Operator dashboard: 29 string changes — schedule wizard, session management, timetable labels
- [x] Misc files (3 files): 9 string changes — layout.tsx meta, CreateUserForm role descriptions, ended page
- [x] TypeScript build: 0 errors
- [x] Production deploy: commit `e8a0d5f`, build success, PM2 online
- **Total: 28 files changed, ~120 user-facing string replacements, 174 lines modified**
- **Preserved: Grade labels ("Class 10"), CSS className, JS class keyword, DB field names, variable/function names**

---

## Phase: Complete Real-Life Workflow Re-Test (Feb 28, 2026 — Session 2)

### GET Endpoint Testing — All 8 Roles (Fresh Re-Run)
- [x] Owner: 33 PASS / 1 expected RBAC 403 (coordinator/student-performance)
- [x] Teacher: 6/6 PASS
- [x] Student: 6/6 PASS
- [x] Parent: 5/5 PASS
- [x] Coordinator: 4/4 PASS + 1 expected RBAC 401 (batches requires owner/AO)
- [x] Academic Operator: 8/8 PASS
- [x] HR: 7/7 PASS
- [x] Ghost: 1/1 PASS
- **Total: 70 GET endpoints tested, 70 PASS, 0 unexpected failures**

### Full Real-Life POST Workflow Tests
- [x] **Admission Pipeline**: create → registered → fee_confirmed → allocated → active (all 5 stages, auto user+profile creation)
- [x] **Batch Workflow**: create batch (201) → PATCH add students+teachers (200) → verify details
- [x] **Session Scheduling**: create session (201) → PATCH topic (200) → start (live) → end (ended) → create 2nd → DELETE cancel (200)
- [x] **Exam Lifecycle**: create exam with 5 MCQs (200) → publish (200) → student start attempt (200) → submit answers (100%, A+) → teacher grades (96%, A+)
- [x] **Payment/Fee**: create fee structure (200) → generate monthly invoices (200) → create manual invoice (200) → initiate payment order (200) → verify GET invoices
- [x] **Teacher Leave**: teacher submit (200) → AO approve (ao level) → HR approve (overall approved) → teacher withdraw (200)
- [x] **Session Requests**: student cancellation request (200) → coordinator approve (200)
- [x] **Room Creation**: create room with batch association (201) → coordinator_email auto-resolved from batch
- [x] **Cancellation Flow**: request cancel (201) → coordinator approve (200)
- [x] **HR User Creation**: create teacher account with auto-generated password + email (201)

### Bugs Found & Fixed This Session
- [x] **room_events FK violation**: `room_id='system'` didn't exist in rooms table → Created 'system' room row + migration 033
- [x] **room/create missing coordinator_email**: INSERT didn't include coordinator_email (NOT NULL) → Added auto-resolution from batch/caller
- [x] **Type assertion**: `coordinator_email` needed `as string` cast for TypeScript strict mode

### UI Page Load Verification (All 30 Pages)
- [x] Login: 200 ✅
- [x] Owner (13 pages): owner, batches, exams, fees, payroll, reports, roles, teachers, users, system, hr, academic-operator — all PASS
- [x] Coordinator (3 pages): dashboard, admissions, cancellations — all PASS
- [x] Academic Operator: 200 ✅
- [x] HR: 200 ✅
- [x] Teacher (2 pages): dashboard, exams — all PASS
- [x] Student (2 pages): dashboard, exams — all PASS
- [x] Parent: 200 ✅
- [x] Ghost (2 pages): dashboard, monitor — all PASS
- [x] Dev: 200 ✅
- [x] Dynamic pages (4): join/[room_id], classroom/[roomId], classroom/[roomId]/ended, student/exams/[id] — all PASS
- **Total: 30 pages, 30 PASS, 0 FAIL**

### Deployment
- [x] Commit b751278: room/create coordinator_email fix + migration 033
- [x] Commit c4e9d6b: TypeScript type assertion fix
- [x] Both deployed to production, build successful

---

## Phase: Full System Audit & Schema Alignment (Feb 27, 2026)

### System Health Audit
- [x] Read and map workflow.json institutional spec (337 lines, 12 sections + extras)
- [x] Complete project audit (100 API routes, 146 handlers, 31 pages, 50 tables)
- [x] Production health check (DB/Redis/LiveKit all ok)
- [x] Test 29 API endpoints on production — 19 PASS, 10 FAIL (500 errors)
- [x] Diagnose all 10 failures to root causes

### Migration 032: Catch-Up Schema
- [x] Create 9 missing tables (admission_requests, rejoin_requests, session_config, class_monitoring_events, monitoring_alerts, monitoring_reports, session_requests, student_availability, teacher_leave_requests)
- [x] Add 6 missing columns to rooms (batch_type, class_portion, class_remarks, created_by, batch_id, batch_session_id)
- [x] Add 4 columns to attendance_sessions (mic_off_count, camera_off_count, leave_request_count, attention_avg)
- [x] Rename payslips columns: loss_of_pay_paise→lop_paise, total_pay_paise→total_paise
- [x] Update constraints: room_events, email_log, generated_reports, attendance_logs
- [x] Record 11 unapplied migrations as applied

### Code Bug Fixes
- [x] HR attendance: ambiguous `status` column in JOINed queries → prefix with `a.`
- [x] Owner dashboard: `display_name` → `full_name` on portal_users (2 queries)
- [x] Payroll: `pp.start_date` → `pp.period_start`, `pp.end_date` → `pp.period_end` (4 locations)

### Deployment & Verification
- [x] Apply migration 032 to production via SSH
- [x] Deploy code fixes (2 commits, 0 TS errors)
- [x] Retest all 29 endpoints — **29 PASS / 0 FAIL** ✅

### Gap Analysis Report
- [x] Compare workflow.json spec vs actual implementation
- [x] Generate detailed gap analysis at portal_dev/GAP_ANALYSIS.md
- [x] Results: 27 fully implemented, 10 partial, 4 missing

---

## Remaining Gaps (Priority Order)

### ❌ Missing Features
- [ ] Website integration: Public enquiry form → admission pipeline
- [ ] Role-based theming: Per-role accent colors (all roles currently share green theme)

### ⚠️ Partial Features
- [ ] AI-generated reports: Current reports are algorithmic, not LLM-powered narrative
- [ ] Offline marks entry UI: API supports it, no dedicated teacher form
- [ ] Parent fees tab: API exists, parent dashboard nav missing fees link
- [ ] Student preferred timing UI: session-requests + availability APIs exist, no student form
- [ ] Mobile responsive audit: Desktop-first design, needs responsive testing
- [ ] Automated batch allocation: Manual allocation only in admission workflow
- [ ] "Batch" terminology: UI uses "Batch" but DB/API still uses "room" internally

---

## Previous Phases

### Phase: Session Management, Leave, LiveKit & Ghost Monitoring
- [x] Migration 029: session_requests, student_availability, teacher_leave_requests tables + rooms.batch_id/batch_session_id
- [x] API: /api/v1/session-requests — GET/POST with approve/reject/withdraw
- [x] API: /api/v1/student-availability — GET/POST with bulk_replace
- [x] API: /api/v1/teacher-leave — GET/POST with multi-level approval
- [x] 9 email templates (session + leave notifications)

### Dashboard Updates
- [x] Student: Requests tab (session requests + availability submission)
- [x] Parent: Requests tab (request/withdraw session changes)
- [x] Academic Operator: Requests tab (approve/reject sessions + teacher leave)
- [x] Teacher: Leave tab (request leave, view approval chain)
- [x] HR: Leave Requests tab (filter + approve/reject)
- [x] Owner: Leave overview section with owner-level approval

### LiveKit & Room System Updates
- [x] Auto-start: Bridge batch_sessions → rooms table (batch_id/batch_session_id)
- [x] Room create: Accept optional batch_id/batch_session_id
- [x] Ghost API: Return batch info, batch/teacher grouped views

### Ghost Dashboard Overhaul
- [x] Ghost dashboard: 3 view modes (All / By Batch / By Teacher)
- [x] Ghost monitor: Batch grouping, teacher filtering, combined monitoring
- [x] Combined monitor shortcut for all live sessions

### Nav Config & Verification
- [x] Nav config: Student→Requests, Parent→Requests, Teacher→Leave, AO→Requests, HR→Leave Requests, Ghost→By Batch/Teacher
- [x] TypeScript: 0 errors

---

## Phase: LiveKit Critical Fixes (Feb 28, 2026 — Session 2)

### Token Identity & Metadata
- [x] `/start` route: All token identities changed from raw email to `{role}_{email}` format
- [x] `/start` route: All tokens now include metadata (portal_user_id, portal_role, effective_role, room_name, device)
- [x] Fixes teacher showing "student" badge in People tab

### Attendance Webhook Fix
- [x] Added `extractEmail()` helper to parse real email from `{role}_{email}` identity
- [x] `recordJoin()` and `recordLeave()` now receive plain email via `extractEmail()`
- [x] Uses `metadata.portal_user_id` as primary email source with prefix-stripping fallback

### Payment Gate Fix
- [x] `session-check/route.ts`: Resolves `batch_session_id` → actual `room_id` before fee lookup
- [x] `join/route.ts`: Uses `actualRoomId` for `room_assignments` lookup, `calculateSessionFee()`, `checkSessionPayment()`, and rejoin detection

### Join Flow Fix
- [x] `join/[room_id]/page.tsx`: Passes resolved `room.room_id` to `JoinRoomClient` instead of raw URL param

### UI Fixes
- [x] Teacher dashboard: Classroom opens in new tab (`window.open`)
- [x] Hand-raise icon: Updated to Lucide-style SVG + filled `HandRaisedIcon` for active state
- [x] Ended page: Feedback submission persisted in sessionStorage to prevent duplicate prompts on refresh
- [x] Batch ID format: Changed to `smartup_{date}_{time}_{shortId}`

### Tablet Fixes
- [x] IST timing: Manual formatting instead of `DateFormat.format()` which used device timezone
- [x] Grade/section display: Added `grade`, `section` fields to `SessionData` model
- [x] Emojis → Material Icons: All emoji strings replaced with `Icon()` widgets
- [x] "Class" → "Session": 7 string replacements in dashboard labels and buttons
- [x] Null safety: Fixed `teacherToken` null assertion warning

### Verified Working
- [x] Student join gate: `CLASS_NOT_LIVE` returns 403, polling every 5s for 5min
- [x] AI features: MediaPipe attention monitoring, data channel broadcast, monitoring ingestion
- [x] Variable naming: Consistent across DB (snake_case), TypeScript, Flutter (camelCase)
- [x] Room ID/Session ID: Dual-lookup queries working in all critical routes
