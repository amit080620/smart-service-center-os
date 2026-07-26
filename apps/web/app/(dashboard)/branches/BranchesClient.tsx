'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Plus, Pencil, Users, ClipboardList, Ban, RotateCcw } from 'lucide-react';
import FAB from '@/components/FAB';

interface Branch {
  id: string;
  name: string;
  address: string;
  phone: string;
  status: string;
  employee_count: number;
  job_count: number;
}

export default function BranchesClient({ initialBranches }: { initialBranches: Branch[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');

  function resetForm() {
    setName('');
    setAddress('');
    setPhone('');
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  function startEdit(b: Branch) {
    setEditingId(b.id);
    setName(b.name);
    setAddress(b.address);
    setPhone(b.phone);
    setShowForm(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const body = { name, address, phone };
    const res = editingId
      ? await fetch(`/api/branches/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      : await fetch('/api/branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not save branch.');
      setSubmitting(false);
      return;
    }

    resetForm();
    setSubmitting(false);
    startTransition(() => router.refresh());
  }

  async function handleToggleStatus(b: Branch) {
    setError(null);
    const res = await fetch(`/api/branches/${b.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: b.status === 'active' ? 'inactive' : 'active' })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not update branch.');
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Building2 className="w-6 h-6 text-amber-500" />
              Branches
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage every location under this organization. Employees, job cards, and inventory each belong to one branch.
            </p>
          </div>
          <button
            onClick={() => (showForm ? resetForm() : (resetForm(), setShowForm(true)))}
            className="hidden md:flex bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl items-center gap-2 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            New Branch
          </button>
        </div>
        <FAB onClick={() => (showForm ? resetForm() : (resetForm(), setShowForm(true)))} label="New Branch" />

        {error && <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{error}</div>}

        {showForm && (
          <form onSubmit={handleSubmit} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 animate-fadeIn">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Branch Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="e.g. Andheri Branch"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Address</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Save Branch'}
              </button>
              <button type="button" onClick={resetForm} className="text-slate-500 hover:text-slate-300 px-4 py-2.5 text-sm cursor-pointer">
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className={`bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden transition-opacity ${isPending ? 'opacity-60' : ''}`}>
          {initialBranches.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No branches yet — your original location was created automatically at signup.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {initialBranches.map((b) => (
                <div key={b.id} className={`p-4 flex items-center justify-between gap-3 ${b.status === 'inactive' ? 'opacity-50' : ''}`}>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-200 truncate flex items-center gap-2">
                      {b.name}
                      {b.status === 'inactive' && <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">Inactive</span>}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5 truncate">
                      {b.address || 'No address on file'} {b.phone && `· ${b.phone}`}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {b.employee_count} staff
                      </span>
                      <span className="flex items-center gap-1">
                        <ClipboardList className="w-3 h-3" /> {b.job_count} jobs
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => startEdit(b)} className="text-slate-500 hover:text-amber-400 cursor-pointer p-1" title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(b)}
                      className="text-slate-500 hover:text-red-400 cursor-pointer p-1"
                      title={b.status === 'active' ? 'Deactivate' : 'Reactivate'}
                    >
                      {b.status === 'active' ? <Ban className="w-3.5 h-3.5" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    </button>
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
