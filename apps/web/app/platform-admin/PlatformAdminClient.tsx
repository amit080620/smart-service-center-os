'use client';

import { useState } from 'react';
import { ShieldCheck, Search, Settings2 } from 'lucide-react';

interface OrgRow {
  id: string;
  name: string;
  contact_phone: string;
  created_at: string;
  balance: number;
  status: 'active' | 'low' | 'blocked';
}

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-900/50 text-emerald-300',
  low: 'bg-amber-900/50 text-amber-300',
  blocked: 'bg-red-900/50 text-red-300'
};

export default function PlatformAdminClient({ orgs, adminName }: { orgs: OrgRow[]; adminName: string }) {
  const [search, setSearch] = useState('');
  const filtered = orgs.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()) || o.contact_phone.includes(search));

  const totalBlocked = orgs.filter((o) => o.status === 'blocked').length;
  const totalLow = orgs.filter((o) => o.status === 'low').length;
  const totalOutstanding = orgs.filter((o) => o.balance < 0).reduce((sum, o) => sum + Math.abs(o.balance), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-amber-500" />
              Super Admin
            </h1>
            <p className="text-sm text-slate-500 mt-1">{adminName} · All organizations on the platform.</p>
          </div>
          <a
            href="/platform-admin/settings"
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium px-4 py-2 rounded-xl flex items-center gap-2 cursor-pointer"
          >
            <Settings2 className="w-4 h-4" /> Pricing Settings
          </a>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-xs font-mono text-slate-500 uppercase">Total Orgs</div>
            <div className="text-slate-200 font-bold text-2xl mt-1">{orgs.length}</div>
          </div>
          <div className="bg-amber-950/30 border border-amber-900/50 rounded-2xl p-4">
            <div className="text-xs font-mono text-amber-400 uppercase">Low Balance</div>
            <div className="text-amber-300 font-bold text-2xl mt-1">{totalLow}</div>
          </div>
          <div className="bg-red-950/30 border border-red-900/50 rounded-2xl p-4">
            <div className="text-xs font-mono text-red-400 uppercase">Blocked</div>
            <div className="text-red-300 font-bold text-2xl mt-1">{totalBlocked}</div>
          </div>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by shop name or phone..."
            className="w-full bg-slate-900/80 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 pl-10 pr-3 text-sm outline-none"
          />
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No organizations found.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {filtered.map((o) => (
                <a key={o.id} href={`/platform-admin/orgs/${o.id}`} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-900/40">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-200 truncate">{o.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{o.contact_phone || 'No phone on file'}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`font-mono font-semibold ${o.balance < 0 ? 'text-red-400' : 'text-slate-300'}`}>
                      ₹{o.balance.toLocaleString('en-IN')}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium capitalize ${STATUS_STYLES[o.status]}`}>{o.status}</span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>

        {totalOutstanding > 0 && (
          <div className="text-center text-xs text-slate-500">
            Total outstanding (negative balances) across all orgs: ₹{totalOutstanding.toLocaleString('en-IN')}
          </div>
        )}
      </div>
    </div>
  );
}
