'use client';

import { Plus } from 'lucide-react';

// Thumb-first primary action button — on mobile, sits fixed at
// bottom-right (just above the bottom tab bar), the zone easiest to
// reach with a thumb while holding the phone one-handed. On desktop this
// renders nothing — the equivalent top-right button (already present on
// each page) is perfectly reachable with a mouse, so a floating button
// there would just be visual clutter.
export default function FAB({ onClick, disabled, label = 'Add' }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="md:hidden fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
    >
      <Plus className="w-6 h-6" strokeWidth={2.5} />
    </button>
  );
}
