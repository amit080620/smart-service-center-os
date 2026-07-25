'use client';

import { ShieldAlert } from 'lucide-react';
import { createSupabaseBrowserClient } from '@smartbizos/database';
import { useState } from 'react';

// Shown instead of a silent redirect when someone is logged in, but NOT
// as the platform Super Admin — e.g. opening the "SC Admin" home-screen
// shortcut while already signed in as a shop owner on the same device.
// A plain redirect('/login') here would just bounce back to /dashboard
// via the middleware's "already authenticated" rule, for whichever
// account IS logged in — so this signs the current account OUT first
// (a real action, not just a link) before sending them to /login, where
// the middleware will correctly show the login form since no session
// exists anymore.
export default function PlatformAdminAccessDenied() {
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogoutAndGoToLogin() {
    setLoggingOut(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 flex items-center justify-center">
      <div className="max-w-sm text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-950/50 border border-red-900 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-7 h-7 text-red-400" />
        </div>
        <h1 className="text-lg font-bold text-slate-100">Wrong Account</h1>
        <p className="text-sm text-slate-400">
          You're signed in, but not with the Super Admin account. Log out of this account, then sign back in with the
          Super Admin email to access this page.
        </p>
        <button
          onClick={handleLogoutAndGoToLogin}
          disabled={loggingOut}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl text-sm cursor-pointer disabled:opacity-50"
        >
          {loggingOut ? 'Logging out...' : 'Log Out & Go to Login'}
        </button>
      </div>
    </div>
  );
}
