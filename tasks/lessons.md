# SmartUp Portal — Lessons Learned

## Migration Drift

**Pattern:** Migrations exist as files but aren't applied to production, causing 500 errors.

**Rule:** After creating any migration file, ALWAYS:
1. Apply it to production immediately via SSH
2. Verify the `_migrations` table has the new entry
3. Test the affected API endpoints

**Root cause:** Some migrations were created during development sessions but only selectively applied. Over time, 9+ migrations accumulated as unapplied, causing 10 API endpoints to fail with missing-table/column errors.

---

## Column Name Mismatches

**Pattern:** DB migration uses one column name (e.g., `total_pay_paise`, `loss_of_pay_paise`, `period_start`), but application code uses a different name (e.g., `total_paise`, `lop_paise`, `start_date`).

**Rule:** When writing new SQL queries, ALWAYS check the actual DB column names by reading the migration file that created them. Never assume column names from memory.

**Fix strategy:** If the code consistently uses one name across 10+ files and the DB uses another, rename the DB column to match the code (cheaper than changing many files). Use `ALTER TABLE ... RENAME COLUMN`.

---

## Ambiguous Column References in JOINs

**Pattern:** When JOINing tables that share column names (e.g., `status` exists on both `attendance_sessions` and `rooms`), PostgreSQL throws "column reference is ambiguous".

**Rule:** ALWAYS prefix column names with table alias in any JOIN query. Even if it works now, future schema changes could introduce conflicts.

---

## display_name vs full_name

**Pattern:** The `portal_users` table uses `full_name`, not `display_name`. Code written from memory used the wrong column name.

**Rule:** When referencing portal_users columns, the correct names are: `email`, `full_name`, `portal_role`, `phone`, `is_active`, `password_hash`, `branch_id`, `custom_permissions`.

---

## PowerShell Cookie Handling

**Pattern:** `Invoke-RestMethod -SessionVariable` doesn't properly pass cookies in subsequent calls. 

**Rule:** Use `Invoke-WebRequest -WebSession $ws -UseBasicParsing` instead. Create the session variable with `-WebSession $ws` on the login call, then reuse `$ws` on subsequent calls.

---

## Test After Every Deploy

**Rule:** After any production deploy, run the full endpoint test suite (29 endpoints) to catch regressions immediately. Don't assume green locally means green in production.
