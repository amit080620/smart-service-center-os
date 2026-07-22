'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Users, Plus, Phone, Mail } from 'lucide-react';

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address: string;
  created_at: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  async function loadCustomers() {
    setLoading(true);
    const res = await fetch('/api/customers');
    if (res.ok) {
      setCustomers(await res.json());
    }
    setLoading(false);
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  async function handleAddCustomer(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ firstName, lastName, phone, email })
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not add customer.');
      setSubmitting(false);
      return;
    }

    setFirstName('');
    setLastName('');
    setPhone('');
    setEmail('');
    setShowForm(false);
    setSubmitting(false);
    loadCustomers();
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
            onClick={() => setShowForm(!showForm)}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            New Customer
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={handleAddCustomer}
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
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Customer'}
            </button>
          </form>
        )}

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm font-mono">Loading...</div>
          ) : customers.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No customers yet — add your first one above.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {customers.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between hover:bg-slate-900/40 transition-all">
                  <div>
                    <div className="font-semibold text-slate-200">
                      {c.first_name} {c.last_name}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 font-mono">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {c.phone}
                      </span>
                      {c.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {c.email}
                        </span>
                      )}
                    </div>
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