import { NextRequest, NextResponse } from 'next/server';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { canManageOrgSettings } from '@smartbizos/permissions';
import { z } from 'zod';

const updateOrgSettingsSchema = z.object({
  contactPhone: z.string().trim().optional(),
  contactEmail: z.string().trim().email().optional().or(z.literal('')),
  address: z.string().trim().optional(),
  gstNumber: z.string().trim().optional(),
  invoiceFooterText: z.string().trim().optional(),
  thermalPrinterIp: z.string().trim().optional(),
  thermalPaperWidth: z.union([z.literal(58), z.literal(80)]).optional()
});

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

  const body = await req.json();
  const parsed = updateOrgSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: parsed.error.issues[0]?.message ?? 'Invalid input.' } },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // GST number and footer text live inside the existing `settings` JSON
  // column (same place cgst_rate/sgst_rate already live) — merged with
  // whatever's already there rather than replacing the whole object, so
  // unrelated settings never get wiped out by this update.
  const currentSettings = session.org.settings ?? {};
  const newSettings = {
    ...currentSettings,
    ...(parsed.data.gstNumber !== undefined && { gst_number: parsed.data.gstNumber }),
    ...(parsed.data.invoiceFooterText !== undefined && { invoice_footer_text: parsed.data.invoiceFooterText }),
    ...(parsed.data.thermalPrinterIp !== undefined && { thermal_printer_ip: parsed.data.thermalPrinterIp }),
    ...(parsed.data.thermalPaperWidth !== undefined && { thermal_paper_width: parsed.data.thermalPaperWidth })
  };

  const { data: updated, error } = await admin
    .from('organizations')
    .update({
      ...(parsed.data.contactPhone !== undefined && { contact_phone: parsed.data.contactPhone }),
      ...(parsed.data.contactEmail !== undefined && { contact_email: parsed.data.contactEmail }),
      ...(parsed.data.address !== undefined && { address: parsed.data.address }),
      settings: newSettings,
      updated_at: new Date().toISOString()
    })
    .eq('id', session.employee.org_id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: error?.message ?? 'Could not update settings.' } }, { status: 500 });
  }

  return NextResponse.json(updated);
}
