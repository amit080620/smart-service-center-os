'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Settings2 } from 'lucide-react';

interface SettingsData {
  bikeJobPrice: number;
  carJobPrice: number;
  lowBalanceThreshold: number;
  blockThreshold: number;
  supportPhone: string;
}

export default function SettingsClient({ initial }: { initial: SettingsData }) {
  const router = useRouter();
  const [bikeJobPrice, setBikeJobPrice] = useState(String(initial.bikeJobPrice));
  const [carJobPrice, setCarJobPrice] = useState(String(initial.carJobPrice));
  const [lowBalanceThreshold, setLowBalanceThreshold] = useState(String(initial.lowBalanceThreshold));
  const [blockThreshold, setBlockThreshold] = useState(String(initial.blockThreshold));
  const [supportPhone, setSupportPhone] = useState(initial.supportPhone);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

    const res = await fetch('/api/platform-admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bikeJobPrice: Number(bikeJobPrice),
        carJobPrice: Number(carJobPrice),
        lowBalanceThreshold: Number(lowBalanceThreshold),
        blockThreshold: Number(blockThreshold),
        supportPhone
      })
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not save settings.');
      setSubmitting(false);
      return;
    }

    setSuccess(true);
    setSubmitting(false);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <a href="/platform-admin" className="text-sm text-slate-500 hover:text-slate-300 flex items-center gap-1.5 cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Super Admin
        </a>

        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-amber-500" />
            Platform Pricing
          </h1>
          <p className="text-sm text-slate-500 mt-1">Controls what every org on the platform is charged, wallet-wide.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
          {error && <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{error}</div>}
          {success && <div className="bg-emerald-950/40 border border-emerald-900 text-emerald-200 text-xs rounded-xl p-3">Settings saved.</div>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Bike Job Price (₹)</label>
              <input
                type="number"
                value={bikeJobPrice}
                onChange={(e) => setBikeJobPrice(e.target.value)}
                min="0"
                disabled={submitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Car Job Price (₹)</label>
              <input
                type="number"
                value={carJobPrice}
                onChange={(e) => setCarJobPrice(e.target.value)}
                min="0"
                disabled={submitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Low-Balance Warning At (₹)</label>
              <input
                type="number"
                value={lowBalanceThreshold}
                onChange={(e) => setLowBalanceThreshold(e.target.value)}
                disabled={submitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              />
              <p className="text-xs text-slate-500 mt-1">Shop sees an in-app warning banner once balance drops to this.</p>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Block New Jobs At (₹)</label>
              <input
                type="number"
                value={blockThreshold}
                onChange={(e) => setBlockThreshold(e.target.value)}
                disabled={submitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              />
              <p className="text-xs text-slate-500 mt-1">Negative — e.g. -50 means blocked once balance hits ₹-50.</p>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Your Support Phone (shown to shops)</label>
              <input
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                placeholder="+91 98XXXXXXXX"
                disabled={submitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2.5 rounded-xl text-sm cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}
