'use client';

import { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';

const DISMISS_KEY = 'pwa-install-dismissed-at';
const DISMISS_COOLDOWN_DAYS = 14;

// Encourages installing this as a home-screen app instead of typing the
// URL in every time. Two paths, since there's no single API that covers
// both:
//  - Android/Chrome/Edge: fires `beforeinstallprompt`, which we capture
//    and trigger from our own button (browsers hide their native mini-
//    infobar once you've called preventDefault() on this event).
//  - iOS Safari: doesn't support beforeinstallprompt at all — the only
//    way to install is the manual Share → "Add to Home Screen" flow, so
//    we detect iOS Safari specifically and show instructions instead.
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [dismissed, setDismissed] = useState(true); // starts hidden until checks pass

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Non-critical — the app works fine without it, this just
        // affects install-prompt eligibility in some browsers.
      });
    }

    // Already running as an installed app — nothing to prompt for.
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    if (isStandalone) return;

    const lastDismissed = localStorage.getItem(DISMISS_KEY);
    if (lastDismissed) {
      const daysSince = (Date.now() - Number(lastDismissed)) / (1000 * 60 * 60 * 24);
      if (daysSince < DISMISS_COOLDOWN_DAYS) return;
    }

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isIos && isSafari) {
      setShowIosInstructions(true);
      setDismissed(false);
      return;
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setDeferredPrompt(e);
      setDismissed(false);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  async function handleInstallClick() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setDismissed(true);
  }

  function handleDismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  }

  if (dismissed || (!deferredPrompt && !showIosInstructions)) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-40 bg-slate-900 border border-amber-900/50 rounded-2xl p-4 shadow-xl shadow-black/40 animate-fadeIn">
      <button onClick={handleDismiss} className="absolute top-3 right-3 text-slate-500 hover:text-slate-300 cursor-pointer">
        <X className="w-4 h-4" />
      </button>
      {showIosInstructions ? (
        <div className="pr-6">
          <div className="font-semibold text-slate-100 text-sm flex items-center gap-2">
            <Download className="w-4 h-4 text-amber-500" /> Add to Home Screen
          </div>
          <p className="text-xs text-slate-400 mt-1.5">
            Tap <Share className="w-3.5 h-3.5 inline mx-0.5 -mt-0.5" /> Share, then "Add to Home Screen" — opens like an
            app, no need to type the link every time.
          </p>
        </div>
      ) : (
        <div className="pr-6">
          <div className="font-semibold text-slate-100 text-sm flex items-center gap-2">
            <Download className="w-4 h-4 text-amber-500" /> Install this app
          </div>
          <p className="text-xs text-slate-400 mt-1.5">Adds a shortcut icon — open it directly, no browser or link needed.</p>
          <button
            onClick={handleInstallClick}
            className="mt-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-medium px-3 py-2 rounded-lg cursor-pointer"
          >
            Install
          </button>
        </div>
      )}
    </div>
  );
}
