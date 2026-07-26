import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { canManageOrgSettings } from '@smartbizos/permissions';

const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
};
const MAX_SIZE_BYTES = 3 * 1024 * 1024; // 3MB — a letterhead-style banner image, a bit more room than the small logo

// Uploads a custom header or footer image for the A4 invoice/estimate
// print — for shops printing on pre-designed letterhead paper, or who
// want a fully custom branded band (photos of services offered, shop
// frontage, etc.) instead of the plain text header/footer. Deliberately
// separate from the thermal print, which stays plain/text-only — a
// 72mm receipt has no room for a banner image and isn't where letterhead
// branding matters anyway.
export async function POST(req: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  if (!canManageOrgSettings(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Only the org owner can update organization settings.' } },
      { status: 403 }
    );
  }

  const formData = await req.formData();
  const file = formData.get('file');
  const kind = formData.get('kind');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'No file uploaded.' } }, { status: 400 });
  }
  if (kind !== 'header' && kind !== 'footer') {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'kind must be "header" or "footer".' } }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Image must be PNG, JPEG, or WEBP.' } },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Image must be under 3MB.' } }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const orgId = session.employee.org_id;
  const path = `${orgId}/invoice-${kind}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage.from('org-logos').upload(path, arrayBuffer, {
    contentType: file.type,
    upsert: true
  });

  if (uploadError) {
    return NextResponse.json({ error: { code: 'UPLOAD_ERROR', message: uploadError.message } }, { status: 500 });
  }

  const { data: publicUrlData } = admin.storage.from('org-logos').getPublicUrl(path);
  const imageUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { data: org } = await admin.from('organizations').select('settings').eq('id', orgId).maybeSingle();
  const currentSettings = (org?.settings as Record<string, unknown>) ?? {};
  const settingsKey = kind === 'header' ? 'invoice_header_image_url' : 'invoice_footer_image_url';

  const { error: updateError } = await admin
    .from('organizations')
    .update({ settings: { ...currentSettings, [settingsKey]: imageUrl }, updated_at: new Date().toISOString() })
    .eq('id', orgId);

  if (updateError) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: updateError.message } }, { status: 500 });
  }

  return NextResponse.json({ imageUrl, kind });
}

// Removes a header/footer image, reverting to the plain text
// header/footer.
export async function DELETE(req: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }
  if (!canManageOrgSettings(session.employee.role)) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Only the org owner can update organization settings.' } },
      { status: 403 }
    );
  }

  const { kind } = await req.json();
  if (kind !== 'header' && kind !== 'footer') {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'kind must be "header" or "footer".' } }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const orgId = session.employee.org_id;
  const { data: org } = await admin.from('organizations').select('settings').eq('id', orgId).maybeSingle();
  const currentSettings = (org?.settings as Record<string, unknown>) ?? {};
  const settingsKey = kind === 'header' ? 'invoice_header_image_url' : 'invoice_footer_image_url';
  delete currentSettings[settingsKey];

  const { error } = await admin
    .from('organizations')
    .update({ settings: currentSettings, updated_at: new Date().toISOString() })
    .eq('id', orgId);

  if (error) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error.message } }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
