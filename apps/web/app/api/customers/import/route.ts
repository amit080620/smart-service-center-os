import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';

// Same minimal RFC-4180-ish parser used by the Parts/Services CSV
// import — handles quoted fields with escaped "" and commas/newlines
// inside quotes.
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
  const firstNameIdx = header.indexOf('first_name');
  const lastNameIdx = header.indexOf('last_name');
  const phoneIdx = header.indexOf('phone');
  const emailIdx = header.indexOf('email');
  const addressIdx = header.indexOf('address');
  const dobIdx = header.indexOf('date_of_birth');
  const anniversaryIdx = header.indexOf('anniversary_date');

  if (firstNameIdx === -1 || phoneIdx === -1) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'CSV must have at least "first_name" and "phone" columns.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: existingCustomers } = await admin.from('customers').select('phone').eq('org_id', session.employee.org_id).is('deleted_at', null);
  const existingPhones = new Set((existingCustomers ?? []).map((c) => c.phone));

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows.slice(1)) {
    const firstName = row[firstNameIdx]?.trim();
    const phone = row[phoneIdx]?.trim();
    if (!firstName || !phone) {
      skipped++;
      continue;
    }
    if (existingPhones.has(phone)) {
      skipped++;
      continue;
    }

    const dob = dobIdx >= 0 ? row[dobIdx]?.trim() : '';
    const anniversary = anniversaryIdx >= 0 ? row[anniversaryIdx]?.trim() : '';

    const { error } = await admin.from('customers').insert({
      org_id: session.employee.org_id,
      first_name: firstName,
      last_name: lastNameIdx >= 0 ? row[lastNameIdx]?.trim() || '' : '',
      phone,
      email: emailIdx >= 0 ? row[emailIdx]?.trim() || '' : '',
      address: addressIdx >= 0 ? row[addressIdx]?.trim() || '' : '',
      date_of_birth: dob && /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : null,
      anniversary_date: anniversary && /^\d{4}-\d{2}-\d{2}$/.test(anniversary) ? anniversary : null,
      whatsapp_opt_in: true
    });

    if (error) {
      errors.push(`${firstName} (${phone}): ${error.message}`);
    } else {
      created++;
      existingPhones.add(phone);
    }
  }

  return NextResponse.json({ created, skipped, errors: errors.slice(0, 10) });
}
