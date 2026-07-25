'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Ban } from 'lucide-react';
import BrandModelPicker from '@/components/BrandModelPicker';
import { CAR_BRANDS, BIKE_BRANDS } from '@/lib/vehicleData';

interface VehicleEditData {
  id: string;
  plate_number: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  color: string;
}

export default function VehicleEditPanel({ vehicle }: { vehicle: VehicleEditData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Infer whether this vehicle's make belongs to the car or bike list, so
  // the picker opens on the right tab instead of always defaulting to car.
  const initialType: 'car' | 'bike' = BIKE_BRANDS.some((b) => b.make === vehicle.make) ? 'bike' : 'car';

  const [plateNumber, setPlateNumber] = useState(vehicle.plate_number);
  const [vin, setVin] = useState(vehicle.vin);
  const [vehicleType, setVehicleType] = useState<'car' | 'bike'>(initialType);
  const [make, setMake] = useState(vehicle.make);
  const [model, setModel] = useState(vehicle.model);
  const [year, setYear] = useState(String(vehicle.year));
  const [color, setColor] = useState(vehicle.color);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/vehicles/${vehicle.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plateNumber, vin, make, model, year: Number(year), color })
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not update vehicle.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setEditing(false);
    router.refresh();
  }

  async function handleDeactivate() {
    if (!confirm('Deactivate this vehicle? It will be hidden from lists, but job history stays intact.')) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/vehicles/${vehicle.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error?.message ?? 'Could not deactivate vehicle.');
      setSubmitting(false);
      return;
    }
    router.push('/vehicles');
  }

  if (!editing) {
    return (
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setEditing(true)}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer"
        >
          <Pencil className="w-4 h-4" /> Edit Vehicle Details
        </button>
        <button
          onClick={handleDeactivate}
          disabled={submitting}
          className="bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-300 text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Ban className="w-4 h-4" /> Deactivate
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 animate-fadeIn">
      {error && <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{error}</div>}

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
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Chassis Number</label>
          <input
            value={vin}
            onChange={(e) => setVin(e.target.value)}
            disabled={submitting}
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

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2.5 rounded-xl text-sm cursor-pointer disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-slate-500 hover:text-slate-300 px-4 py-2.5 text-sm cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
