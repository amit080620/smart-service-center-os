import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export async function POST(req: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'No file uploaded.' } }, { status: 400 });
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'CSV has no data rows.' } }, { status: 400 });
  }

  const header = (rows[0] ?? []).map((h) => h.trim().toLowerCase());
  const phoneIdx = header.indexOf('customer_phone');
  const plateIdx = header.indexOf('plate_number');
  const vinIdx = header.indexOf('vin');
  const makeIdx = header.indexOf('make');
  const modelIdx = header.indexOf('model');
  const typeIdx = header.indexOf('vehicle_type');
  const yearIdx = header.indexOf('year');
  const colorIdx = header.indexOf('color');
  const odometerIdx = header.indexOf('odometer_km');

  if (phoneIdx === -1 || plateIdx === -1 || makeIdx === -1 || modelIdx === -1) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'CSV must have "customer_phone", "plate_number", "make", and "model" columns.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const [{ data: existingVehicles }, { data: customers }] = await Promise.all([
    admin.from('vehicles').select('plate_number').eq('org_id', session.employee.org_id).is('deleted_at', null),
    admin.from('customers').select('id, phone').eq('org_id', session.employee.org_id).is('deleted_at', null)
  ]);
  const existingPlates = new Set((existingVehicles ?? []).map((v) => v.plate_number));
  const phoneToCustomerId = new Map((customers ?? []).map((c) => [c.phone, c.id]));

  let created = 0;
  let skipped = 0;
  let noMatchingCustomer = 0;
  const errors: string[] = [];

  for (const row of rows.slice(1)) {
    const phone = row[phoneIdx]?.trim();
    const plateNumber = row[plateIdx]?.trim();
    const make = row[makeIdx]?.trim();
    const model = row[modelIdx]?.trim();
    if (!phone || !plateNumber || !make || !model) {
      skipped++;
      continue;
    }
    if (existingPlates.has(plateNumber)) {
      skipped++;
      continue;
    }
    const customerId = phoneToCustomerId.get(phone);
    if (!customerId) {
      // The customer must already exist (import Customers CSV first) —
      // vehicles can't be created without an owner to attach to.
      noMatchingCustomer++;
      continue;
    }

    const vehicleType = typeIdx >= 0 && row[typeIdx]?.trim() === 'bike' ? 'bike' : 'car';

    const { error } = await admin.from('vehicles').insert({
      org_id: session.employee.org_id,
      customer_id: customerId,
      plate_number: plateNumber,
      vin: vinIdx >= 0 ? row[vinIdx]?.trim() || '' : '',
      make,
      model,
      vehicle_type: vehicleType,
      year: yearIdx >= 0 ? Number(row[yearIdx]) || undefined : undefined,
      color: colorIdx >= 0 ? row[colorIdx]?.trim() || '' : '',
      odometer_km: odometerIdx >= 0 ? Number(row[odometerIdx]) || 0 : 0
    });

    if (error) {
      errors.push(`${plateNumber}: ${error.message}`);
    } else {
      created++;
      existingPlates.add(plateNumber);
    }
  }

  return NextResponse.json({ created, skipped, noMatchingCustomer, errors: errors.slice(0, 10) });
}
