'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

// Polls the org's wallet balance and shows a persistent (but dismissible
// per-session) banner once it drops to/below the low-balance threshold —
// so a shop owner finds out from the app itself, not by waiting for a
// phone call. Doesn't block anything by itself; the hard block (new job
// cards only) is enforced server-side regardless of whether this banner
// is seen.

export default function WalletBanner() {
  const [wallet, setWallet] = useState<{
    balance: number;
    isLow: boolean;
    isBlocked: boolean;
    supportPhone: string;
  } | null>(null);

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch('/api/wallet');

        if (!res.ok) return;

        setWallet(await res.json());
      } catch {
        // Silent — try again next interval.
      }
    }

    // Initial wallet check
    poll();

    // Refresh wallet balance every 60 seconds
    const interval = setInterval(poll, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!wallet || !wallet.isLow || dismissed) {
    return null;
  }

  // Always show wallet money with exactly 2 decimal places.
  // Example:
  // 90.00999999999999 -> 90.01
  // 90 -> 90.00
  // 1250.5 -> 1,250.50
  const formattedBalance = Number(wallet.balance).toLocaleString(
    'en-IN',
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );

  return (
    <div
      className={`px-4 py-2.5 text-sm flex items-center justify-between gap-3 ${
        wallet.isBlocked
          ? 'bg-red-950/60 text-red-200 border-b border-red-900'
          : 'bg-amber-950/50 text-amber-200 border-b border-amber-900'
      }`}
    >
      <span className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" />

        {wallet.isBlocked ? (
          <>
            Wallet balance ₹{formattedBalance} —{' '}
            <strong>
              new job cards are blocked.
            </strong>{' '}
            Recharge to continue
            {wallet.supportPhone && (
              <>
                {' '}
                — call{' '}
                <a
                  href={`tel:${wallet.supportPhone}`}
                  className="underline font-semibold"
                >
                  {wallet.supportPhone}
                </a>
              </>
            )}
            .
          </>
        ) : (
          <>
            Wallet balance is low (₹
            {formattedBalance}). Recharge soon to avoid
            interruption
            {wallet.supportPhone && (
              <>
                {' '}
                — call{' '}
                <a
                  href={`tel:${wallet.supportPhone}`}
                  className="underline font-semibold"
                >
                  {wallet.supportPhone}
                </a>
              </>
            )}
            .
          </>
        )}
      </span>

      {!wallet.isBlocked && (
        <button
          onClick={() => setDismissed(true)}
          className="text-xs underline cursor-pointer shrink-0"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}