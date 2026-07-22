'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Car, Plus, Gauge } from 'lucide-react';

interface Vehicle {
  id: string;
  customer_id: string;
  plate_number: string;
  make: string;
  model: string;
  year: number;
  color: string;
  odometer_km: number;
}

interface Customer {
  id: string;
  first_name: string;
  last_name: string;
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [color, setColor] = useState('');

  async function loadData() {
    setLoading(true);
    const [vehiclesRes, customersRes] = await Promise.all([fetch('/api/vehicles'), fetch('/api/customers')]);
    if (vehiclesRes.ok) setVehicles(await vehiclesRes.json());
    if (customersRes.ok) setCustomers(await customersRes.json());
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  function customerName(id: string): string {
    const c = customers.find((c) => c.id === id);
    return c ? `${c.first_name} ${c.last_name}`.trim() : 'Unknown';
  }

  async function handleAddVehicle(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        plateNumber,
        make,
        model,
        year: year ? Number(year) : undefined,
        color
      })
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not add vehicle.');
      setSubmitting(false);
      return;
    }

    setCustomerId('');
    setPlateNumber('');
    setMake('');
    setModel('');
    setColor('');
    setShowForm(false);
    setSubmitting(false);
    loadData();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <Car className="w-6 h-6 text-amber-500" />
              Vehicles
            </h1>
            <p className="text-sm text-slate-500 mt-1">Vehicle records linked to your customers.</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            disabled={customers.length === 0 && !loading}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            New Vehicle
          </button>
        </div>

        {!loading && customers.length === 0 && (
          <div className="bg-amber-950/30 border border-amber-900/50 text-amber-200 text-sm rounded-xl p-4">
            You need at least one customer before adding a vehicle — go to{' '}
            <a href="/customers" className="underline font-semibold">
              Clients
            </a>{' '}
            first.
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleAddVehicle}
            className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 animate-fadeIn"
          >
            {error && (
              <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{error}</div>
            )}
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Customer</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                required
                disabled={submitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              >
                <option value="">Select a customer...</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.first_name} {c.last_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Plate Number</label>
                <input
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="MH12AB1234"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Color</label>
                <input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={submitting}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Make</label>
                <input
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="Maruti Suzuki"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Model</label>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  required
                  disabled={submitting}
                  placeholder="Swift"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Year</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
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
              {submitting ? 'Saving...' : 'Save Vehicle'}
            </button>
          </form>
        )}

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-slate-500 text-sm font-mono">Loading...</div>
          ) : vehicles.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No vehicles yet — add your first one above.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {vehicles.map((v) => (
                <div key={v.id} className="p-4 flex items-center justify-between hover:bg-slate-900/40 transition-all">
                  <div>
                    <div className="font-semibold text-slate-200">
                      {v.make} {v.model} <span className="text-slate-500 font-normal">({v.year})</span>
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-slate-500 font-mono">
                      <span className="text-amber-500 font-semibold">{v.plate_number}</span>
                      <span>{customerName(v.customer_id)}</span>
                      {v.color && <span>{v.color}</span>}
                      <span className="flex items-center gap-1">
                        <Gauge className="w-3 h-3" /> {v.odometer_km.toLocaleString()} km
                      </span>
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