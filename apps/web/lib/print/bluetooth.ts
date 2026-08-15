'use client';

/**
 * Direct Bluetooth Low Energy (BLE) printing for ESC/POS thermal printers.
 *
 * Supported:
 * - Android + Chrome
 * - Android + Edge
 * - Desktop Chrome/Edge with Bluetooth support
 *
 * Important:
 * - iPhone/iPad Safari does NOT provide Web Bluetooth.
 * - Different thermal printers use different BLE services.
 * - Therefore we use acceptAllDevices and then inspect the
 *   services/characteristics after connection.
 *
 * No RawBT or external app is required when the printer exposes
 * a compatible BLE GATT writable characteristic.
 */

// -----------------------------------------------------------------------------
// Local Web Bluetooth types
// -----------------------------------------------------------------------------

interface BleCharacteristic {
  writeValue(value: BufferSource): Promise<void>;

  // Newer browsers may support this method.
  writeValueWithoutResponse?(
    value: BufferSource
  ): Promise<void>;
}

interface BleService {
  getCharacteristic(
    uuid: string
  ): Promise<BleCharacteristic>;

  getCharacteristics?(): Promise<BleCharacteristic[]>;
}

interface BleServer {
  getPrimaryService(
    uuid: string
  ): Promise<BleService>;

  getPrimaryServices?(): Promise<BleService[]>;

  disconnect(): void;
}

interface BleGatt {
  connect(): Promise<BleServer>;
}

interface BleDevice {
  name?: string;

  gatt?: BleGatt;

  addEventListener?: (
    type: string,
    listener: (...args: unknown[]) => void
  ) => void;
}

interface BleNavigator {
  bluetooth: {
    requestDevice(options: {
      acceptAllDevices?: boolean;
      filters?: Array<{
        services?: string[];
        name?: string;
        namePrefix?: string;
      }>;
      optionalServices?: string[];
    }): Promise<BleDevice>;
  };
}

// -----------------------------------------------------------------------------
// Common BLE printer service UUIDs
// -----------------------------------------------------------------------------

const CANDIDATE_SERVICES = [
  // Generic Serial Port Profile / BLE printer
  '000018f0-0000-1000-8000-00805f9b34fb',

  // ISSC / simple serial BLE bridge
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',

  // Common clone printer service
  '0000ff00-0000-1000-8000-00805f9b34fb',

  // Nordic UART Service
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e',

  // Another commonly encountered printer service
  '0000ffe0-0000-1000-8000-00805f9b34fb',

  // Generic vendor service sometimes used by thermal printers
  '0000ae30-0000-1000-8000-00805f9b34fb',
];

// -----------------------------------------------------------------------------
// Common writable characteristic UUIDs
// -----------------------------------------------------------------------------

const CANDIDATE_WRITE_CHARACTERISTICS = [
  // Generic printer characteristic
  '00002af1-0000-1000-8000-00805f9b34fb',

  // ISSC serial characteristic
  '49535343-8841-43f4-a8d4-ecbe34729bb3',

  // Common clone characteristic
  '0000ff02-0000-1000-8000-00805f9b34fb',

  // Nordic UART TX
  '6e400002-b5a3-f393-e0a9-e50e24dcca9e',

  // Nordic UART RX
  '6e400003-b5a3-f393-e0a9-e50e24dcca9e',

  // Common FFE1 characteristic
  '0000ffe1-0000-1000-8000-00805f9b34fb',

  // Another common printer characteristic
  '0000ae01-0000-1000-8000-00805f9b34fb',

  // Generic serial characteristic
  '0000ff01-0000-1000-8000-00805f9b34fb',
];

// -----------------------------------------------------------------------------
// Result type
// -----------------------------------------------------------------------------

export interface BluetoothPrintResult {
  ok: boolean;
  deviceName?: string;
  error?: string;
}

// -----------------------------------------------------------------------------
// Browser support
// -----------------------------------------------------------------------------

export function isWebBluetoothSupported(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  if (typeof navigator === 'undefined') {
    return false;
  }

  return 'bluetooth' in navigator;
}

// -----------------------------------------------------------------------------
// Get BLE navigator
// -----------------------------------------------------------------------------

function getBleNavigator(): BleNavigator {
  return navigator as unknown as BleNavigator;
}

// -----------------------------------------------------------------------------
// Find writable characteristic
// -----------------------------------------------------------------------------

