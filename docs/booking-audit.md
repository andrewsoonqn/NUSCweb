# Booking audit history

NUSCweb keeps an indefinite history of booking updates and deletions in `booking_audits`. The history is prospective only: deploying the migration does not create records for existing bookings, and changes made before deployment are not reconstructed. Booking creation is deliberately not audited.

## Recorded evidence

A PostgreSQL trigger records every booking update and deletion, including direct SQL and foreign-key cascades caused by membership, user, organisation, or venue deletion. Update records preserve both the before and after booking snapshots; delete records preserve the before snapshot. Each record also includes its timestamp, booking ID, stable source, actor snapshot when supplied, and the PostgreSQL `SESSION_USER`.

Existing booking and event actions, plus membership, user, and organisation actions that can cascade to bookings, set transaction-local attribution before mutating data. The actor ID, name, and Telegram username are snapshots and remain unchanged if the user is later renamed or deleted. Writes without this application context have a null actor and source `database`.

Names and Telegram usernames are personal data intentionally retained for accountability. Access at `/admin/audit` is limited to authenticated site administrators, uses validated enumerated filters and bounded keyset pagination, and has no public API.

## Retention and operations

Audit records have no expiry, pruning job, or foreign key back to mutable application rows. Backups must include `booking_audits` and its sequence. A restore must restore the audit table together with the application data and preserve sequence state.

Before deployment, take and verify a database backup. Apply the migration through the direct migration connection using the database owner or dedicated migration role; do not use a transaction-pooling runtime URL. The migration removes all audit-table privileges inherited from `PUBLIC` or granted directly to named roles, including grants created by hosted-database default privileges. If the application connects as a dedicated non-owner role, explicitly grant that role only `SELECT` on `public.booking_audits` after migration. Do not grant it `INSERT`, `UPDATE`, `DELETE`, or `TRUNCATE`. Then verify the trigger and guard functions, confirm the application runtime role can mutate bookings through normal actions, and confirm site administrators can read `/admin/audit`.

The table rejects update, delete, and truncate through guard triggers, while direct table privileges are removed from ordinary roles. The booking trigger and guards are `SECURITY DEFINER` functions with a fixed `search_path`, so the runtime role does not need direct insert access to the history table.

These controls protect records from routine DML; they are not tamper-proof against privileged operators. A holder of the runtime database credential can set the transaction-local actor values and create plausibly attributed future records through booking DML. The migration owner, database owner, and superusers can alter or disable triggers and can change the table. Production must use a non-owner runtime role, reserve owner credentials for migrations, restrict both credentials, and treat `database_user` plus independent database logs as corroborating evidence rather than proof.
