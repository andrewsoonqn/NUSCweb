import Link from 'next/link';

import { Button } from '@/components/ui/button';
import {
  BOOKING_AUDIT_ACTIONS,
  BOOKING_AUDIT_SOURCES,
} from '@/lib/schema/booking-audit';
import type { BookingAuditListItem } from '@/lib/utils/server/booking-audit-read';

interface BookingAuditsProps {
  rows: BookingAuditListItem[];
  filters: {
    action?: string;
    source?: string;
    bookingId?: number;
    actorUserId?: number;
    limit: number;
  };
  nextHref: string | null;
}

export default function BookingAudits({
  rows,
  filters,
  nextHref,
}: BookingAuditsProps) {
  return (
    <main className='container mx-auto px-4 py-8'>
      <h1 className='mb-6 text-3xl font-bold text-slate-800'>
        Booking audit history
      </h1>

      <form className='mb-6 grid gap-4 rounded-lg border bg-white p-4 md:grid-cols-5'>
        <label className='text-sm font-medium text-gray-700'>
          Action
          <select
            name='action'
            defaultValue={filters.action ?? ''}
            className='mt-1 block w-full rounded-md border px-3 py-2'
          >
            <option value=''>All</option>
            {BOOKING_AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {action}
              </option>
            ))}
          </select>
        </label>
        <label className='text-sm font-medium text-gray-700'>
          Source
          <select
            name='source'
            defaultValue={filters.source ?? ''}
            className='mt-1 block w-full rounded-md border px-3 py-2'
          >
            <option value=''>All</option>
            {BOOKING_AUDIT_SOURCES.map((source) => (
              <option key={source} value={source}>
                {source}
              </option>
            ))}
          </select>
        </label>
        <label className='text-sm font-medium text-gray-700'>
          Booking ID
          <input
            name='bookingId'
            type='number'
            min='1'
            max='2147483647'
            defaultValue={filters.bookingId}
            className='mt-1 block w-full rounded-md border px-3 py-2'
          />
        </label>
        <label className='text-sm font-medium text-gray-700'>
          Actor user ID
          <input
            name='actorUserId'
            type='number'
            min='1'
            max='2147483647'
            defaultValue={filters.actorUserId}
            className='mt-1 block w-full rounded-md border px-3 py-2'
          />
        </label>
        <div className='flex items-end gap-2'>
          <input type='hidden' name='limit' value={filters.limit} />
          <Button type='submit'>Apply</Button>
          <Button asChild type='button' variant='outline'>
            <Link href='/admin/audit'>Clear</Link>
          </Button>
        </div>
      </form>

      <div className='overflow-hidden rounded-lg border bg-white shadow-sm'>
        <div className='hidden grid-cols-6 gap-3 bg-slate-800 px-6 py-4 font-medium text-white md:grid'>
          <span>TIME</span>
          <span>BOOKING</span>
          <span>ACTION</span>
          <span>ACTOR</span>
          <span>SOURCE</span>
          <span>DATABASE USER</span>
        </div>
        <div className='divide-y divide-gray-200'>
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/admin/audit/${row.id}`}
              className='grid grid-cols-1 gap-2 px-6 py-4 hover:bg-gray-50 md:grid-cols-6'
            >
              <span>{new Date(row.createdAt).toLocaleString()}</span>
              <span>#{row.bookingId}</span>
              <span>{row.action}</span>
              <span>
                {row.actorName ?? 'Unattributed'}
                {row.actorTelegramUserName
                  ? ` (@${row.actorTelegramUserName})`
                  : ''}
                {row.actorUserId ? ` #${row.actorUserId}` : ''}
              </span>
              <span>{row.source}</span>
              <span>{row.databaseUser}</span>
            </Link>
          ))}
          {rows.length === 0 && (
            <p className='px-6 py-8 text-gray-500'>
              No booking audit records found.
            </p>
          )}
        </div>
      </div>
      {nextHref && (
        <Button asChild className='mt-6'>
          <Link href={nextHref}>Next page</Link>
        </Button>
      )}
    </main>
  );
}
