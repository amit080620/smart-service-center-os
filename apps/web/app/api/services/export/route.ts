import { NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';

const HEADERS = ['name', 'category', 'base_cost', 'discount_percent', 'hsn_sac_code', 'unit', 'est_duration_minutes'];

function csvEscape(value: string | number): string {
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
  const { data: services } = await admin
    .from('services')
    .select('name, category, base_cost, discount_percent, hsn_sac_code, unit, est_duration_minutes')
    .eq('org_id', session.employee.org_id)
    .order('name');

  const rows = [
    HEADERS.join(','),
    ...(services ?? []).map((s) =>
      [
        csvEscape(s.name),
        csvEscape(s.category),
        csvEscape(s.base_cost),
        csvEscape(s.discount_percent),
        csvEscape(s.hsn_sac_code),
        csvEscape(s.unit),
        csvEscape(s.est_duration_minutes)
      ].join(',')
    )
  ];

  return new NextResponse(rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="services-catalog-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
