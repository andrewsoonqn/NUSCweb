#!/usr/bin/env bash
set -euo pipefail

: "${BOOKING_AUDIT_TEST_GUARD_DATABASE_URL:?BOOKING_AUDIT_TEST_GUARD_DATABASE_URL is required}"
: "${BOOKING_AUDIT_TEST_SYSTEM_DATABASE_URL:?BOOKING_AUDIT_TEST_SYSTEM_DATABASE_URL is required}"

repo=$(cd "$(dirname "$0")/.." && pwd)
output=$(mktemp)
cleanup() {
  rm -f "$output"
  psql -X -q -v ON_ERROR_STOP=1 -d "$BOOKING_AUDIT_TEST_GUARD_DATABASE_URL" \
    -c 'DROP TABLE IF EXISTS public.booking_audit_runner_safety_marker' \
    >/dev/null 2>&1 || true
}
trap cleanup EXIT

psql -X -q -v ON_ERROR_STOP=1 -d "$BOOKING_AUDIT_TEST_GUARD_DATABASE_URL" \
  -c 'CREATE TABLE public.booking_audit_runner_safety_marker (id INTEGER); INSERT INTO public.booking_audit_runner_safety_marker VALUES (1)' \
  >/dev/null

if BOOKING_AUDIT_TEST_EXTERNAL=1 \
  BOOKING_AUDIT_TEST_EXPECTED_DATABASE=definitely_not_the_connected_database \
  TEST_DATABASE_URL="$BOOKING_AUDIT_TEST_GUARD_DATABASE_URL" \
  bash "$repo/tests/run-booking-audit-integration.sh" >"$output" 2>&1; then
  echo 'Expected mismatched database guard to fail' >&2
  exit 1
fi
grep -q 'database mismatch' "$output"
marker_count=$(psql -X -q -At -v ON_ERROR_STOP=1 \
  -d "$BOOKING_AUDIT_TEST_GUARD_DATABASE_URL" \
  -c 'SELECT count(*) FROM public.booking_audit_runner_safety_marker')
[[ "$marker_count" == "1" ]]

if BOOKING_AUDIT_TEST_EXTERNAL=1 \
  BOOKING_AUDIT_TEST_EXPECTED_DATABASE=postgres \
  TEST_DATABASE_URL="$BOOKING_AUDIT_TEST_SYSTEM_DATABASE_URL" \
  bash "$repo/tests/run-booking-audit-integration.sh" >"$output" 2>&1; then
  echo 'Expected system database guard to fail' >&2
  exit 1
fi
grep -q 'Refusing destructive booking audit test against system database' "$output"

echo 'booking audit runner safety: PASS'
