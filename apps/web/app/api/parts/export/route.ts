import { NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';

const HEADERS = ['name', 'sku', 'category', 'unit_cost', 'discount_percent', 'hsn_sac_code', 'unit'];

// Escapes a value for safe CSV inclusion — wraps in quotes and doubles
// any internal quotes whenever the value could otherwise break the
// column structure (commas, quotes, or newlines in a part name/notes).
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
  const { data: parts } = await admin
    .from('parts')
    .select('name, sku, category, unit_cost, discount_percent, hsn_sac_code, unit')
    .eq('org_id', session.employee.org_id)
    .order('name');

  const rows = [
    HEADERS.join(','),
    ...(parts ?? []).map((p) =>
      [
        csvEscape(p.name),
        csvEscape(p.sku),
        csvEscape(p.category),
        csvEscape(p.unit_cost),
        csvEscape(p.discount_percent),
        csvEscape(p.hsn_sac_code),
        csvEscape(p.unit)
      ].join(',')
    )
  ];

  return new NextResponse(rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="parts-catalog-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
