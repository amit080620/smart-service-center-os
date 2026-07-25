import type { Metadata } from 'next';
import InstallPrompt from '@/components/InstallPrompt';
import PlatformAdminTopBar from './PlatformAdminTopBar';

// Overrides the manifest for every page under /platform-admin — a
// distinct name, icon, and start_url ("SC Admin", red shield icon)
// from the regular shop-facing app, so an "Add to Home Screen" done
// from here creates its own separate shortcut straight into the
// Super Admin panel, not the normal dashboard.
export const metadata: Metadata = {
  title: 'SmartBizOS — Super Admin',
  manifest: '/manifest-admin.json',
  icons: {
    icon: '/icons/icon-admin-192.png',
    apple: '/icons/apple-touch-icon-admin.png'
  }
};

export default function PlatformAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <InstallPrompt />
      <PlatformAdminTopBar />
      {children}
    </>
  );
}
