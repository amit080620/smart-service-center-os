'use client';

import { useEffect, useState } from 'react';
import {
  Printer,
  ArrowLeft,
  Share2,
  Info,
  Bluetooth,
  Settings,
} from 'lucide-react';

import {
  buildInvoiceReceipt,
  type ReceiptData,
} from '../../../../lib/print/escpos';

import {
  isWebBluetoothSupported,
  printOverBluetooth,
} from '../../../../lib/print/bluetooth';

// -----------------------------------------------------------------------------
// Thermal printer settings
// -----------------------------------------------------------------------------

const SETTINGS_KEY = 'thermalPrinterSettings';

interface PrinterSettings {
  charsPerLine: 32 | 48;
}

function loadSettings(): PrinterSettings {
  if (typeof window === 'undefined') {
    return { charsPerLine: 32 };
  }

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);

    if (raw) {
      return {
        charsPerLine: 32,
        ...JSON.parse(raw),
      };
    }
  } catch {
    // Ignore corrupted localStorage data.
  }

  return { charsPerLine: 32 };
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export default function PrintActions({
  backHref,
  receipt,
}: {
  backHref: string;
  receipt?: ReceiptData;
}) {
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  const [showHelp, setShowHelp] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [settings, setSettings] = useState<PrinterSettings>({
    charsPerLine: 32,
  });

  const [btBusy, setBtBusy] = useState(false);

  const [btStatus, setBtStatus] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);

  // IMPORTANT:
  // We no longer use this value to hide the Bluetooth button.
  // The button should remain visible on mobile so the user gets a proper
  // explanation if their browser does not support Web Bluetooth.
  const [btSupported, setBtSupported] = useState(false);

  // Detect mobile browser
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());

    const supported = isWebBluetoothSupported();
    setBtSupported(supported);

    const mobile =
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      window.innerWidth <= 768;

    setIsMobile(mobile);
  }, []);

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  function saveSettings(next: PrinterSettings) {
    setSettings(next);

    try {
      window.localStorage.setItem(
        SETTINGS_KEY,
        JSON.stringify(next)
      );
    } catch {
      // Ignore localStorage errors.
    }
  }

  // ---------------------------------------------------------------------------
  // Share receipt as image
  // ---------------------------------------------------------------------------

  async function handleShareAsImage() {
    setSharing(true);
    setShareError(null);

    try {
      const html2canvas = (await import('html2canvas')).default;

      const node = document.getElementById('print-content');

      if (!node) {
        throw new Error('Could not find the receipt content.');
      }

      const canvas = await html2canvas(node, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });

      const blob: Blob | null = await new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/png');
      });

      if (!blob) {
        throw new Error('Could not generate the receipt image.');
      }

      const file = new File(
        [blob],
        'receipt.png',
        {
          type: 'image/png',
        }
      );

      // -----------------------------------------------------------------------
      // Mobile Share Sheet
      // -----------------------------------------------------------------------

      if (
        navigator.share &&
        navigator.canShare &&
        navigator.canShare({
          files: [file],
        })
      ) {
        await navigator.share({
          files: [file],
          title: 'Receipt',
          text: 'Receipt',
        });

        return;
      }

      // -----------------------------------------------------------------------
      // Fallback: download image
      // -----------------------------------------------------------------------

      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'receipt.png';

      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      // User closed share sheet.
      if (
        err instanceof Error &&
        err.name === 'AbortError'
      ) {
        return;
      }

      if (err instanceof Error) {
        setShareError(err.message);
      } else {
        setShareError('Unable to share the receipt.');
      }
    } finally {
      setSharing(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Bluetooth printing
  // ---------------------------------------------------------------------------

  async function handleBluetoothPrint() {
    setBtStatus(null);

    if (!receipt) {
      setBtStatus({
        ok: false,
        message: 'Receipt data is not available.',
      });

      return;
    }

    // -------------------------------------------------------------------------
    // Browser does not support Web Bluetooth
    // -------------------------------------------------------------------------

    if (!btSupported) {
      setBtStatus({
        ok: false,
        message:
          'Bluetooth printing is not supported in this browser. On Android, open this page directly in Chrome and try again. On iPhone, use "Share as Image" with your printer app.',
      });

      setShowHelp(true);

      return;
    }

    // -------------------------------------------------------------------------
    // Start printing
    // -------------------------------------------------------------------------

    setBtBusy(true);

    try {
      const bytes = buildInvoiceReceipt(
        receipt,
        settings.charsPerLine
      );

      const result = await printOverBluetooth(bytes);

      if (result.ok) {
        setBtStatus({
          ok: true,
          message: result.deviceName
            ? `Printed via ${result.deviceName}.`
            : 'Receipt sent to printer.',
        });
      } else {
        setBtStatus({
          ok: false,
          message:
            result.error ||
            'Could not print to the Bluetooth printer.',
        });
      }
    } catch (err) {
      setBtStatus({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Bluetooth printing failed.',
      });
    } finally {
      setBtBusy(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Native browser print
  // ---------------------------------------------------------------------------

  function handlePrint() {
    setTimeout(() => {
      window.print();
    }, 50);
  }

  // ---------------------------------------------------------------------------
  // UI
  // ---------------------------------------------------------------------------

  return (
    <div className="print:hidden sticky top-0 bg-gray-100 border-b border-gray-300 z-50">
      {/* ------------------------------------------------------------------ */}
      {/* TOP BAR                                                            */}
      {/* ------------------------------------------------------------------ */}

      <div className="px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Back */}
          <a
            href={backHref}
            className="flex items-center gap-2 text-sm text-gray-700 hover:text-black cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </a>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-2">
            {receipt && (
              <>
                {/* Settings */}
                <button
                  type="button"
                  onClick={() =>
                    setShowSettings(!showSettings)
                  }
                  className="text-gray-500 hover:text-black cursor-pointer p-2 rounded-lg hover:bg-gray-200"
                  title="Paper width setting"
                  aria-label="Paper width setting"
                >
                  <Settings className="w-5 h-5" />
                </button>

                {/* Bluetooth */}
                <button
                  type="button"
                  onClick={handleBluetoothPrint}
                  disabled={btBusy}
                  className="bg-sky-700 hover:bg-sky-600 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Bluetooth className="w-4 h-4" />

                  {btBusy
                    ? 'Connecting...'
                    : 'Bluetooth Printer'}
                </button>
              </>
            )}

            {/* Help */}
            <button
              type="button"
              onClick={() =>
                setShowHelp(!showHelp)
              }
              className="text-gray-500 hover:text-black cursor-pointer p-2 rounded-lg hover:bg-gray-200"
              title="Printer help"
              aria-label="Printer help"
            >
              <Info className="w-5 h-5" />
            </button>

            {/* Share */}
            <button
              type="button"
              onClick={handleShareAsImage}
              disabled={sharing}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Share2 className="w-4 h-4" />

              {sharing
                ? 'Preparing...'
                : 'Share as Image'}
            </button>

            {/* Print */}
            <button
              type="button"
              onClick={handlePrint}
              className="bg-black hover:bg-gray-800 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>

          {/* Mobile: Settings + Help */}
          <div className="flex md:hidden items-center gap-1">
            {receipt && (
              <button
                type="button"
                onClick={() =>
                  setShowSettings(!showSettings)
                }
                className="text-gray-600 hover:text-black p-2 rounded-lg hover:bg-gray-200"
                title="Printer settings"
                aria-label="Printer settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}

            <button
              type="button"
              onClick={() =>
                setShowHelp(!showHelp)
              }
              className="text-gray-600 hover:text-black p-2 rounded-lg hover:bg-gray-200"
              title="Printer help"
              aria-label="Printer help"
            >
              <Info className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* MOBILE ACTION BUTTONS                                           */}
        {/* ---------------------------------------------------------------- */}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 md:hidden">
          {receipt && (
            <button
              type="button"
              onClick={handleBluetoothPrint}
              disabled={btBusy}
              className="min-h-[46px] bg-sky-700 hover:bg-sky-600 active:bg-sky-800 text-white text-sm font-medium px-3 py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Bluetooth className="w-5 h-5 shrink-0" />

              <span>
                {btBusy
                  ? 'Connecting...'
                  : 'Bluetooth Printer'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={handleShareAsImage}
            disabled={sharing}
            className="min-h-[46px] bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-sm font-medium px-3 py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Share2 className="w-5 h-5 shrink-0" />

            <span>
              {sharing
                ? 'Preparing...'
                : 'Share as Image'}
            </span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="min-h-[46px] bg-black hover:bg-gray-800 active:bg-gray-900 text-white text-sm font-medium px-3 py-2.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
          >
            <Printer className="w-5 h-5 shrink-0" />

            <span>Print</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* SETTINGS                                                          */}
      {/* ------------------------------------------------------------------ */}

      {showSettings && receipt && (
        <div className="px-3 pb-3">
          <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-end gap-3 text-sm text-gray-700">
            <label className="flex flex-col gap-1">
              <span className="font-medium">
                Paper width
              </span>

              <select
                value={settings.charsPerLine}
                onChange={(e) =>
                  saveSettings({
                    ...settings,
                    charsPerLine:
                      Number(e.target.value) as
                        | 32
                        | 48,
                  })
                }
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white min-h-[42px]"
              >
                <option value={32}>
                  58mm (32 chars)
                </option>

                <option value={48}>
                  80mm (48 chars)
                </option>
              </select>
            </label>

            <span className="text-gray-500 text-xs">
              Saved on this device only.
            </span>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* BLUETOOTH STATUS                                                   */}
      {/* ------------------------------------------------------------------ */}

      {btStatus && (
        <div className="px-3 pb-3">
          <div
            className={`rounded-lg px-3 py-2 text-xs ${
              btStatus.ok
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {btStatus.message}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* SHARE ERROR                                                        */}
      {/* ------------------------------------------------------------------ */}

      {shareError && (
        <div className="px-3 pb-3">
          <div className="rounded-lg px-3 py-2 text-xs bg-red-50 text-red-600 border border-red-200">
            {shareError}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* HELP                                                               */}
      {/* ------------------------------------------------------------------ */}

      {showHelp && (
        <div className="px-3 pb-3">
          <div className="bg-white border border-gray-200 rounded-xl p-3 text-xs text-gray-600 space-y-2">
            <div>
              <strong className="text-gray-800">
                Bluetooth Printer
              </strong>

              <p className="mt-1">
                Direct Bluetooth printing works only
                when the browser supports Web Bluetooth.
                Android Chrome/Edge is the main supported
                environment.
              </p>
            </div>

            {!btSupported && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2">
                <strong>
                  Bluetooth is not available in this
                  browser.
                </strong>

                <p className="mt-1">
                  On Android, open the website directly
                  in Chrome and try again.
                </p>

                <p className="mt-1">
                  On iPhone/iPad, use
                  <strong> Share as Image </strong>
                  and select your printer app.
                </p>
              </div>
            )}

            <div>
              <strong className="text-gray-800">
                Share as Image
              </strong>

              <p className="mt-1">
                This is the safest mobile fallback.
                It creates a PNG of the receipt and opens
                the phone's share menu when supported.
              </p>
            </div>

            <div>
              <strong className="text-gray-800">
                Print
              </strong>

              <p className="mt-1">
                Uses the device/browser's normal print
                dialog. This is useful for printers
                installed through the operating system.
              </p>
            </div>

            {isMobile && (
              <div className="text-gray-500 pt-1">
                You are using a mobile device. For cheap
                Bluetooth thermal printers, try
                <strong> Bluetooth Printer </strong>
                first on Android Chrome. If that does not
                work, use
                <strong> Share as Image </strong>.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}