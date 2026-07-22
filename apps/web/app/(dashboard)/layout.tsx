'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Receipt,
  Car,
  Wrench,
  Package,
  Boxes,
  BarChart3,
  UserPlus,
  Settings,
  MoreHorizontal,
  X,
  LogOut
} from 'lucide-react';
import { createSupabaseBrowserClient } from '@smartbizos/database';
import { useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/job-cards', label: 'Jobs', icon: ClipboardList },
  { href: '/customers', label: 'Clients', icon: Users },
  { href: '/invoices', label: 'Billing', icon: Receipt }
];

const MORE_ITEMS = [
  { href: '/vehicles', label: 'Vehicles', icon: Car },
  { href: '/services', label: 'Services', icon: Wrench },
  { href: '/parts', label: 'Parts', icon: Package },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/employees', label: 'Employees', icon: UserPlus },
  { href: '/settings', label: 'Settings', icon: Settings }
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/');
  }

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Desktop top nav — hidden on mobile */}
      <nav className="hidden md:flex items-center justify-between px-6 py-3 border-b border-slate-800 bg-slate-950/95 backdrop-blur sticky top-0 z-40">
        <div className="flex items-center gap-1">
          {[...NAV_ITEMS, ...MORE_ITEMS].map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  active ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-slate-900 transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </nav>

      {/* Page content — bottom padding on mobile so the fixed tab bar never covers content */}
      <main className="pb-20 md:pb-0">{children}</main>

      {/* Mobile bottom tab bar — hidden on desktop */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex items-stretch safe-area-bottom">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium transition-all ${
                active ? 'text-amber-500' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-xs font-medium text-slate-500 cursor-pointer"
        >
          <MoreHorizontal className="w-5 h-5" />
          More
        </button>
      </nav>

      {/* Mobile "More" bottom sheet */}
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 rounded-t-2xl p-4 pb-8 animate-fadeIn">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-200">More</h2>
              <button onClick={() => setMoreOpen(false)} className="text-slate-500 cursor-pointer p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="flex flex-col items-center gap-2 p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-medium"
                  >
                    <Icon className="w-5 h-5 text-amber-500" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <button
              onClick={handleLogout}
              className="w-full mt-4 flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800 text-red-400 text-sm font-medium cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
