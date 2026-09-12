import assert from 'node:assert/strict';

import { PrismaPg } from '@prisma/adapter-pg';

import { setBookingAuditContext } from '@/lib/utils/server/booking-audit';
import { PrismaClient } from '@/prisma/generated/prisma/client';

const connectionString = process.env.TEST_DATABASE_URL;
const runtimeRole = process.env.BOOKING_AUDIT_TEST_RUNTIME_ROLE;
assert(connectionString, 'TEST_DATABASE_URL is required');
assert(runtimeRole, 'BOOKING_AUDIT_TEST_RUNTIME_ROLE is required');
assert(
  /^booking_audit_runtime_[0-9]+_[0-9]+$/.test(runtimeRole),
  'Unexpected runtime role name',
);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const bookingData = (
  id: number,
  userId: number,
  orgId: number,
  venueId: number,
  name: string,
) => ({
  id,
  bookingName: name,
  venueId,
  userId,
  userOrgId: orgId,
  bookedForOrgId: orgId,
  start: new Date('2026-09-10T11:30:00.000Z'),
  end: new Date('2026-09-10T14:30:00.000Z'),
});

try {
  await prisma.user.createMany({
    data: [
      {
        id: 1,
        name: 'Audit Admin',
        telegramId: 'audit-admin',
        telegramUserName: 'audit_admin',
      },
      ...Array.from({ length: 8 }, (_, index) => ({
        id: index + 2,
        name: `Booking Owner ${index + 2}`,
        telegramId: `booking-owner-${index + 2}`,
        telegramUserName: `booking_owner_${index + 2}`,
      })),
    ],
  });
  await prisma.organisation.createMany({
    data: Array.from({ length: 7 }, (_, index) => ({
      id: 74 + index,
      name: `Audit Organisation ${74 + index}`,
      description: '',
      category: 'Others' as const,
    })),
  });
  await prisma.userOnOrg.createMany({
    data: [
      { userId: 1, orgId: 74 },
      { userId: 2, orgId: 74 },
      { userId: 3, orgId: 74 },
      { userId: 4, orgId: 75 },
      { userId: 5, orgId: 76 },
      { userId: 6, orgId: 77 },
      { userId: 7, orgId: 78 },
      { userId: 8, orgId: 79 },
      { userId: 9, orgId: 80 },
    ],
  });
  await prisma.venue.createMany({
    data: [
      { id: 14, name: 'Audit Venue' },
      { id: 15, name: 'Deleted Venue' },
    ],
  });

  await prisma.booking.create({
    data: bookingData(100, 2, 74, 14, 'Original'),
  });
  assert.equal(await prisma.bookingAudit.count(), 0, 'INSERT is not audited');
  await prisma.$transaction(async (tx) => {
    await setBookingAuditContext(tx, 1, 'booking-edit');
    await tx.booking.update({
      where: { id: 100 },
      data: { bookingName: 'Edited' },
    });
  });
  await prisma.$transaction(async (tx) => {
    await setBookingAuditContext(tx, 1, 'booking-delete');
    await tx.booking.delete({ where: { id: 100 } });
  });

  await prisma.booking.create({
    data: bookingData(101, 3, 74, 14, 'Membership cascade deletion'),
  });
  await prisma.$transaction(async (tx) => {
    await setBookingAuditContext(tx, 1, 'user-membership-edit');
    await tx.userOnOrg.delete({
      where: { userId_orgId: { userId: 3, orgId: 74 } },
    });
  });

  await prisma.booking.create({
    data: bookingData(102, 2, 74, 14, 'Direct database mutation'),
  });
  await prisma.booking.update({
    where: { id: 102 },
    data: { bookingName: 'Direct database update' },
  });
  await prisma.booking.delete({ where: { id: 102 } });

  await prisma.booking.create({
    data: bookingData(103, 4, 75, 14, 'Organisation cascade deletion'),
  });
  await prisma.$transaction(async (tx) => {
    await setBookingAuditContext(tx, 1, 'organisation-delete');
    await tx.organisation.delete({ where: { id: 75 } });
  });

  await prisma.booking.create({
    data: bookingData(104, 5, 76, 14, 'User cascade deletion'),
  });
  await prisma.$transaction(async (tx) => {
    await setBookingAuditContext(tx, 5, 'user-delete');
    await tx.user.delete({ where: { id: 5 } });
  });
  await assert.rejects(
    prisma.$transaction((tx) =>
      setBookingAuditContext(tx, 5, 'booking-delete'),
    ),
    /Booking audit actor not found/,
  );

  await prisma.booking.create({
    data: bookingData(105, 6, 77, 15, 'Venue cascade deletion'),
  });
  await prisma.venue.delete({ where: { id: 15 } });

  await prisma.booking.create({
    data: bookingData(106, 7, 78, 14, 'Organisation leave cascade'),
  });
  await prisma.$transaction(async (tx) => {
    await setBookingAuditContext(tx, 7, 'organisation-leave');
    await tx.userOnOrg.delete({
      where: { userId_orgId: { userId: 7, orgId: 78 } },
    });
  });

  await prisma.booking.create({
    data: bookingData(107, 8, 79, 14, 'Event controlled booking'),
  });
  await prisma.event.create({
    data: {
      id: 107,
      eventName: 'Event controlled booking',
      userId: 8,
      userOrgId: 79,
      bookedForOrgId: 79,
      bookingId: 107,
      start: new Date('2026-09-10T11:30:00.000Z'),
      end: new Date('2026-09-10T14:30:00.000Z'),
    },
  });
  await prisma.$transaction(async (tx) => {
    await setBookingAuditContext(tx, 1, 'event-edit');
    await tx.event.update({
      where: { id: 107 },
      data: { eventName: 'Edited event' },
    });
    await tx.booking.update({
      where: { id: 107 },
      data: { bookingName: 'Edited event' },
    });
  });
  await prisma.$transaction(async (tx) => {
    await setBookingAuditContext(tx, 1, 'event-delete');
    await tx.event.delete({ where: { id: 107 } });
    await tx.booking.delete({ where: { id: 107 } });
  });

  await prisma.booking.create({
    data: bookingData(108, 9, 80, 14, 'Runtime role booking'),
  });
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL ROLE "${runtimeRole}"`);
    await tx.booking.update({
      where: { id: 108 },
      data: { bookingName: 'Runtime role update' },
    });
  });

  const audits = await prisma.bookingAudit.findMany({ orderBy: { id: 'asc' } });
  assert.deepEqual(
    audits.map(({ bookingId, action, actorUserId, source }) => ({
      bookingId,
      action,
      actorUserId,
      source,
    })),
    [
      {
        bookingId: 100,
        action: 'updated',
        actorUserId: 1,
        source: 'booking-edit',
      },
      {
        bookingId: 100,
        action: 'deleted',
        actorUserId: 1,
        source: 'booking-delete',
      },
      {
        bookingId: 101,
        action: 'deleted',
        actorUserId: 1,
        source: 'user-membership-edit',
      },
      {
        bookingId: 102,
        action: 'updated',
        actorUserId: null,
        source: 'database',
      },
      {
        bookingId: 102,
        action: 'deleted',
        actorUserId: null,
        source: 'database',
      },
      {
        bookingId: 103,
        action: 'deleted',
        actorUserId: 1,
        source: 'organisation-delete',
      },
      {
        bookingId: 104,
        action: 'deleted',
        actorUserId: 5,
        source: 'user-delete',
      },
      {
        bookingId: 105,
        action: 'deleted',
        actorUserId: null,
        source: 'database',
      },
      {
        bookingId: 106,
        action: 'deleted',
        actorUserId: 7,
        source: 'organisation-leave',
      },
      {
        bookingId: 107,
        action: 'updated',
        actorUserId: 1,
        source: 'event-edit',
      },
      {
        bookingId: 107,
        action: 'deleted',
        actorUserId: 1,
        source: 'event-delete',
      },
      {
        bookingId: 108,
        action: 'updated',
        actorUserId: null,
        source: 'database',
      },
    ],
  );

  const [first, second, membership, directUpdate, , , userCascade] = audits;
  assert.equal(
    (first.before as { booking_name: string }).booking_name,
    'Original',
  );
  assert.equal(
    (first.after as { booking_name: string }).booking_name,
    'Edited',
  );
  assert.equal(
    (second.before as { booking_name: string }).booking_name,
    'Edited',
  );
  assert.equal(second.after, null);
  assert.equal(
    (membership.before as { booking_name: string }).booking_name,
    'Membership cascade deletion',
  );
  assert.equal(
    (directUpdate.after as { booking_name: string }).booking_name,
    'Direct database update',
  );
  assert.equal(first.actorName, 'Audit Admin');
  assert.equal(first.actorTelegramUserName, 'audit_admin');
  assert.equal(userCascade.actorName, 'Booking Owner 5');
  assert.equal(userCascade.actorTelegramUserName, 'booking_owner_5');
  assert.equal(audits[3].actorName, null);
  assert.equal(audits[7].actorName, null);
  assert(audits.every((audit) => audit.databaseUser.length > 0));
  assert.equal(audits.at(-1)?.databaseUser, audits[0].databaseUser);

  await assert.rejects(
    prisma.bookingAudit.update({
      where: { id: first.id },
      data: { source: 'database' },
    }),
    /booking_audits is append-only/,
  );
  await assert.rejects(
    prisma.bookingAudit.delete({ where: { id: first.id } }),
    /booking_audits is append-only/,
  );
  await assert.rejects(
    prisma.$executeRawUnsafe('TRUNCATE TABLE booking_audits'),
    /booking_audits is append-only/,
  );
  await assert.rejects(
    prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE "${runtimeRole}"`);
      await tx.bookingAudit.create({
        data: {
          bookingId: 999,
          action: 'deleted',
          source: 'database',
          databaseUser: 'forged',
          before: {},
        },
      });
    }),
    /permission denied/,
  );

  console.log('booking audit integration: PASS');
} finally {
  await prisma.$disconnect();
}
