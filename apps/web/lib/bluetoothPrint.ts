// Direct Bluetooth thermal printing via the Web Bluetooth API — a
// persistent connection manager, not a connect-print-disconnect cycle
// on every single print. A billing counter prints many bills in a row;
// re-picking the printer from the OS chooser every time is the single
// biggest reliability complaint with browser-based BLE printing, so
// this keeps one connection alive for as long as the browser allows it
// and only asks to reconnect when the printer actually drops.
//
// Two things this genuinely cannot do, by browser/OS design — not a
// gap in this code:
//  - Persist the connection across a page reload or a new tab. Each
//    invoice currently opens in its own tab (target="_blank" from the
//    job card / invoice list), so "stay connected" means "for as long
//    as that one print tab stays open," not across tabs — Web
//    Bluetooth's GATT connection is tied to the page/document, full
//    stop, on every browser.
//  - Work on iPhone/iPad at all. Apple has never shipped Web Bluetooth
//    in WebKit (the engine every iOS browser is forced to use,
//    including Chrome-on-iOS) — an Apple platform policy, not
//    something any web app can route around.

const CANDIDATE_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // most common generic ESC/POS BLE module (GOOJPRT/MPT-II/China OEM)
  '0000ff00-0000-1000-8000-00805f9b34fb', // common alternate vendor service
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10/serial-bridge-style modules, also common in cheap printers
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service — some newer/BLE-native printer boards
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2'
];
const CANDIDATE_WRITE_CHARACTERISTICS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART TX (write) characteristic
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'
];

export type PrinterConnectionState = 'disconnected' | 'connecting' | 'connected';

export function isBluetoothPrintSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

// window.isSecureContext is true for HTTPS and for localhost during
// local development — false for a plain-HTTP page, which is the other
// real reason Web Bluetooth silently refuses to work.
export function isSecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext === true;
}

async function findWritableCharacteristic(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic> {
  for (const serviceUuid of CANDIDATE_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      const characteristics = await service.getCharacteristics();
      const writable = characteristics.find((c) => c.properties.write || c.properties.writeWithoutResponse);
      if (writable) return writable;
    } catch {
      // This printer doesn't expose that service — try the next candidate.
    }
  }
  for (const serviceUuid of CANDIDATE_SERVICES) {
    for (const charUuid of CANDIDATE_WRITE_CHARACTERISTICS) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        return await service.getCharacteristic(charUuid);
      } catch {
        // Keep trying other service/characteristic combinations.
      }
    }
  }
  throw new Error('This printer doesn\u2019t expose a writable Bluetooth characteristic this app recognizes — it may not be a supported ESC/POS printer.');
}

// Most BLE printer modules only accept small writes (often ~20 bytes at
// the protocol level, sometimes more with a negotiated MTU) before
// dropping data — sending too fast or too large a chunk is the most
// common cause of garbled or partial receipts.
async function writeInChunks(characteristic: BluetoothRemoteGATTCharacteristic, bytes: Uint8Array) {
  const CHUNK_SIZE = 100;
  const PACING_DELAY_MS = 20;
  const MAX_RETRIES = 2;

  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + CHUNK_SIZE);
    let attempt = 0;
    while (true) {
      try {
        if (characteristic.properties.writeWithoutResponse) {
          await characteristic.writeValueWithoutResponse(chunk);
        } else {
          await characteristic.writeValue(chunk);
        }
        break;
      } catch (err) {
        attempt++;
        if (attempt > MAX_RETRIES) {
          throw new Error('Printing failed while sending data to the printer \u2014 it may be out of range or its buffer is full.');
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, PACING_DELAY_MS));
  }
}

// A module-level singleton (not React state) — the whole point is that
// the connection survives across re-renders and across every print
// button press on this page, not just within one component instance.
class PrinterManager {
  private device: BluetoothDevice | null = null;
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private printerName: string | null = null;
  private onStateChange: ((state: PrinterConnectionState) => void) | null = null;

  subscribe(callback: (state: PrinterConnectionState) => void) {
    this.onStateChange = callback;
  }

  unsubscribe() {
    this.onStateChange = null;
  }

  private setState(state: PrinterConnectionState) {
    this.onStateChange?.(state);
  }

  isConnected(): boolean {
    return Boolean(this.device?.gatt?.connected && this.characteristic);
  }

  getPrinterName(): string | null {
    return this.printerName;
  }

  private handleDisconnect = () => {
    this.characteristic = null;
    this.setState('disconnected');
  };

  async connect(): Promise<void> {
    if (!isBluetoothPrintSupported()) {
      throw new Error('Bluetooth printing isn\u2019t supported in this browser. Use Chrome on Android, or a network/WiFi printer instead.');
    }
    if (!isSecureContext()) {
      throw new Error('Bluetooth printing requires a secure HTTPS connection.');
    }

    this.setState('connecting');
    try {
      const device = await navigator.bluetooth!.requestDevice({
        acceptAllDevices: true,
        optionalServices: CANDIDATE_SERVICES
      });

      if (!device.gatt) {
        throw new Error('This device doesn\u2019t support the connection this app needs.');
      }

      // Clean up any previous connection's listener before attaching a
      // new one, so reconnecting doesn't stack up duplicate handlers.
      this.device?.removeEventListener('gattserverdisconnected', this.handleDisconnect);
      device.addEventListener('gattserverdisconnected', this.handleDisconnect);

      const server = await device.gatt.connect();
      const characteristic = await findWritableCharacteristic(server);

      this.device = device;
      this.characteristic = characteristic;
      this.printerName = device.name || 'Bluetooth Printer';
      this.setState('connected');
    } catch (err) {
      this.setState('disconnected');
      if (err instanceof Error) {
        if (err.name === 'NotFoundError') {
          throw new Error('No printer was selected.');
        }
        if (err.name === 'SecurityError' || err.name === 'NotAllowedError') {
          throw new Error('Bluetooth permission was denied.');
        }
        throw err;
      }
      throw new Error('Printer connection failed.');
    }
  }

  disconnect() {
    this.device?.removeEventListener('gattserverdisconnected', this.handleDisconnect);
    if (this.device?.gatt?.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
    this.printerName = null;
    this.setState('disconnected');
  }

  async print(bytes: Uint8Array): Promise<void> {
    if (!this.isConnected() || !this.characteristic) {
      throw new Error('Printer disconnected \u2014 reconnect and try again.');
    }
    await writeInChunks(this.characteristic, bytes);
  }
}

// One instance per page load — every PrintActions render (and every
// print button press) shares this same connection instead of each
// print attempt creating its own connect/disconnect cycle.
export const printerManager = new PrinterManager();
