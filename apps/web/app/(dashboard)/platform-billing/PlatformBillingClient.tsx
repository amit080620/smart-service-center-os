'use client';

import { CreditCard, IndianRupee, Phone } from 'lucide-react';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  reason: string;
  balance_after: number;
  created_at: string;
}

export default function PlatformBillingClient({
  balance,
  transactions,
  lowThreshold,
  blockThreshold,
  bikePrice,
  carPrice,
  supportPhone
}: {
  balance: number;
  transactions: Transaction[];
  lowThreshold: number;
  blockThreshold: number;
  bikePrice: number;
  carPrice: number;
  supportPhone: string;
}) {
  const isLow = balance <= lowThreshold;
  const isBlocked = balance <= blockThreshold;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-amber-500" />
            Wallet
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Prepaid balance — ₹{bikePrice} per bike job, ₹{carPrice} per car job.
          </p>
        </div>

        <div
          className={`rounded-2xl p-6 border ${
            isBlocked ? 'bg-red-950/30 border-red-900/50' : isLow ? 'bg-amber-950/30 border-amber-900/50' : 'bg-slate-900/60 border-slate-800'
          }`}
        >
          <div className="text-xs font-mono text-slate-500 uppercase">Current Balance</div>
          <div className={`text-4xl font-bold mt-1 ${isBlocked ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-amber-500'}`}>
            ₹{balance.toLocaleString('en-IN')}
          </div>
          {isBlocked && (
            <p className="text-sm text-red-300 mt-3">
              Balance is at or below the block threshold — new job cards can't be created until this is recharged.
              {supportPhone && (
                <>
                  {' '}
                  Call{' '}
                  <a href={`tel:${supportPhone}`} className="underline font-semibold flex items-center gap-1 inline-flex mt-1">
                    <Phone className="w-3.5 h-3.5" /> {supportPhone}
                  </a>{' '}
                  to recharge.
                </>
              )}
            </p>
          )}
          {!isBlocked && isLow && (
            <p className="text-sm text-amber-300 mt-3">
              Balance is getting low.
              {supportPhone && (
                <>
                  {' '}
                  Call <a href={`tel:${supportPhone}`} className="underline font-semibold">{supportPhone}</a> to recharge before it runs out.
                </>
              )}
            </p>
          )}
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h2 className="font-semibold flex items-center gap-2 text-sm">
              <IndianRupee className="w-4 h-4 text-amber-500" /> Transaction History
            </h2>
          </div>
          {transactions.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">No wallet activity yet.</div>
          ) : (
            <div className="divide-y divide-slate-800/50">
              {transactions.map((t) => (
                <div key={t.id} className="p-3 px-4 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <span className="text-slate-300 truncate">{t.reason}</span>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {new Date(t.created_at).toLocaleString('en-IN')} · Balance after: ₹{t.balance_after}
                    </div>
                  </div>
                  <span className={`font-mono font-semibold shrink-0 ${t.type === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {t.type === 'credit' ? '+' : '−'}₹{t.amount.toLocaleString('en-IN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
