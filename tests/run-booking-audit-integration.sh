#!/usr/bin/env bash
set -euo pipefail

repo=$(cd "$(dirname "$0")/.." && pwd)
runtime_role="booking_audit_runtime_${BASHPID}_${RANDOM}"
role_created=0

if [[ "${BOOKING_AUDIT_TEST_EXTERNAL:-0}" == "1" ]]; then
  : "${TEST_DATABASE_URL:?TEST_DATABASE_URL is required in external mode}"
  : "${BOOKING_AUDIT_TEST_EXPECTED_DATABASE:?BOOKING_AUDIT_TEST_EXPECTED_DATABASE is required in external mode}"
  command -v psql >/dev/null || {
    echo "Missing required PostgreSQL command: psql" >&2
    exit 1
  }
  database_url=$TEST_DATABASE_URL
  psql_test=(psql -X -q -v ON_ERROR_STOP=1 -d "$database_url")
  cleanup() {
    if [[ "$role_created" == "1" ]]; then
      "${psql_test[@]}" -v runtime_role="$runtime_role" <<'SQL' >/dev/null 2>&1 || true
DROP OWNED BY :"runtime_role";
DROP ROLE IF EXISTS :"runtime_role";
SQL
    fi
  }
  trap cleanup EXIT

  actual_database=$("${psql_test[@]}" -Atc 'SELECT current_database()')
  case "$actual_database" in
    postgres | template0 | template1)
      echo "Refusing destructive booking audit test against system database: $actual_database" >&2
      exit 1
      ;;
  esac
  if [[ "$actual_database" != "$BOOKING_AUDIT_TEST_EXPECTED_DATABASE" ]]; then
    echo "Booking audit test database mismatch: expected $BOOKING_AUDIT_TEST_EXPECTED_DATABASE, connected to $actual_database" >&2
    exit 1
  fi

  "${psql_test[@]}" <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
SQL
else
  for command in initdb pg_ctl createdb psql; do
    command -v "$command" >/dev/null || {
      echo "Missing required PostgreSQL command: $command" >&2
      exit 1
    }
  done

  work=$(mktemp -d)
  port=$((55000 + RANDOM % 4000))
  cleanup() {
    pg_ctl -D "$work/data" -m immediate stop >/dev/null 2>&1 || true
    rm -rf "$work"
  }
  trap cleanup EXIT

  initdb -D "$work/data" --auth=trust --no-locale >/dev/null
  pg_ctl -D "$work/data" -o "-p $port -k $work" -w start >/dev/null
  createdb -h "$work" -p "$port" booking_audit_test
  database_url="postgresql://127.0.0.1:$port/booking_audit_test"
  psql_test=(psql -X -q -v ON_ERROR_STOP=1 -h "$work" -p "$port" -d booking_audit_test)
fi

while IFS= read -r migration; do
  "${psql_test[@]}" -f "$migration" >/dev/null
done < <(find "$repo/prisma/migrations" -name migration.sql -print | sort)

"${psql_test[@]}" -v runtime_role="$runtime_role" <<'SQL'
CREATE ROLE :"runtime_role";
GRANT USAGE ON SCHEMA public TO :"runtime_role";
GRANT SELECT, INSERT, UPDATE, DELETE ON
  users, organisations, user_on_org, venues, bookings, events
  TO :"runtime_role";
GRANT SELECT ON booking_audits TO :"runtime_role";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO :"runtime_role";
SQL
role_created=1

TEST_DATABASE_URL="$database_url" \
BOOKING_AUDIT_TEST_RUNTIME_ROLE="$runtime_role" \
  "$repo/node_modules/.bin/tsx" "$repo/tests/booking-audit.test.ts"
