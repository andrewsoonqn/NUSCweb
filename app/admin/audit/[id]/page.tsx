import { notFound, redirect } from 'next/navigation';

import BookingAuditDetail from '@/components/admin/BookingAuditDetail';
import { getAuthCookie } from '@/lib/auth/server';
import { getBookingAudit } from '@/lib/utils/server/booking-audit-read';

export default async function BookingAuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const auth = await getAuthCookie();
  if (!auth || !auth.isAdmin) redirect('/');

  const id = (await params).id;
  if (!/^\d{1,19}$/.test(id)) notFound();
  const auditId = BigInt(id);
  if (auditId < 1n || auditId > 9_223_372_036_854_775_807n) notFound();

  const record = await getBookingAudit(auditId);
  if (!record) notFound();
  return <BookingAuditDetail record={record} />;
}
