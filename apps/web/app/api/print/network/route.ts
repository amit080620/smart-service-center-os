import { NextRequest, NextResponse } from 'next/server';
import net from 'net';
import { getSessionContext } from '@smartbizos/auth';

// Sends raw bytes to a network thermal printer over TCP port 9100 —
// the standard "raw ESC/POS" port almost every WiFi/LAN/Ethernet
// receipt printer listens on. This runs server-side because browsers
// can't open arbitrary TCP sockets — the printer just needs to be on
// the same network as wherever this request originates from (works
// fine when the shop's printer and the device printing are on the
// same LAN/WiFi, which is the normal setup for a network printer).
export async function POST(req: NextRequest) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Not signed in.' } }, { status: 401 });
  }

  const body = await req.json();
  const { printerIp, bytes } = body as { printerIp?: string; bytes?: number[] };

  if (!printerIp || !Array.isArray(bytes)) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'printerIp and bytes are required.' } }, { status: 400 });
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const socket = new net.Socket();
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('Timed out connecting to the printer — check the IP address and that it\u2019s on the same network.'));
      }, 5000);

      socket.connect(9100, printerIp, () => {
        socket.write(Buffer.from(bytes), (err) => {
          clearTimeout(timeout);
          if (err) {
            socket.destroy();
            reject(err);
          } else {
            socket.end();
            resolve();
          }
        });
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: { code: 'PRINTER_ERROR', message: err instanceof Error ? err.message : 'Could not reach the printer.' } },
      { status: 502 }
    );
  }
}
