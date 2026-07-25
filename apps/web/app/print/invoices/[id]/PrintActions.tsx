'use client';

import { Printer, ArrowLeft } from 'lucide-react';

// Small toolbar shown at the top of the print view — triggers the
// browser's print dialog. Hidden automatically during actual printing
// via the print:hidden utility.
//
// "Back" navigates to an explicit URL (backHref) rather than using
// router.back()/browser history — these print pages always open in a
// NEW TAB (target="_blank" from the job card / invoice page), so a
// fresh tab has no history to go back to at all, which made the old
// history-based back button silently do nothing.
export default function PrintActions({ backHref }: { backHref: string }) {
  return (
    <div className="print:hidden sticky top-0 bg-gray-100 border-b border-gray-300 p-3 flex items-center justify-between">
      <a href={backHref} className="flex items-center gap-2 text-sm text-gray-700 hover:text-black cursor-pointer">
        <ArrowLeft className="w-4 h-4" /> Back
      </a>
      <button
        onClick={() => window.print()}
        className="bg-black text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
      >
        <Printer className="w-4 h-4" /> Print
      </button>
    </div>
  );
}
