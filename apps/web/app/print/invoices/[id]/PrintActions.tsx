'use client';

import { useEffect, useState } from 'react';
import { Printer, ArrowLeft, Share2, Info, Bluetooth, Settings } from 'lucide-react';
import { buildInvoiceReceipt, type ReceiptData } from '../../../../lib/print/escpos';
import { isWebBluetoothSupported, printOverBluetooth } from '../../../../lib/print/bluetooth';

// NOTE: a "WiFi/LAN Printer" button (server -> printer over TCP 9100)
// was deliberately left OUT of this UI. This app is deployed on
// Vercel/cloud, and a cloud server has no route to a printer's private
// IP behind a shop's router — that button would fail every single
// time. The transport code still exists at lib/print/network.ts +
// app/api/print/network/route.ts for later, IF a local "print bridge"
// agent is ever built to run on a PC at each shop (see chat) — but it
// should stay unwired from the UI until that exists, so nobody at a
// shop counter sees a button that can never work.

const SETTINGS_KEY = 'thermalPrinterSettings';

interface PrinterSettings {
  charsPerLine: 32 | 48;
}

function loadSettings(): PrinterSettings {
  if (typeof window === 'undefined') return { charsPerLine: 32 };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) return { charsPerLine: 32, ...JSON.parse(raw) };
  } catch {
    // ignore corrupted settings, fall back to defaults
  }
  return { charsPerLine: 32 };
}

// Small toolbar shown at the top of the print view.
//
// "Back" navigates to an explicit URL (backHref) rather than using
// router.back()/browser history — these print pages always open in a
// NEW TAB (target="_blank" from the job card / invoice page), so a
// fresh tab has no history to go back to at all, which made the old
// history-based back button silently do nothing.
//
// Three ways to actually get the bill onto paper, in order of how
// directly they talk to the printer:
//
// "Bluetooth Printer" — connects directly from the browser to a BLE
// thermal printer using the Web Bluetooth API and writes raw ESC/POS
// bytes, no RawBT needed. Android + Chrome/Edge only — iOS Safari has
// no Web Bluetooth support at all (Apple's restriction, not fixable
// here). Printer must use one of a handful of common BLE profiles;
// many cheap clones do, some don't.
//
// "Print" triggers the browser's native print dialog — works fine for
// a properly-installed printer (USB, network/LAN, or a Bluetooth
// printer with a real OS print driver). It does NOT work for most
// cheap Bluetooth thermal printers, which have no OS print driver at
// all and only accept raw ESC/POS commands — a browser limitation.
//
// "Share as Image" is the universal fallback: converts the receipt to
// a PNG and opens the OS share sheet, so the person can hand it to
// WHATEVER app actually talks to their printer (RawBT, the printer's
// own app, etc). Works regardless of connection type or printer model,
// which the two direct options above can't fully guarantee.
export default function PrintActions({ backHref, receipt }: { backHref: string; receipt?: ReceiptData }) {
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<PrinterSettings>({ charsPerLine: 32 });
  const [btBusy, setBtBusy] = useState(false);
  const [btStatus, setBtStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [btSupported, setBtSupported] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setBtSupported(isWebBluetoothSupported());
  }, []);

  function saveSettings(next: PrinterSettings) {
    setSettings(next);
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
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

  async function handleBluetoothPrint() {
    if (!receipt) return;
    setBtBusy(true);
    setBtStatus(null);
    const bytes = buildInvoiceReceipt(receipt, settings.charsPerLine);
    const result = await printOverBluetooth(bytes);
    if (result.ok) {
      setBtStatus({ ok: true, message: result.deviceName ? `Printed via ${result.deviceName}.` : 'Printed.' });
    } else if (result.error) {
      setBtStatus({ ok: false, message: result.error });
    }
    setBtBusy(false);
  }

  return (
    <div className="print:hidden sticky top-0 bg-gray-100 border-b border-gray-300 z-10">
      <div className="p-3 flex items-center justify-between flex-wrap gap-2">
        <a href={backHref} className="flex items-center gap-2 text-sm text-gray-700 hover:text-black cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Back
        </a>
        <div className="flex items-center gap-2 flex-wrap">
          {receipt && (
            <>
              {btSupported && (
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-gray-500 hover:text-black cursor-pointer p-1.5"
                  title="Paper width setting"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
              {btSupported && (
                <button
                  onClick={handleBluetoothPrint}
                  disabled={btBusy}
                  className="bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Bluetooth className="w-4 h-4" /> {btBusy ? 'Connecting...' : 'Bluetooth Printer'}
                </button>
              )}
            </>
          )}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="text-gray-500 hover:text-black cursor-pointer p-1.5"
            title="Printer not working?"
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

      {showSettings && receipt && (
        <div className="px-3 pb-3 flex flex-wrap items-end gap-3 text-xs text-gray-700">
          <label className="flex flex-col gap-1">
            Paper width
            <select
              value={settings.charsPerLine}
              onChange={(e) => saveSettings({ ...settings, charsPerLine: Number(e.target.value) as 32 | 48 })}
              className="border border-gray-300 rounded px-2 py-1"
            >
              <option value={32}>58mm (32 chars)</option>
              <option value={48}>80mm (48 chars)</option>
            </select>
          </label>
          <span className="text-gray-500 pb-1">Saved on this device only.</span>
        </div>
      )}

      {btStatus && (
        <div className={`px-3 pb-2 text-xs ${btStatus.ok ? 'text-emerald-700' : 'text-red-600'}`}>{btStatus.message}</div>
      )}
      {shareError && <div className="px-3 pb-3 text-xs text-red-600">{shareError}</div>}

      {showHelp && (
        <div className="px-3 pb-3 text-xs text-gray-600 max-w-lg space-y-1">
          <div>
            <strong>Bluetooth Printer</strong> connects straight from the browser to the printer. Android + Chrome
            only; not available on iPhone (Apple restriction). Some printer models use a Bluetooth profile this
            can&apos;t detect.
          </div>
          <div>
            If either fails, <strong>&quot;Share as Image&quot;</strong> is the most reliable fallback: it opens your
            phone&apos;s Share menu so you can pick your printer&apos;s app (e.g. <strong>RawBT</strong>) or any other
            app that talks to your specific printer.
          </div>
        </div>
      )}
    </div>
  );
}
