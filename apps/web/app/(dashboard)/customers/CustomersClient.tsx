'use client';

import { useState, useTransition, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, Phone, Mail, Search, Pencil, Ban, Download, Upload } from 'lucide-react';
import FAB from '@/components/FAB';

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address: string;
  date_of_birth: string | null;
  anniversary_date: string | null;
}

export default function CustomersClient({
  initialCustomers,
  isLimited
}: {
  initialCustomers: Customer[];
  isLimited?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [anniversaryDate, setAnniversaryDate] = useState('');

  const filteredCustomers = initialCustomers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      (c.email ?? '').toLowerCase().includes(q)
    );
  });

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/customers/import', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not import CSV.');
      setImporting(false);
      return;
    }

    setImportResult(data);
    setImporting(false);
    if (importInputRef.current) importInputRef.current.value = '';
    startTransition(() => router.refresh());
  }

  function resetForm() {
    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setDateOfBirth('');
    setAnniversaryDate('');
    setShowForm(false);
    setEditingId(null);
    setError(null);
  }

  function startEdit(c: Customer) {
    setEditingId(c.id);
    setFirstName(c.first_name);
    setLastName(c.last_name);
    setPhone(c.phone);
    setEmail(c.email ?? '');
    setAddress(c.address ?? '');
    setDateOfBirth(c.date_of_birth ?? '');
    setAnniversaryDate(c.anniversary_date ?? '');
    setShowForm(true);
  }

  async function handleDeactivate(c: Customer) {
    if (!confirm(`Deactivate ${c.first_name} ${c.last_name}? They'll be hidden from lists, but past records stay intact.`)) return;
    setError(null);
    const res = await fetch(`/api/customers/${c.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not deactivate customer.');
      return;
    }
    startTransition(() => router.refresh());
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const body = { firstName, lastName, phone, email, address, dateOfBirth, anniversaryDate };
    const res = editingId
      ? await fetch(`/api/customers/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
      : await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not save customer.');
      setSubmitting(false);
      return;
    }

    resetForm();
    setSubmitting(false);
    startTransition(() => router.refresh());
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Users className="w-6 h-6 text-amber-500" />
              Clients
            </h1>
            <p className="text-sm text-slate-500 mt-1">Customer records for your service center.</p>
          </div>
          <button
            onClick={() => (showForm ? resetForm() : (resetForm(), setShowForm(true)))}
            className="hidden md:flex bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl items-center gap-2 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            New Customer
          </button>
        </div>
        <FAB onClick={() => (showForm ? resetForm() : (resetForm(), setShowForm(true)))} label="New Customer" />
        <div className="flex gap-2 flex-wrap items-center">
          <a
            href="/api/customers/export"
            className="text-xs bg-slate-900/80 border border-slate-800 text-slate-300 px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer hover:bg-slate-800"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </a>
          <input ref={importInputRef} type="file" accept=".csv" onChange={handleImportFile} className="hidden" />
          <button
            onClick={() => importInputRef.current?.click()}
            disabled={importing}
            className="text-xs bg-slate-900/80 border border-slate-800 text-slate-300 px-3 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer hover:bg-slate-800 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" /> {importing ? 'Importing...' : 'Import CSV'}
          </button>
        </div>

        {importResult && (
          <div className="bg-emerald-950/30 border border-emerald-900/50 text-emerald-200 text-xs rounded-xl p-3">
            Imported {importResult.created} new customer{importResult.created === 1 ? '' : 's'}
            {importResult.skipped > 0 && ` · skipped ${importResult.skipped} (duplicate phone or missing name/phone)`}
            {importResult.errors.length > 0 && <div className="mt-1 text-red-300">{importResult.errors.join('; ')}</div>}
          </div>
        )}

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, or email..."
            className="w-full bg-slate-900/80 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none"
          />
        </div>
        {isLimited && (
          <p className="text-xs text-slate-500 -mt-2">Showing the most recent 1000 customers.</p>
        )}

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 animate-fadeIn"
          >
            {error && (
              <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{error}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">First Name</label>
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Last Name</label>
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="+91 98200 11223"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Email (optional)</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Address (optional)</label>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={submitting}
                  placeholder="House/Flat, Street, Area, City"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Date of Birth (optional)</label>
                <input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Anniversary (optional)</label>
                <input
                  type="date"
                  value={anniversaryDate}
                  onChange={(e) => setAnniversaryDate(e.target.value)}
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
                {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Save Customer'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="text-slate-500 hover:text-slate-300 px-4 py-2.5 text-sm cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className={`bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden transition-opacity ${isPending ? 'opacity-60' : ''}`}>
          {initialCustomers.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No customers yet — add your first one above.</div>
          ) : filteredCustomers.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No customers match "{searchQuery}".</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {filteredCustomers.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-900/40 transition-all">
                  <a href={`/customers/${c.id}`} className="min-w-0 flex-1 cursor-pointer">
                    <div className="font-semibold text-slate-200 truncate hover:text-amber-400">
                      {c.first_name} {c.last_name}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 font-mono flex-wrap">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {c.phone}
                      </span>
                      {c.email && (
                        <span className="flex items-center gap-1 min-w-0">
                          <Mail className="w-3 h-3 shrink-0" /> <span className="truncate">{c.email}</span>
                        </span>
                      )}
                    </div>
                  </a>
                  <button onClick={() => startEdit(c)} className="text-slate-500 hover:text-amber-400 cursor-pointer p-1 shrink-0" title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeactivate(c)} className="text-slate-500 hover:text-red-400 cursor-pointer p-1 shrink-0" title="Deactivate">
                    <Ban className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
