import assert from 'node:assert/strict';

import { BookingAuditQuerySchema } from '@/lib/schema/booking-audit';

const validCursor = Buffer.from('2026-09-11T05:00:00.000Z|42').toString(
  'base64url',
);
const parsed = BookingAuditQuerySchema.parse({
  action: 'deleted',
  source: 'event-delete',
  bookingId: '123',
  actorUserId: '7',
  cursor: validCursor,
  limit: '100',
});
assert.equal(parsed.bookingId, 123);
assert.equal(parsed.actorUserId, 7);
assert.equal(parsed.limit, 100);
assert.equal(parsed.cursor?.id, 42n);

assert.equal(BookingAuditQuerySchema.parse({}).limit, 50);
const emptyFilters = BookingAuditQuerySchema.parse({
  action: '',
  source: '',
  bookingId: '',
  actorUserId: '',
});
assert.equal(emptyFilters.limit, 50);
assert.equal(emptyFilters.action, undefined);
assert.equal(emptyFilters.source, undefined);
assert.equal(emptyFilters.bookingId, undefined);
assert.equal(emptyFilters.actorUserId, undefined);
for (const invalid of [
  { action: 'inserted' },
  { source: 'arbitrary' },
  { bookingId: '0' },
  { actorUserId: '2147483648' },
  { limit: '101' },
  { cursor: 'not*a*cursor' },
  {
    cursor: Buffer.from(
      '2026-09-11T05:00:00.000Z|9223372036854775808',
    ).toString('base64url'),
  },
  { unexpected: 'value' },
]) {
  assert.equal(BookingAuditQuerySchema.safeParse(invalid).success, false);
}

console.log('booking audit query validation: PASS');
