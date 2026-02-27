# SmartUp Portal — Task Tracker

## Phase: Session Management, Leave, LiveKit & Ghost Monitoring

### Session Requests & Student Availability
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
