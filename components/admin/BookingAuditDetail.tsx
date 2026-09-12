import Link from 'next/link';

import { Button } from '@/components/ui/button';
import type { getBookingAudit } from '@/lib/utils/server/booking-audit-read';

type BookingAuditRecord = NonNullable<
  Awaited<ReturnType<typeof getBookingAudit>>
>;

const JsonBlock = ({ label, value }: { label: string; value: unknown }) => (
  <section>
    <h2 className='mb-2 text-lg font-semibold'>{label}</h2>
    <pre className='overflow-auto rounded border bg-slate-50 p-4 text-sm'>
      {value == null ? 'None' : JSON.stringify(value, null, 2)}
    </pre>
  </section>
);

export default function BookingAuditDetail({
  record,
}: {
  record: BookingAuditRecord;
}) {
  return (
    <main className='container mx-auto space-y-6 px-4 py-8'>
      <div className='flex items-center justify-between'>
        <h1 className='text-3xl font-bold text-slate-800'>
          Booking audit record {record.id}
        </h1>
        <Button asChild variant='outline'>
          <Link href='/admin/audit'>Back</Link>
        </Button>
      </div>
      <dl className='grid gap-3 rounded-lg border bg-white p-6 md:grid-cols-2'>
        <div>
          <dt className='font-semibold'>Created</dt>
          <dd>{new Date(record.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt className='font-semibold'>Booking / action</dt>
          <dd>
            #{record.bookingId} / {record.action}
          </dd>
        </div>
        <div>
          <dt className='font-semibold'>Actor</dt>
          <dd>
            {record.actorName ?? 'Unattributed'}
            {record.actorTelegramUserName
              ? ` (@${record.actorTelegramUserName})`
              : ''}
            {record.actorUserId ? ` #${record.actorUserId}` : ''}
          </dd>
        </div>
        <div>
          <dt className='font-semibold'>Source</dt>
          <dd>{record.source}</dd>
        </div>
        <div>
          <dt className='font-semibold'>Database user</dt>
          <dd>{record.databaseUser}</dd>
        </div>
      </dl>
      <JsonBlock label='Before' value={record.before} />
      <JsonBlock label='After' value={record.after} />
    </main>
  );
}
