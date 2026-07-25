'use client';

import { useState } from 'react';
import { LogOut, ShieldCheck } from 'lucide-react';
import { createSupabaseBrowserClient } from '@smartbizos/database';

// Sits at the very top of every /platform-admin page — the Super Admin
// section has its own separate top bar rather than sharing the regular
// shop dashboard's nav (which doesn't apply here at all, there's no org
// context), and needs its own visible way to sign out since this
// account can't reach the normal dashboard to log out from there.
export default function PlatformAdminTopBar() {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <div className="bg-slate-900 border-b border-slate-800 px-4 py-2 flex items-center justify-between">
      <span className="text-xs text-slate-500 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-red-400" /> Super Admin Mode
      </span>
      <button
        onClick={handleLogout}
        disabled={loggingOut}
        className="text-xs text-slate-400 hover:text-red-400 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
      >
        <LogOut className="w-3.5 h-3.5" />
        {loggingOut ? 'Logging out...' : 'Log Out'}
      </button>
    </div>
  );
}
