-- Booking audit history is prospective: existing bookings do not create rows.
CREATE TABLE "public"."booking_audits" (
    "id" BIGSERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" INTEGER,
    "actor_name" TEXT,
    "actor_telegram_user_name" TEXT,
    "source" TEXT NOT NULL DEFAULT 'database',
    "database_user" TEXT NOT NULL DEFAULT SESSION_USER,
    "before" JSONB NOT NULL,
    "after" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_audits_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "booking_audits_action_check"
        CHECK ("action" IN ('updated', 'deleted')),
    CONSTRAINT "booking_audits_source_check"
        CHECK ("source" IN (
            'database',
            'booking-edit',
            'booking-delete',
            'event-edit',
            'event-delete',
            'user-membership-edit',
            'user-delete',
            'organisation-delete',
            'organisation-leave'
        )),
    CONSTRAINT "booking_audits_snapshots_check"
        CHECK (
            ("action" = 'updated' AND "after" IS NOT NULL) OR
            ("action" = 'deleted' AND "after" IS NULL)
        )
);

CREATE INDEX "booking_audits_booking_id_idx"
    ON "public"."booking_audits"("booking_id");
CREATE INDEX "booking_audits_actor_user_id_idx"
    ON "public"."booking_audits"("actor_user_id");
CREATE INDEX "booking_audits_created_at_id_idx"
    ON "public"."booking_audits"("created_at" DESC, "id" DESC);

-- Run with the migration owner's rights so an ordinary runtime role does not
-- need permission to insert audit rows. SESSION_USER still records the login
-- role responsible for the booking mutation.
CREATE FUNCTION "public"."audit_booking_mutation"()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    actor_setting TEXT;
    actor_id INTEGER;
    actor_name TEXT;
    actor_telegram_user_name TEXT;
    source_setting TEXT;
    audit_source TEXT;
BEGIN
    actor_setting := current_setting('app.booking_actor_user_id', true);
    IF actor_setting ~ '^[0-9]+$' THEN
        actor_id := actor_setting::INTEGER;
    END IF;

    actor_name := NULLIF(
        current_setting('app.booking_actor_name', true),
        ''
    );
    actor_telegram_user_name := NULLIF(
        current_setting('app.booking_actor_telegram_user_name', true),
        ''
    );
    source_setting := current_setting('app.booking_audit_source', true);
    audit_source := CASE
        WHEN source_setting IN (
            'booking-edit',
            'booking-delete',
            'event-edit',
            'event-delete',
            'user-membership-edit',
            'user-delete',
            'organisation-delete',
            'organisation-leave'
        ) THEN source_setting
        ELSE 'database'
    END;

    IF TG_OP = 'UPDATE' THEN
        INSERT INTO "public"."booking_audits" (
            "booking_id",
            "action",
            "actor_user_id",
            "actor_name",
            "actor_telegram_user_name",
            "source",
            "database_user",
            "before",
            "after"
        ) VALUES (
            OLD."id",
            'updated',
            actor_id,
            actor_name,
            actor_telegram_user_name,
            audit_source,
            SESSION_USER,
            to_jsonb(OLD),
            to_jsonb(NEW)
        );
        RETURN NEW;
    END IF;

    INSERT INTO "public"."booking_audits" (
        "booking_id",
        "action",
        "actor_user_id",
        "actor_name",
        "actor_telegram_user_name",
        "source",
        "database_user",
        "before"
    ) VALUES (
        OLD."id",
        'deleted',
        actor_id,
        actor_name,
        actor_telegram_user_name,
        audit_source,
        SESSION_USER,
        to_jsonb(OLD)
    );
    RETURN OLD;
END;
$$;

CREATE TRIGGER "booking_audit_trigger"
AFTER UPDATE OR DELETE ON "public"."bookings"
FOR EACH ROW
EXECUTE FUNCTION "public"."audit_booking_mutation"();

-- Existing history is append-only for routine DML. Owners and superusers can
-- still change the table or disable these controls and remain trusted.
CREATE FUNCTION "public"."reject_booking_audit_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
    RAISE EXCEPTION 'booking_audits is append-only';
END;
$$;

CREATE TRIGGER "booking_audits_change_guard"
BEFORE UPDATE OR DELETE ON "public"."booking_audits"
FOR EACH ROW
EXECUTE FUNCTION "public"."reject_booking_audit_change"();
CREATE TRIGGER "booking_audits_truncate_guard"
BEFORE TRUNCATE ON "public"."booking_audits"
FOR EACH STATEMENT
EXECUTE FUNCTION "public"."reject_booking_audit_change"();

REVOKE ALL PRIVILEGES ON "public"."booking_audits" FROM PUBLIC;
REVOKE ALL PRIVILEGES ON SEQUENCE "public"."booking_audits_id_seq" FROM PUBLIC;

-- A hosted database can apply default table privileges directly to named roles.
-- Remove every such grant, including grants inherited by exposed API roles. A
-- dedicated non-owner application role must receive SELECT explicitly after
-- migration; booking writes continue through the SECURITY DEFINER trigger.
DO $$
DECLARE
    granted_role RECORD;
BEGIN
    FOR granted_role IN
        SELECT DISTINCT role.rolname
        FROM pg_catalog.pg_class AS relation
        JOIN pg_catalog.pg_namespace AS namespace
            ON namespace.oid = relation.relnamespace
        CROSS JOIN LATERAL pg_catalog.aclexplode(
            COALESCE(
                relation.relacl,
                pg_catalog.acldefault('r', relation.relowner)
            )
        ) AS privilege
        JOIN pg_catalog.pg_roles AS role
            ON role.oid = privilege.grantee
        WHERE namespace.nspname = 'public'
          AND relation.relname = 'booking_audits'
          AND relation.relkind = 'r'
          AND role.oid <> relation.relowner
    LOOP
        EXECUTE pg_catalog.format(
            'REVOKE ALL PRIVILEGES ON TABLE public.booking_audits FROM %I',
            granted_role.rolname
        );
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION "public"."audit_booking_mutation"() FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."reject_booking_audit_change"() FROM PUBLIC;