async function findWritableCharacteristic(
  server: BleServer
): Promise<BleCharacteristic | null> {
  // ---------------------------------------------------------------------------
  // First: try known service + characteristic combinations
  // ---------------------------------------------------------------------------

  for (const serviceUuid of CANDIDATE_SERVICES) {
    try {
      const service =
        await server.getPrimaryService(serviceUuid);

      for (const characteristicUuid of CANDIDATE_WRITE_CHARACTERISTICS) {
        try {
          const characteristic =
            await service.getCharacteristic(
              characteristicUuid
            );

          if (characteristic) {
            return characteristic;
          }
        } catch {
          // Characteristic not present.
          // Continue searching.
        }
      }
    } catch {
      // Service not present.
      // Continue searching.
    }
  }

  // ---------------------------------------------------------------------------
  // Second: if browser exposes all primary services,
  // inspect them dynamically.
  // ---------------------------------------------------------------------------

  if (server.getPrimaryServices) {
    try {
      const services =
        await server.getPrimaryServices();

      for (const service of services) {
        if (!service.getCharacteristics) {
          continue;
        }

        try {
          const characteristics =
            await service.getCharacteristics();

          for (const characteristic of characteristics) {
            // The local interface doesn't expose properties,
            // so we accept the first characteristic returned here.
            if (characteristic) {
              return characteristic;
            }
          }
        } catch {
          // Ignore this service and continue.
        }
      }
    } catch {
      // Some browsers do not allow generic service enumeration.
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// Write bytes to BLE characteristic
// -----------------------------------------------------------------------------

async function writeBytes(
  characteristic: BleCharacteristic,
  bytes: Uint8Array
): Promise<void> {
  /**
   * BLE MTU varies between devices.
   *
   * 100 bytes is conservative enough for many Android devices,
   * while still being faster than writing one byte at a time.
   */
  const CHUNK_SIZE = 100;

  for (
    let offset = 0;
    offset < bytes.length;
    offset += CHUNK_SIZE
  ) {
    const chunk = bytes.slice(
      offset,
      Math.min(offset + CHUNK_SIZE, bytes.length)
    );

    /**
     * Prefer writeValueWithoutResponse when available.
     *
     * Some thermal printers are designed for fast raw writes
     * and work better with this mode.
     */
    if (
      typeof characteristic.writeValueWithoutResponse ===
      'function'
    ) {
      await characteristic.writeValueWithoutResponse(
        chunk
      );
    } else {
      await characteristic.writeValue(chunk);
    }

    // Small delay prevents cheap printer BLE modules
    // from overflowing their receive buffer.
    await new Promise((resolve) =>
      setTimeout(resolve, 20)
    );
  }
}

// -----------------------------------------------------------------------------
// Main Bluetooth print function
// -----------------------------------------------------------------------------

export async function printOverBluetooth(
  bytes: Uint8Array
): Promise<BluetoothPrintResult> {
  // ---------------------------------------------------------------------------
  // Browser check
  // ---------------------------------------------------------------------------

  if (!isWebBluetoothSupported()) {
    return {
      ok: false,
      error:
        'Bluetooth printing is not supported in this browser. Use Chrome on Android or use "Share as Image".',
    };
  }

  // ---------------------------------------------------------------------------
  // Validate print data
  // ---------------------------------------------------------------------------

  if (!bytes || bytes.length === 0) {
    return {
      ok: false,
      error:
        'There is no receipt data available to print.',
    };
  }

  const bleNav = getBleNavigator();

  // ---------------------------------------------------------------------------
  // Request printer
  // ---------------------------------------------------------------------------

  let device: BleDevice;

  try {
    /**
     * IMPORTANT:
     *
     * We intentionally use acceptAllDevices instead of filtering only
     * known printer services.
     *
     * Many cheap thermal printers advertise vendor-specific BLE services.
     * If we filter by a service they don't advertise, Android won't even
     * show the printer in the picker.
     */
    device =
      await bleNav.bluetooth.requestDevice({
        acceptAllDevices: true,

        optionalServices: CANDIDATE_SERVICES,
      });
  } catch (err) {
    // User closed the Bluetooth device picker.
    if (
      err instanceof Error &&
      (
        err.name === 'NotFoundError' ||
        err.name === 'AbortError'
      )
    ) {
      return {
        ok: false,
      };
    }

    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Could not open the Bluetooth device picker.',
    };
  }

  // ---------------------------------------------------------------------------
  // Connect to GATT
  // ---------------------------------------------------------------------------

  let server: BleServer | undefined;

  try {
    if (!device.gatt) {
      return {
        ok: false,
        error:
          'This Bluetooth device does not support a GATT connection.',
      };
    }

    server = await device.gatt.connect();

    // -------------------------------------------------------------------------
    // Find writable characteristic
    // -------------------------------------------------------------------------

    const characteristic =
      await findWritableCharacteristic(server);

    if (!characteristic) {
      server.disconnect();

      return {
        ok: false,
        deviceName: device.name,
        error:
          `Connected to "${device.name || 'the printer'}", but no writable BLE print characteristic was found. This printer may use a proprietary Bluetooth profile. Try "Share as Image" with the printer's app or RawBT.`,
      };
    }

    // -------------------------------------------------------------------------
    // Send ESC/POS data
    // -------------------------------------------------------------------------

    await writeBytes(
      characteristic,
      bytes
    );

    // -------------------------------------------------------------------------
    // Give printer a moment to process final bytes
    // -------------------------------------------------------------------------

    await new Promise((resolve) =>
      setTimeout(resolve, 150)
    );

    // -------------------------------------------------------------------------
    // Disconnect
    // -------------------------------------------------------------------------

    try {
      server.disconnect();
    } catch {
      // Ignore disconnect errors after successful printing.
    }

    return {
      ok: true,
      deviceName: device.name,
    };
  } catch (err) {
    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    try {
      server?.disconnect();
    } catch {
      // Ignore cleanup errors.
    }

    // -------------------------------------------------------------------------
    // User/browser cancellation
    // -------------------------------------------------------------------------

    if (
      err instanceof Error &&
      err.name === 'AbortError'
    ) {
      return {
        ok: false,
      };
    }

    // -------------------------------------------------------------------------
    // Permission error
    // -------------------------------------------------------------------------

    if (
      err instanceof Error &&
      (
        err.name === 'SecurityError' ||
        err.name === 'NotAllowedError'
      )
    ) {
      return {
        ok: false,
        deviceName: device.name,
        error:
          'Bluetooth permission was denied. Please allow Bluetooth permission and try again.',
      };
    }

    // -------------------------------------------------------------------------
    // Generic error
    // -------------------------------------------------------------------------

    return {
      ok: false,
      deviceName: device.name,
      error:
        err instanceof Error
          ? err.message
          : 'Bluetooth printing failed.',
    };
  }
}