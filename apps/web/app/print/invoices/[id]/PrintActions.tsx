'use client';

import { Printer, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Small toolbar shown at the top of the print view — triggers the
// browser's print dialog. Hidden automatically during actual printing
// via the print:hidden utility.
export default function PrintActions() {
  const router = useRouter();
  return (
    <div className="print:hidden sticky top-0 bg-gray-100 border-b border-gray-300 p-3 flex items-center justify-between">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-gray-700 hover:text-black cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <button
        onClick={() => window.print()}
        className="bg-black text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
      >
        <Printer className="w-4 h-4" /> Print
      </button>
    </div>
  );
}
