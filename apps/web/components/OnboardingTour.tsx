'use client';

import { useEffect, useState } from 'react';
import { ClipboardList, Users, Receipt, MoreHorizontal, Sparkles, ChevronRight, ChevronLeft, X } from 'lucide-react';

const TOUR_SEEN_KEY = 'onboarding-tour-seen';

const STEPS = [
  {
    icon: Sparkles,
    title: 'Welcome to Smart Service Center OS',
    body: 'A quick look at where everything lives — takes about 30 seconds.'
  },
  {
    icon: ClipboardList,
    title: 'Job Cards',
    body: 'The heart of the app. Every vehicle that comes in gets a Job Card — track its status from intake all the way to delivery.'
  },
  {
    icon: Users,
    title: 'Clients',
    body: 'Customer and vehicle records live here. When creating a Job Card, you can also add a new customer or vehicle right there — no need to come here first.'
  },
  {
    icon: Receipt,
    title: 'Billing',
    body: 'Invoices are generated automatically when you complete a Job Card. GST, discounts, and payment tracking are all handled here.'
  },
  {
    icon: MoreHorizontal,
    title: 'Everything Else',
    body: 'Vehicles, Services, Parts, Inventory, Suppliers, Reports, Employees, and Settings are all under the "More" menu — tap it any time.'
  }
];

// Shown once per browser, the first time someone lands on the
// dashboard. Deliberately a simple step-by-step card sequence rather
// than pixel-precise spotlighting on live nav elements — spotlighting
// is fragile across screen sizes and this is faster to build well and
// keep working correctly everywhere.
export default function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const seen = localStorage.getItem(TOUR_SEEN_KEY);
    if (!seen) {
      setVisible(true);
    }
  }, []);

  function finish() {
    localStorage.setItem(TOUR_SEEN_KEY, 'true');
    setVisible(false);
  }

  if (!visible) return null;

  const current = STEPS[step]!;
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full">
        <button onClick={finish} className="float-right text-slate-500 hover:text-slate-300 cursor-pointer -mt-1 -mr-1">
          <X className="w-4 h-4" />
        </button>

        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-amber-500" />
        </div>
        <h2 className="text-lg font-bold text-slate-100">{current.title}</h2>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">{current.body}</p>

        <div className="flex items-center justify-center gap-1.5 mt-6 mb-4">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-amber-500' : 'w-1.5 bg-slate-700'}`} />
          ))}
        </div>

        <div className="flex items-center justify-between gap-2">
          {step > 0 ? (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="text-slate-400 hover:text-slate-200 text-sm px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : (
            <button onClick={finish} className="text-slate-500 hover:text-slate-300 text-sm px-3 py-2 rounded-lg cursor-pointer">
              Skip
            </button>
          )}
          <button
            onClick={() => (isLast ? finish() : setStep((s) => s + 1))}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium text-sm px-4 py-2 rounded-lg cursor-pointer flex items-center gap-1"
          >
            {isLast ? "Let's go" : 'Next'}
            {!isLast && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
