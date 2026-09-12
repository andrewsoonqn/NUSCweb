import prisma from '@/lib/prisma';
import type { BookingAuditQuery } from '@/lib/schema/booking-audit';
import type { Prisma } from '@/prisma/generated/prisma/client';

export type BookingAuditListItem = {
  id: string;
  bookingId: number;
  action: string;
  actorUserId: number | null;
  actorName: string | null;
  actorTelegramUserName: string | null;
  source: string;
  databaseUser: string;
  createdAt: string;
};

const encodeCursor = (createdAt: Date, id: bigint) =>
  Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url');

export const getBookingAudits = async (query: BookingAuditQuery) => {
  const where: Prisma.BookingAuditWhereInput = {
    ...(query.action ? { action: query.action } : {}),
    ...(query.source ? { source: query.source } : {}),
    ...(query.bookingId ? { bookingId: query.bookingId } : {}),
    ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
    ...(query.cursor
      ? {
          OR: [
            { createdAt: { lt: query.cursor.createdAt } },
            { createdAt: query.cursor.createdAt, id: { lt: query.cursor.id } },
          ],
        }
      : {}),
  };
  const rows = await prisma.bookingAudit.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: query.limit + 1,
    select: {
      id: true,
      bookingId: true,
      action: true,
      actorUserId: true,
      actorName: true,
      actorTelegramUserName: true,
      source: true,
      databaseUser: true,
      createdAt: true,
    },
  });
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    rows: page.map((row) => ({
      ...row,
      id: row.id.toString(),
      createdAt: row.createdAt.toISOString(),
    })),
    nextCursor:
      rows.length > query.limit && last
        ? encodeCursor(last.createdAt, last.id)
        : null,
  };
};

export const getBookingAudit = async (id: bigint) => {
  const row = await prisma.bookingAudit.findUnique({ where: { id } });
  return row
    ? { ...row, id: row.id.toString(), createdAt: row.createdAt.toISOString() }
    : null;
};
