'use client';

import { useState, useEffect } from 'react';
import { Printer, ArrowLeft, Share2, Info, Bluetooth, Wifi } from 'lucide-react';
import { buildReceiptEscPos, type ReceiptData } from '@/lib/escpos';
import { printViaBluetooth, isBluetoothPrintSupported } from '@/lib/bluetoothPrint';

// Small toolbar shown at the top of the print view.
//
// "Back" navigates to an explicit URL (backHref) rather than using
// router.back()/browser history — these print pages always open in a
// NEW TAB (target="_blank" from the job card / invoice page), so a
// fresh tab has no history to go back to at all.
//
// Four ways to actually get the receipt onto paper, in the order most
// people will want them:
//  - Bluetooth: direct browser-to-printer via Web Bluetooth (Chrome/
//    Android only — Apple blocks this in Safari/iOS entirely).
//  - Network: sends raw ESC/POS to a WiFi/LAN printer's IP (configured
//    once in Settings) via a server-side TCP connection.
//  - Print: the OS's normal print dialog — works for USB/properly-
//    driver-installed printers.
//  - Share as Image: universal fallback — hands a PNG to the phone's
//    Share sheet, so any printer's own app (RawBT etc.) can take it
//    from there, regardless of connection type.
export default function PrintActions({ backHref, receiptData }: { backHref: string; receiptData?: ReceiptData }) {
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [btPrinting, setBtPrinting] = useState(false);
  const [btError, setBtError] = useState<string | null>(null);
  const [netPrinting, setNetPrinting] = useState(false);
  const [netError, setNetError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  // Deliberately starts false and is only set after mount — checking
  // navigator.bluetooth directly during render would evaluate `false`
  // on the server (no `navigator` in SSR) and then again on the very
  // first client render (to match server output for hydration),
  // meaning the button could stay hidden or flicker unreliably instead
  // of showing correctly on browsers that do support it.
  const [bluetoothSupported, setBluetoothSupported] = useState(false);

  useEffect(() => {
    setBluetoothSupported(isBluetoothPrintSupported());
  }, []);

  async function handleBluetoothPrint() {
    if (!receiptData) return;
    setBtPrinting(true);
    setBtError(null);
    try {
      const bytes = buildReceiptEscPos(receiptData);
      await printViaBluetooth(bytes);
    } catch (err) {
      if (err instanceof Error && err.name !== 'NotFoundError') {
        setBtError(err.message);
      }
    }
    setBtPrinting(false);
  }

  async function handleNetworkPrint() {
    if (!receiptData?.printerIp) return;
    setNetPrinting(true);
    setNetError(null);
    try {
      const bytes = Array.from(buildReceiptEscPos(receiptData));
      const res = await fetch('/api/print/network', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ printerIp: receiptData.printerIp, bytes })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? 'Could not reach the printer.');
    } catch (err) {
      setNetError(err instanceof Error ? err.message : 'Could not print.');
    }
    setNetPrinting(false);
  }

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
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'receipt.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
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
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="text-gray-500 hover:text-black cursor-pointer p-1.5"
            title="Printer not working?"
          >
            <Info className="w-4 h-4" />
          </button>

          {receiptData && bluetoothSupported && (
            <button
              onClick={handleBluetoothPrint}
              disabled={btPrinting}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Bluetooth className="w-4 h-4" /> {btPrinting ? 'Connecting...' : 'Bluetooth Print'}
            </button>
          )}

          {receiptData?.printerIp && (
            <button
              onClick={handleNetworkPrint}
              disabled={netPrinting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Wifi className="w-4 h-4" /> {netPrinting ? 'Sending...' : 'Network Print'}
            </button>
          )}

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
      {btError && <div className="px-3 pb-3 text-xs text-red-600">Bluetooth: {btError}</div>}
      {netError && <div className="px-3 pb-3 text-xs text-red-600">Network printer: {netError}</div>}
      {shareError && <div className="px-3 pb-3 text-xs text-red-600">{shareError}</div>}
      {showHelp && (
        <div className="px-3 pb-3 text-xs text-gray-600 max-w-lg space-y-1">
          <div>
            <strong>Bluetooth Print</strong> connects straight to your paired thermal printer — works on Chrome for
            Android, not on iPhone (Apple doesn't allow this in Safari).
          </div>
          <div>
            <strong>Network Print</strong> sends to a WiFi/LAN printer directly — set its IP address once in Settings.
          </div>
          <div>
            <strong>Share as Image</strong> works everywhere — opens your phone's Share menu so you can use RawBT or
            your printer's own app instead.
          </div>
        </div>
      )}
    </div>
  );
}
