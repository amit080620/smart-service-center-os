// Direct Bluetooth thermal printing via the Web Bluetooth API — no
// third-party app needed. Connects straight from the browser to the
// printer and streams raw ESC/POS bytes to it, the same way a native
// billing app would over Bluetooth Classic/BLE.
//
// Browser support is the real constraint here, not this code: Web
// Bluetooth only works in Chromium browsers (Chrome/Edge) on Android
// and desktop. Safari (and therefore every browser on iPhone/iPad,
// since iOS forces all browsers to use Safari's engine) has no support
// at all — that's an Apple platform policy, not something fixable from
// here.
//
// 0x18F0 is the write service almost every generic/budget ESC/POS BLE
// thermal printer uses (the common "GOOJPRT / MPT-II / generic China
// OEM" printer module) — covers the overwhelming majority of the
// inexpensive Bluetooth receipt printers sold in India. Listed
// alongside a couple of other services some printer brands use instead,
// so the pairing dialog can find whichever service is actually there.
const CANDIDATE_SERVICES = ['000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2'];
const CANDIDATE_WRITE_CHARACTERISTICS = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '0000ff02-0000-1000-8000-00805f9b34fb',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f'
];

export function isBluetoothPrintSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

async function findWritableCharacteristic(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic> {
  for (const serviceUuid of CANDIDATE_SERVICES) {
    try {
      const service = await server.getPrimaryService(serviceUuid);
      const characteristics = await service.getCharacteristics();
      const writable = characteristics.find((c) => c.properties.write || c.properties.writeWithoutResponse);
      if (writable) return writable;
    } catch {
      // This printer doesn't expose that service — try the next
      // candidate rather than failing the whole connection.
    }
  }
  // Fall back to explicitly-named characteristic UUIDs in case the
  // service enumeration above didn't surface them for some reason.
  for (const serviceUuid of CANDIDATE_SERVICES) {
    for (const charUuid of CANDIDATE_WRITE_CHARACTERISTICS) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        return await service.getCharacteristic(charUuid);
      } catch {
        // Keep trying other combinations.
      }
    }
  }
  throw new Error("Couldn't find a printable service on this device — it may not be a supported ESC/POS printer.");
}

// Sends the bytes in small chunks — most BLE printer modules only
// accept ~20-100 bytes per write before dropping data, regardless of
// what the OS-level MTU negotiation reports.
async function writeInChunks(characteristic: BluetoothRemoteGATTCharacteristic, bytes: Uint8Array) {
  const CHUNK_SIZE = 100;
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + CHUNK_SIZE);
    if (characteristic.properties.writeWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
    // Small pacing delay — sending too fast can overflow the printer's
    // input buffer and drop/garble bytes on cheaper modules.
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

export async function printViaBluetooth(bytes: Uint8Array): Promise<void> {
  if (!isBluetoothPrintSupported() || !navigator.bluetooth) {
    throw new Error('Bluetooth printing isn\u2019t supported in this browser. Use Chrome on Android, or a network/WiFi printer instead.');
  }

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: CANDIDATE_SERVICES
  });

  if (!device.gatt) {
    throw new Error('This device doesn\u2019t support the connection this app needs.');
  }

  const server = await device.gatt.connect();
  try {
    const characteristic = await findWritableCharacteristic(server);
    await writeInChunks(characteristic, bytes);
  } finally {
    server.disconnect();
  }
}
