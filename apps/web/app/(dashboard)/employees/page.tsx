import { redirect } from 'next/navigation';
import { getSessionContext } from '@smartbizos/auth';
import { createSupabaseAdminClient } from '@smartbizos/database/admin';
import EmployeesClient from './EmployeesClient';
import { canManageEmployees, canDeactivateEmployees } from '@smartbizos/permissions';

export default async function EmployeesPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect('/login');
  }

  const admin = createSupabaseAdminClient();
  const [{ data: employees }, { data: branches }] = await Promise.all([
    admin
      .from('employees')
      .select('id, full_name, email, phone, role, status, hire_date, created_at')
      .eq('org_id', session.employee.org_id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
    admin.from('branches').select('id, name').eq('org_id', session.employee.org_id).eq('status', 'active').is('deleted_at', null)
  ]);

  return (
    <EmployeesClient
      initialEmployees={employees ?? []}
      branches={branches ?? []}
      canManage={canManageEmployees(session.employee.role)}
      canDeactivate={canDeactivateEmployees(session.employee.role)}
    />
  );
}
