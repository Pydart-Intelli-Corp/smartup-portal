-- Migration 031: Add payment/payroll email template types
-- Adds: invoice_generated, payment_receipt, payslip_notification, payment_reminder

ALTER TABLE email_log DROP CONSTRAINT IF EXISTS email_log_template_type_check;
ALTER TABLE email_log ADD CONSTRAINT email_log_template_type_check
  CHECK (template_type IN (
    'teacher_invite', 'student_invite', 'room_reminder', 'room_cancelled',
    'room_rescheduled', 'payment_confirmation', 'coordinator_summary',
    'batch_coordinator_notify', 'batch_teacher_notify', 'batch_student_notify',
    'batch_parent_notify', 'daily_timetable', 'session_reminder',
    'weekly_timetable', 'weekly_timetable_auto',
    'session_request_submitted', 'session_request_approved', 'session_request_rejected',
    'session_rescheduled_notify', 'session_cancelled_notify',
    'availability_submitted',
    'leave_request_submitted', 'leave_request_approved', 'leave_request_rejected',
    'leave_sessions_affected',
    -- Payment & payroll email types (031)
    'invoice_generated', 'payment_receipt', 'payslip_notification', 'payment_reminder'
  ));
