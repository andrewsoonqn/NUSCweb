import { notFound, redirect } from 'next/navigation';

import BookingAudits from '@/components/admin/BookingAudits';
import { getAuthCookie } from '@/lib/auth/server';
import { BookingAuditQuerySchema } from '@/lib/schema/booking-audit';
import { getBookingAudits } from '@/lib/utils/server/booking-audit-read';

export default async function BookingAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await getAuthCookie();
  if (!auth || !auth.isAdmin) redirect('/');

  const raw = await searchParams;
  const parsed = BookingAuditQuerySchema.safeParse(
    Object.fromEntries(
      Object.entries(raw).map(([key, value]) => [
        key,
        Array.isArray(value) ? value[0] : value,
      ]),
    ),
  );
  if (!parsed.success) notFound();

  const result = await getBookingAudits(parsed.data);
  const next = new URLSearchParams();
  for (const key of [
    'action',
    'source',
    'bookingId',
    'actorUserId',
    'limit',
  ] as const) {
    const value = parsed.data[key];
    if (value !== undefined) next.set(key, value.toString());
  }
  if (result.nextCursor) next.set('cursor', result.nextCursor);

  return (
    <BookingAudits
      rows={result.rows}
      filters={{
        action: parsed.data.action,
        source: parsed.data.source,
        bookingId: parsed.data.bookingId,
        actorUserId: parsed.data.actorUserId,
        limit: parsed.data.limit,
      }}
      nextHref={result.nextCursor ? `/admin/audit?${next}` : null}
    />
  );
}
