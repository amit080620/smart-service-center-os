import { NextResponse } from 'next/server';
import { getPlatformAdminContext } from '@smartbizos/auth';

export async function GET() {
  const adminCtx = await getPlatformAdminContext();
  return NextResponse.json({ isPlatformAdmin: Boolean(adminCtx) });
}
