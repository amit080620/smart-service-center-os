'use client';

import { useState } from 'react';
import { Printer, ArrowLeft, Share2, Info } from 'lucide-react';

// Small toolbar shown at the top of the print view.
//
// "Back" navigates to an explicit URL (backHref) rather than using
// router.back()/browser history — these print pages always open in a
// NEW TAB (target="_blank" from the job card / invoice page), so a
// fresh tab has no history to go back to at all, which made the old
// history-based back button silently do nothing.
//
// "Print" triggers the browser's native print dialog — works fine for
// a properly-installed printer (USB, network/LAN, or a Bluetooth
// printer with a real OS print driver). It does NOT work for most
// cheap Bluetooth thermal printers, which have no OS print driver at
// all and only accept raw ESC/POS commands through a dedicated app —
// a fundamental browser limitation, not something fixable in this code.
//
// "Share as Image" is the actual fix for that: converts the receipt to
// a PNG and opens the OS share sheet, so the person can hand it to
// WHATEVER app actually talks to their printer — RawBT (the standard
// Android app for exactly this), the printer manufacturer's own app,
// Bluetooth file transfer, WhatsApp, Google Drive, anything. This
// works identically regardless of the printer's connection type
// (Bluetooth/WiFi/LAN/USB) since the OS share sheet, not this code,
// is what talks to the printing app.
export default function PrintActions({ backHref }: { backHref: string }) {
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  async function handleShareAsImage() {
    setSharing(true);
    setShareError(null);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const node = document.getElementById('print-content');
      if (!node) throw new Error('Could not find the content to share.');

      const canvas = await html2canvas(node, { backgroundColor: '#ffffff', scale: 2 });
      const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('Could not generate the image.');

      const file = new File([blob], 'receipt.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Receipt' });
      } else {
        // Desktop / unsupported browsers — fall back to a plain
        // download so the image is still usable (e.g. attach it
        // manually to a printer app or WhatsApp Web).
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'receipt.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // AbortError just means the person closed the share sheet without
      // picking anything — not a real error, don't show it as one.
      if (err instanceof Error && err.name !== 'AbortError') {
        setShareError(err.message);
      }
    }
    setSharing(false);
  }

  return (
    <div className="print:hidden sticky top-0 bg-gray-100 border-b border-gray-300 z-10">
      <div className="p-3 flex items-center justify-between flex-wrap gap-2">
        <a href={backHref} className="flex items-center gap-2 text-sm text-gray-700 hover:text-black cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back
        </a>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="text-gray-500 hover:text-black cursor-pointer p-1.5"
            title="Bluetooth printer not working?"
          >
            <Info className="w-4 h-4" />
          </button>
          <button
            onClick={handleShareAsImage}
            disabled={sharing}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Share2 className="w-4 h-4" /> {sharing ? 'Preparing...' : 'Share as Image'}
          </button>
          <button
            onClick={() => window.print()}
            className="bg-black text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print
          </button>
        </div>
      </div>
      {shareError && <div className="px-3 pb-3 text-xs text-red-600">{shareError}</div>}
      {showHelp && (
        <div className="px-3 pb-3 text-xs text-gray-600 max-w-lg">
          <strong>Bluetooth thermal printer not printing directly?</strong> Most Bluetooth receipt printers can't be
          reached through the regular Print button — it's a phone/browser limitation, not this app. Use{' '}
          <strong>"Share as Image"</strong> instead: it opens your phone's normal Share menu, where you can pick your
          printer's app (e.g. <strong>RawBT</strong> — the most common Android app for this) or any other app that
          talks to your specific printer, whether it connects by Bluetooth, WiFi, LAN, or USB.
        </div>
      )}
    </div>
  );
}
