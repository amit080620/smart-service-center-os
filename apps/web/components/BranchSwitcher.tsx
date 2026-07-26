'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';

// Only ever shows up once an org has a second branch — for the (very
// common, especially early on) single-branch case this renders
// nothing at all, no empty dropdown cluttering the nav for something
// that doesn't apply yet.
export default function BranchSwitcher() {
  const router = useRouter();
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [activeBranchId, setActiveBranchId] = useState('');
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/branches/active');
        if (!res.ok) return;
        const data = await res.json();
        setBranches(data.branches ?? []);
        setActiveBranchId(data.activeBranchId ?? '');
      } catch {
        // Silent — branch switcher just won't show if this fails.
      }
    }
    load();
  }, []);

  async function handleSwitch(branchId: string) {
    setSwitching(true);
    const res = await fetch('/api/branch-switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ branchId })
    });
    if (res.ok) {
      setActiveBranchId(branchId);
      router.refresh();
    }
    setSwitching(false);
  }

  if (branches.length < 2) return null;

  return (
    <div className="flex items-center gap-1.5 px-3">
      <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      <select
        value={activeBranchId}
        onChange={(e) => handleSwitch(e.target.value)}
        disabled={switching}
        className="bg-slate-900 border border-slate-800 rounded-lg py-1 px-2 text-xs text-slate-300 outline-none disabled:opacity-50"
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}
