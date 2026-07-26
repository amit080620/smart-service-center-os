import { NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';

const HEADERS = ['customer_phone', 'plate_number', 'vin', 'make', 'model', 'vehicle_type', 'year', 'color', 'odometer_km'];

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
  const { data: vehicles } = await admin
    .from('vehicles')
    .select('customer_id, plate_number, vin, make, model, vehicle_type, year, color, odometer_km')
    .eq('org_id', session.employee.org_id)
    .is('deleted_at', null)
    .order('plate_number');

  const customerIds = [...new Set((vehicles ?? []).map((v) => v.customer_id))];
  const { data: customers } = customerIds.length
    ? await admin.from('customers').select('id, phone').in('id', customerIds)
    : { data: [] };

  const rows = [
    HEADERS.join(','),
    ...(vehicles ?? []).map((v) =>
      [
        csvEscape(customers?.find((c) => c.id === v.customer_id)?.phone ?? ''),
        csvEscape(v.plate_number),
        csvEscape(v.vin),
        csvEscape(v.make),
        csvEscape(v.model),
        csvEscape(v.vehicle_type),
        csvEscape(v.year),
        csvEscape(v.color),
        csvEscape(v.odometer_km)
      ].join(',')
    )
  ];

  return new NextResponse(rows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="vehicles-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
