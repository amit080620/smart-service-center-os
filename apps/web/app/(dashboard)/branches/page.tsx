import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import { canManageOrgSettings } from '@smartbizos/permissions';
import BranchesClient from './BranchesClient';

export default async function BranchesPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const canManage = canManageOrgSettings(session.employee.role);
  if (!canManage) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
        <div className="max-w-2xl mx-auto text-center text-slate-500 text-sm mt-12">
          Only the org owner can manage branches.
        </div>
      </div>
    );
  }

  const admin = createSupabaseAdminClient();
  const [{ data: branches }, { data: employees }, { data: jobCounts }] = await Promise.all([
    admin.from('branches').select('*').eq('org_id', session.employee.org_id).is('deleted_at', null).order('created_at'),
    admin.from('employees').select('id, full_name, branch_id').eq('org_id', session.employee.org_id).is('deleted_at', null),
    admin.from('job_cards').select('branch_id').eq('org_id', session.employee.org_id).is('deleted_at', null)
  ]);

  const populated = (branches ?? []).map((b) => ({
    ...b,
    employee_count: (employees ?? []).filter((e) => e.branch_id === b.id).length,
    job_count: (jobCounts ?? []).filter((j) => j.branch_id === b.id).length
  }));

  return <BranchesClient initialBranches={populated} />;
}
