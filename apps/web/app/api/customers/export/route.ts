import { NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';

const HEADERS = ['first_name', 'last_name', 'phone', 'email', 'address', 'date_of_birth', 'anniversary_date'];

function csvEscape(value: string | number | null): string {
  const str = String(value ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data: customers } = await admin
    .from('customers')
    .select('first_name, last_name, phone, email, address, date_of_birth, anniversary_date')
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .order('first_name');

  const rows = [
    HEADERS.join(','),
    ...(customers ?? []).map((c) =>
      [
        csvEscape(c.first_name),
        csvEscape(c.last_name),
        csvEscape(c.phone),
        csvEscape(c.email),
        csvEscape(c.address),
        csvEscape(c.date_of_birth),
        csvEscape(c.anniversary_date)
      ].join(',')
    )
  ];

  return new NextResponse(rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
