import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { canManageOrgSettings } from '@smartbizos/permissions';

const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg'
};
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB — plenty for a logo, keeps invoice pages light

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
  if (!(file instanceof File)) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'No file uploaded.' } }, { status: 400 });
  }

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Logo must be a PNG, JPEG, WEBP, or SVG image.' } },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Logo must be under 2MB.' } }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const orgId = session.employee.org_id;
  // Fixed filename per org (not per-upload) — each new upload overwrites
  // the previous logo rather than accumulating old versions in storage.
  const path = `${orgId}/logo.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await admin.storage.from('org-logos').upload(path, arrayBuffer, {
    contentType: file.type,
    upsert: true
  });

  if (uploadError) {
    return NextResponse.json({ error: { code: 'UPLOAD_ERROR', message: uploadError.message } }, { status: 500 });
  }

  const { data: publicUrlData } = admin.storage.from('org-logos').getPublicUrl(path);
  // Cache-bust with a timestamp query param — otherwise browsers/print
  // views keep showing the old cached logo after a re-upload, since the
  // URL path itself never changes.
  const logoUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await admin
    .from('organizations')
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq('id', orgId);

  if (updateError) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: updateError.message } }, { status: 500 });
  }

  return NextResponse.json({ logoUrl });
}
