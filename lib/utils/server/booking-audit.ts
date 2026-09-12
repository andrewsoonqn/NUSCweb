import type { Prisma } from '@/prisma/generated/prisma/client';

export type BookingAuditSource =
  | 'booking-edit'
  | 'booking-delete'
  | 'event-edit'
  | 'event-delete'
  | 'user-membership-edit'
  | 'user-delete'
  | 'organisation-delete'
  | 'organisation-leave';

export const setBookingAuditContext = async (
  tx: Prisma.TransactionClient,
  actorUserId: number,
  source: BookingAuditSource,
) => {
  const context = await tx.$queryRaw<Array<{ actorUserId: string }>>`
    SELECT
      set_config(
        'app.booking_actor_user_id',
        ${actorUserId.toString()},
        true
      ) AS "actorUserId",
      set_config('app.booking_actor_name', "name", true),
      set_config(
        'app.booking_actor_telegram_user_name',
        "telegram_user_name",
        true
      ),
      set_config('app.booking_audit_source', ${source}, true)
    FROM "public"."users"
    WHERE "id" = ${actorUserId}
  `;

  if (!context[0]) {
    throw new Error('Booking audit actor not found');
  }
};
