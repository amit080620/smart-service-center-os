'use client';

// Direct Bluetooth Low Energy (BLE) printing — no RawBT, no external app.
//
// Honest limitations, upfront:
// - Works ONLY on Android + Chrome/Edge (and desktop Chrome/Edge with a
//   BLE adapter). iPhone/Safari has NO Web Bluetooth support at all —
//   Apple has never shipped it — so this button will not work on
//   iPhones. That's an OS/browser restriction, not something fixable
//   in this code.
// - Cheap ESC/POS printers don't share one BLE standard. This tries the
//   handful of service/characteristic UUIDs actually used by the
//   printer chipsets commonly sold in India. If a specific printer uses
//   something else, this will fail to find a writable characteristic —
//   "Share as Image" + RawBT remains the fallback that covers the
//   widest range of printer models.
//
// Minimal local types below stand in for the Web Bluetooth API (there's
// no @types/web-bluetooth in this repo, and this doesn't need a new
// dependency just for types) — only the handful of members this file
// actually calls.

interface BleCharacteristic {
  writeValue(value: BufferSource): Promise<void>;
}
interface BleService {
  getCharacteristic(uuid: string): Promise<BleCharacteristic>;
}
interface BleServer {
  getPrimaryService(uuid: string): Promise<BleService>;
  disconnect(): void;
}
interface BleDevice {
  name?: string;
  gatt?: { connect(): Promise<BleServer> };
}
interface BleNavigator {
  bluetooth: {
    requestDevice(options: { filters: { services: string[] }[]; optionalServices: string[] }): Promise<BleDevice>;
  };
}

const CANDIDATE_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', // most common generic-printer BLE service
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ISSC/simple-serial BLE bridge, used by several clone boards
  '0000ff00-0000-1000-8000-00805f9b34fb' // seen on some other clone boards
];

const CANDIDATE_WRITE_CHARACTERISTICS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  '0000ff02-0000-1000-8000-00805f9b34fb'
];

export interface BluetoothPrintResult {
  ok: boolean;
  deviceName?: string;
  error?: string;
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

export async function printOverBluetooth(bytes: Uint8Array): Promise<BluetoothPrintResult> {
  if (!isWebBluetoothSupported()) {
    return {
      ok: false,
      error: 'This browser has no Bluetooth printing support. Use Chrome on Android, or use "Share as Image" instead.'
    };
  }

  const bleNav = navigator as unknown as BleNavigator;

  let device: BleDevice;
  try {
    device = await bleNav.bluetooth.requestDevice({
      filters: CANDIDATE_SERVICES.map((s) => ({ services: [s] })),
      optionalServices: CANDIDATE_SERVICES
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'NotFoundError') {
      // Person closed the device picker without choosing — not an error.
      return { ok: false };
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Could not open the Bluetooth device picker.' };
  }

  let server: BleServer | undefined;
  try {
    if (!device.gatt) {
      return { ok: false, error: 'This device does not support a GATT connection.' };
    }
    server = await device.gatt.connect();

    let characteristic: BleCharacteristic | null = null;
    for (const serviceUuid of CANDIDATE_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        for (const charUuid of CANDIDATE_WRITE_CHARACTERISTICS) {
          try {
            characteristic = await service.getCharacteristic(charUuid);
            break;
          } catch {
            // not on this service — try the next characteristic
          }
        }
        if (characteristic) break;
      } catch {
        // printer doesn't offer this service — try the next
      }
    }

    if (!characteristic) {
      server.disconnect();
      return {
        ok: false,
        error:
          `Connected to "${device.name || 'the printer'}" but couldn't find a supported print characteristic on it. ` +
          `This model likely uses a different BLE profile — use "Share as Image" with RawBT instead, it supports far more printer models.`
      };
    }

    // BLE writes are capped per packet (older stacks ~20 bytes, modern
    // ones with MTU negotiation up to ~180-500, varies by phone).
    // Chunking conservatively avoids overflowing the printer's buffer.
    const CHUNK_SIZE = 100;
    for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
      const chunk = bytes.slice(i, i + CHUNK_SIZE);
      await characteristic.writeValue(chunk);
      await new Promise((r) => setTimeout(r, 20));
    }

    server.disconnect();
    return { ok: true, deviceName: device.name };
  } catch (err) {
    server?.disconnect();
    return { ok: false, error: err instanceof Error ? err.message : 'Bluetooth printing failed.' };
  }
}
