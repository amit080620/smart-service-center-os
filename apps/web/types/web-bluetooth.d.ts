// Minimal Web Bluetooth API type declarations — written directly here
// instead of depending on the external @types/web-bluetooth package.
// That package is easy to end up missing locally (a skipped `npm
// install` after a devDependency changes, an npm cache issue, etc.),
// which breaks the production build with "Cannot find name
// 'BluetoothRemoteGATTServer'" even though the code itself is fine.
// Bundling just the handful of types this file actually uses removes
// that whole failure mode.

interface BluetoothRemoteGATTCharacteristic {
  readonly properties: {
    write: boolean;
    writeWithoutResponse: boolean;
  };
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>;
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>;
}

interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>;
  disconnect(): void;
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>;
}

interface BluetoothDevice {
  readonly gatt?: BluetoothRemoteGATTServer;
}

interface RequestDeviceOptions {
  acceptAllDevices?: boolean;
  optionalServices?: string[];
}

interface Bluetooth {
  requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>;
}

interface Navigator {
  readonly bluetooth?: Bluetooth;
}
