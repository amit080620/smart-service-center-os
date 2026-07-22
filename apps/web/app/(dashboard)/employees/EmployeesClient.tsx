'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Plus, Copy, Check, X } from 'lucide-react';

interface Employee {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  hire_date: string;
}

const ROLE_LABELS: Record<string, string> = {
  org_owner: 'Owner',
  super_admin: 'Super Admin',
  branch_manager: 'Branch Manager',
  hr: 'HR',
  accountant: 'Accountant',
  parts_clerk: 'Parts Clerk',
  technician: 'Technician',
  reception: 'Reception'
};

const ASSIGNABLE_ROLES = ['branch_manager', 'super_admin', 'hr', 'accountant', 'parts_clerk', 'technician', 'reception'];

export default function EmployeesClient({
  initialEmployees,
  canManage,
  canDeactivate
}: {
  initialEmployees: Employee[];
  canManage: boolean;
  canDeactivate: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const employees = initialEmployees;
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [newCredentials, setNewCredentials] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('technician');

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, email, phone, role })
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not add employee.');
      setSubmitting(false);
      return;
    }

    setNewCredentials({ email: data.employee.email, password: data.tempPassword });
    setFullName('');
    setEmail('');
    setPhone('');
    setRole('technician');
    setShowForm(false);
    setSubmitting(false);
    startTransition(() => router.refresh());
  }

  async function handleRoleChange(id: string, newRole: string) {
    setError(null);
    const res = await fetch(`/api/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not update role.');
      return;
    }
    startTransition(() => router.refresh());
  }

  async function handleStatusToggle(id: string, currentStatus: string) {
    setError(null);
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const res = await fetch(`/api/employees/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not update status.');
      return;
    }
    startTransition(() => router.refresh());
  }

  function copyCredentials() {
    if (!newCredentials) return;
    navigator.clipboard.writeText(
      `Login: ${newCredentials.email}\nPassword: ${newCredentials.password}\n\nPlease change your password after first login.`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-amber-500" />
              Employees
            </h1>
            <p className="text-sm text-slate-500 mt-1">Staff accounts and role assignments.</p>
          </div>
          {canManage && (
            <button
              onClick={() => setShowForm(!showForm)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              New Employee
            </button>
          )}
        </div>

        {newCredentials && (
          <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-2xl p-5 animate-fadeIn">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-emerald-300 font-semibold text-sm">Account created — share these details once</h3>
              <button onClick={() => setNewCredentials(null)} className="text-slate-500 hover:text-slate-300 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="font-mono text-sm text-slate-200 space-y-1">
              <div>Login: {newCredentials.email}</div>
              <div>Password: {newCredentials.password}</div>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              This password won't be shown again. Copy it now and share it with the employee directly — they should change it
              after first login.
            </p>
            <button
              onClick={copyCredentials}
              className="mt-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied' : 'Copy Login Details'}
            </button>
          </div>
        )}

        {error && (
          <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{error}</div>
        )}

        {showForm && (
          <form
            onSubmit={handleAdd}
            className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 animate-fadeIn"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Full Name</label>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Email (login)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Phone (optional)</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Employee Account'}
            </button>
          </form>
        )}

        <div className={`bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden transition-opacity ${isPending ? 'opacity-60' : ''}`}>
          {employees.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No employees yet.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {employees.map((emp) => (
                <div key={emp.id} className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-slate-200 truncate flex items-center gap-2">
                      {emp.full_name}
                      {emp.status === 'inactive' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400 shrink-0">Inactive</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {emp.email} {emp.phone && `· ${emp.phone}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canManage && emp.role !== 'org_owner' ? (
                      <select
                        value={emp.role}
                        onChange={(e) => handleRoleChange(emp.id, e.target.value)}
                        className="bg-slate-950 border border-slate-800 rounded-lg py-1.5 px-2 text-xs outline-none"
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded-lg bg-slate-800 text-slate-300">
                        {ROLE_LABELS[emp.role] ?? emp.role}
                      </span>
                    )}
                    {canDeactivate && emp.role !== 'org_owner' && (
                      <button
                        onClick={() => handleStatusToggle(emp.id, emp.status)}
                        className={`text-xs px-3 py-1.5 rounded-lg cursor-pointer font-medium ${
                          emp.status === 'active'
                            ? 'bg-red-950/40 text-red-300 hover:bg-red-950/60'
                            : 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-950/60'
                        }`}
                      >
                        {emp.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
