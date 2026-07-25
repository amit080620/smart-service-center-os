import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { canManagePartsCatalog } from '@smartbizos/permissions';

// Minimal RFC-4180-ish CSV parser — handles quoted fields (with escaped
// "" for literal quotes, and commas/newlines inside quotes). Good enough
// for the controlled export→edit→import round trip this is meant for,
// without pulling in a parsing library for what's a fairly small format.
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

  if (!canManagePartsCatalog(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'You do not have permission to import parts.' } },
      { status: 403 }
    );
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
  const nameIdx = header.indexOf('name');
  const skuIdx = header.indexOf('sku');
  const categoryIdx = header.indexOf('category');
  const costIdx = header.indexOf('unit_cost');
  const discountIdx = header.indexOf('discount_percent');
  const hsnIdx = header.indexOf('hsn_sac_code');
  const unitIdx = header.indexOf('unit');

  if (nameIdx === -1 || skuIdx === -1) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'CSV must have at least "name" and "sku" columns.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: existingParts } = await admin.from('parts').select('sku').eq('org_id', session.employee.org_id);
  const existingSkus = new Set((existingParts ?? []).map((p) => p.sku));

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows.slice(1)) {
    const name = row[nameIdx]?.trim();
    const sku = row[skuIdx]?.trim();
    if (!name || !sku) {
      skipped++;
      continue;
    }
    if (existingSkus.has(sku)) {
      skipped++;
      continue;
    }

    const { error } = await admin.from('parts').insert({
      org_id: session.employee.org_id,
      name,
      sku,
      category: categoryIdx >= 0 ? row[categoryIdx]?.trim() || 'general' : 'general',
      unit_cost: costIdx >= 0 ? Number(row[costIdx]) || 0 : 0,
      discount_percent: discountIdx >= 0 ? Number(row[discountIdx]) || 0 : 0,
      hsn_sac_code: hsnIdx >= 0 ? row[hsnIdx]?.trim() || '' : '',
      unit: unitIdx >= 0 ? row[unitIdx]?.trim() || 'piece' : 'piece',
      is_active: true
    });

    if (error) {
      errors.push(`${name} (${sku}): ${error.message}`);
    } else {
      created++;
      existingSkus.add(sku);
    }
  }

  return NextResponse.json({ created, skipped, errors: errors.slice(0, 10) });
}
