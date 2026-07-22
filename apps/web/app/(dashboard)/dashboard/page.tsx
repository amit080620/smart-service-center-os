import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';

// Deliberately minimal — this page exists right now to PROVE the full auth
// chain works end to end (signup/login -> session cookie -> server-side
// verification -> employee/org/branch lookup), not to be the real
// dashboard. That gets built module by module from here.
export default async function DashboardPage() {
  const session = await getSessionContext();

  if (!session) {
    redirect('/login');
  }

  const { employee, org, branch } = session;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-2xl mx-auto bg-slate-900/80 border border-slate-800 rounded-2xl p-8 space-y-4">
        <div className="inline-block bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full px-3 py-1 text-xs font-mono uppercase">
          Auth chain verified
        </div>
        <h1 className="text-2xl font-display font-bold">Welcome back, {employee.full_name}</h1>
        <div className="grid grid-cols-2 gap-4 pt-4 text-sm">
          <div>
            <div className="text-xs font-mono text-slate-500 uppercase">Organization</div>
            <div className="text-slate-200">{org.name}</div>
          </div>
          <div>
            <div className="text-xs font-mono text-slate-500 uppercase">Branch</div>
            <div className="text-slate-200">{branch.name}</div>
          </div>
          <div>
            <div className="text-xs font-mono text-slate-500 uppercase">Role</div>
            <div className="text-slate-200">{employee.role.replace('_', ' ')}</div>
          </div>
          <div>
            <div className="text-xs font-mono text-slate-500 uppercase">Plan</div>
            <div className="text-slate-200">{org.plan}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
