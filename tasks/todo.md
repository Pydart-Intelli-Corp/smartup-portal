# SmartUp Portal — Task Tracker

## Phase: Comprehensive Endpoint Testing & Bug Fix Sweep (Feb 28, 2026)

### Full Endpoint Testing — All 8 Roles
- [x] Owner: 28/28 GET endpoints PASS (monitoring/events = POST-only, expected 405)
- [x] Teacher: 6/6 PASS
- [x] Student: 6/6 PASS (3 previously failing fixed)
- [x] Parent: 5/5 PASS
- [x] Coordinator: 2/2 PASS (student-performance previously failing, fixed)
- [x] Academic Operator: 4/4 PASS
- [x] HR: 5/5 PASS (students/performance previously failing, fixed)
- [x] Ghost: 1/1 PASS

### Column Name Bug Sweep
- [x] Fix student/sessions: is_late→late_join, time_in_class_seconds→total_duration_sec, student_email→participant_email
- [x] Fix student/attendance: is_late→late_join, late_by_seconds→late_by_sec, time_in_class_seconds→total_duration_sec
- [x] Fix student/batches: b.id→b.batch_id, b.name→b.batch_name, b.type→b.batch_type, is_late→late_join
- [x] Fix lib/reports.ts: is_late→late_join, time_in_class_seconds→total_duration_sec (2 locations)
- [x] Fix parent/attendance: is_late→late_join, late_by_seconds→late_by_sec, time_in_class_seconds→total_duration_sec
- [x] Fix hr/students/performance: b.id→b.batch_id, participant_type→participant_role, total_questions removed
- [x] Fix coordinator/student-performance: b.id→b.batch_id, b.name→b.batch_name, u.name→u.full_name, exams.batch_id removed, bs.is_active removed
- [x] Fix batches/[batchId]: participant_type→participant_role in attendance_sessions
- [x] Fix monitoring-reports.ts: b.name→b.batch_name, b.id→b.batch_id, student_email→participant_email, session_date→created_at, left_at/joined_at→total_duration_sec

### Real Workflow Tests
- [x] Admission creation (POST /api/v1/admissions action=create): 201 ✅
- [x] Batch creation (POST /api/v1/batches): 201 ✅
- [x] Session scheduling (POST /api/v1/batch-sessions): 201 ✅
- [x] Exam creation (POST /api/v1/exams): 400 expected without questions array ✅

### UI Page Load Verification
- [x] All 31 page routes load: 200 OK
- [x] Owner sub-pages (12): all PASS
- [x] Role dashboards (8): all PASS
- [x] Coordinator sub-pages (3): all PASS

### Deployment
- [x] 5 commits deployed to production
- [x] All fixes verified on live server
- [x] tasks/lessons.md updated with new patterns

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
