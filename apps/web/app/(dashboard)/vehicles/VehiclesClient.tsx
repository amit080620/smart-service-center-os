'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Car, Plus, Gauge, Search, Hash } from 'lucide-react';
import FAB from '@/components/FAB';
import BrandModelPicker from '@/components/BrandModelPicker';

interface Vehicle {
  id: string;
  customer_id: string;
  plate_number: string;
  vin: string;
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

export default function VehiclesClient({
  initialVehicles,
  initialCustomers,
  isLimited
}: {
  initialVehicles: Vehicle[];
  initialCustomers: Customer[];
  isLimited?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const vehicles = initialVehicles;
  const [searchQuery, setSearchQuery] = useState('');
  const filteredVehicles = vehicles.filter((v) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      v.plate_number.toLowerCase().includes(q) ||
      `${v.make} ${v.model}`.toLowerCase().includes(q) ||
      (v.vin ?? '').toLowerCase().includes(q) ||
      customerName(v.customer_id).toLowerCase().includes(q)
    );
  });
  const customers = initialCustomers;
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vin, setVin] = useState('');
  const [vehicleType, setVehicleType] = useState<'car' | 'bike'>('car');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [color, setColor] = useState('');

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
        vin,
        make,
        model,
        vehicleType,
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
    setVin('');
    setMake('');
    setModel('');
    setColor('');
    setShowForm(false);
    setSubmitting(false);
    startTransition(() => router.refresh());
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
            disabled={customers.length === 0}
            className="hidden md:flex bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl items-center gap-2 cursor-pointer transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            New Vehicle
          </button>
        </div>
        <FAB onClick={() => setShowForm(!showForm)} disabled={customers.length === 0} label="New Vehicle" />

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by plate number, make/model, chassis no, or owner..."
            className="w-full bg-slate-900/80 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none"
          />
        </div>
        {isLimited && (
          <p className="text-xs text-slate-500 -mt-2">Showing the most recent 1000 vehicles.</p>
        )}

        {customers.length === 0 && (
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

            <BrandModelPicker
              vehicleType={vehicleType}
              onVehicleTypeChange={setVehicleType}
              make={make}
              onMakeChange={setMake}
              model={model}
              onModelChange={setModel}
              disabled={submitting}
            />

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
                <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase flex items-center gap-1">
                  <Hash className="w-3 h-3" /> Chassis Number (optional)
                </label>
                <input
                  value={vin}
                  onChange={(e) => setVin(e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. MA3ERLF1S00123456"
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
              disabled={submitting || !make || !model}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Vehicle'}
            </button>
          </form>
        )}

        <div className={`bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden transition-opacity ${isPending ? 'opacity-60' : ''}`}>
          {vehicles.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No vehicles yet — add your first one above.</div>
          ) : filteredVehicles.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No vehicles match "{searchQuery}".</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {filteredVehicles.map((v) => (
                <a key={v.id} href={`/vehicles/${v.id}`} className="p-4 block hover:bg-slate-900/40 transition-all">
                  <div className="font-semibold text-slate-200 truncate">
                    {v.make} {v.model} <span className="text-slate-500 font-normal">({v.year})</span>
                  </div>
                  <div className="flex items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-500 font-mono flex-wrap">
                    <span className="text-amber-500 font-semibold">{v.plate_number}</span>
                    <span className="truncate">{customerName(v.customer_id)}</span>
                    {v.vin && <span className="truncate">Chassis: {v.vin}</span>}
                    {v.color && <span>{v.color}</span>}
                    <span className="flex items-center gap-1">
                      <Gauge className="w-3 h-3" /> {v.odometer_km.toLocaleString()} km
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
