import { z } from 'zod/v4';

export const BOOKING_AUDIT_ACTIONS = ['updated', 'deleted'] as const;
export const BOOKING_AUDIT_SOURCES = [
  'database',
  'booking-edit',
  'booking-delete',
  'event-edit',
  'event-delete',
  'user-membership-edit',
  'user-delete',
  'organisation-delete',
  'organisation-leave',
] as const;

const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value);

const optionalPositiveInteger = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().positive().max(2_147_483_647).optional(),
);

const cursorSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9_-]+$/)
  .transform((value, context) => {
    try {
      const decoded = Buffer.from(value, 'base64url').toString('utf8');
      const separator = decoded.lastIndexOf('|');
      const createdAt = new Date(decoded.slice(0, separator));
      const id = BigInt(decoded.slice(separator + 1));
      if (
        separator < 1 ||
        Number.isNaN(createdAt.valueOf()) ||
        id < 1n ||
        id > 9_223_372_036_854_775_807n
      )
        throw new Error();
      return { createdAt, id };
    } catch {
      context.addIssue({ code: 'custom', message: 'Invalid cursor' });
      return z.NEVER;
    }
  });

export const BookingAuditQuerySchema = z
  .object({
    action: z.preprocess(
      emptyToUndefined,
      z.enum(BOOKING_AUDIT_ACTIONS).optional(),
    ),
    source: z.preprocess(
      emptyToUndefined,
      z.enum(BOOKING_AUDIT_SOURCES).optional(),
    ),
    bookingId: optionalPositiveInteger,
    actorUserId: optionalPositiveInteger,
    cursor: cursorSchema.optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export type BookingAuditQuery = z.output<typeof BookingAuditQuerySchema>;
