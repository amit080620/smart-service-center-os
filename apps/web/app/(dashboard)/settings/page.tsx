import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { canManageOrgSettings } from '@smartbizos/permissions';
import SettingsClient from './SettingsClient';

export default async function SettingsPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  return (
    <SettingsClient
      orgName={session.org.name}
      currentLogoUrl={session.org.logo_url}
      contactPhone={session.org.contact_phone}
      contactEmail={session.org.contact_email}
      address={session.org.address}
      gstNumber={session.org.settings.gst_number ?? ''}
      invoiceFooterText={session.org.settings.invoice_footer_text ?? ''}
      currentHeaderImageUrl={(session.org.settings.invoice_header_image_url as string) ?? null}
      currentFooterImageUrl={(session.org.settings.invoice_footer_image_url as string) ?? null}
      thermalPrinterIp={(session.org.settings.thermal_printer_ip as string) ?? ''}
      thermalPaperWidth={(session.org.settings.thermal_paper_width as 58 | 80) ?? 58}
      canManage={canManageOrgSettings(session.employee.role)}
    />
  );
}
