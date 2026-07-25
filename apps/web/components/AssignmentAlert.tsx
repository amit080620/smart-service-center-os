'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Check } from 'lucide-react';

interface Assignment {
  id: string;
  job_number: string;
  vehicle_label: string;
  customer_name: string;
}

const POLL_INTERVAL_MS = 10000;

// Persistent job-assignment alert — polls for jobs assigned to the
// current employee that they haven't acknowledged yet, and if any exist,
// shows a full-screen alert with a looping tone that only stops once
// they tap Accept. Lives in the dashboard layout so it fires regardless
// of which page the technician is currently on.
//
// Honest limitation: this only works while this browser tab is open and
// the device isn't asleep — it's a plain polling + Web Audio approach,
// not a real push notification. Actual "wakes the phone even if the app
// is closed" alerts need a proper PWA + push-notification service set up
// separately; this is the browser-tab-open version of the same idea.
export default function AssignmentAlert() {
  const [pending, setPending] = useState<Assignment[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const soundEnabledRef = useRef(false);

  async function poll() {
    try {
      const res = await fetch('/api/my-assignments');
      if (!res.ok) return;
      const data = await res.json();
      setPending(data);
    } catch {
      // Silent — a failed poll just tries again next interval, no need
      // to interrupt the person with a network-error toast for this.
    }
  }

  useEffect(() => {
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  function startAlertTone() {
    if (oscillatorRef.current) return; // already playing
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.15;
      osc.connect(gain).connect(ctx.destination);

      // Pulse the tone on/off rather than a flat continuous beep — reads
      // as an "alert" rather than a single dull tone.
      let on = true;
      const pulse = setInterval(() => {
        gain.gain.value = on ? 0.15 : 0;
        on = !on;
      }, 400);
      osc.start();
      oscillatorRef.current = osc;
      (osc as any)._pulseInterval = pulse;
    } catch {
      // Browsers block audio until the user has interacted with the page
      // at least once — soundEnabledRef handles that below.
    }
  }

  function stopAlertTone() {
    if (oscillatorRef.current) {
      clearInterval((oscillatorRef.current as any)._pulseInterval);
      oscillatorRef.current.stop();
      oscillatorRef.current = null;
    }
  }

  useEffect(() => {
    function enableSoundOnFirstInteraction() {
      soundEnabledRef.current = true;
      if (pending.length > 0) startAlertTone();
    }
    document.addEventListener('click', enableSoundOnFirstInteraction, { once: true });
    return () => document.removeEventListener('click', enableSoundOnFirstInteraction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (pending.length > 0 && soundEnabledRef.current) {
      startAlertTone();
    } else if (pending.length === 0) {
      stopAlertTone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.length]);

  async function handleAccept(jobId: string) {
    setAccepting(jobId);
    const res = await fetch(`/api/job-cards/${jobId}/accept-assignment`, { method: 'POST' });
    if (res.ok) {
      setPending((prev) => prev.filter((p) => p.id !== jobId));
    }
    setAccepting(null);
  }

  if (pending.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border-2 border-amber-500 rounded-2xl p-6 max-w-sm w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-amber-500 flex items-center justify-center mx-auto animate-pulse">
          <Bell className="w-7 h-7 text-slate-950" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100">New Job Assigned</h2>
          <p className="text-xs text-slate-500 mt-1">Accept to stop this alert.</p>
        </div>
        <div className="space-y-2">
          {pending.map((job) => (
            <div key={job.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-left">
              <div className="font-mono text-amber-500 font-semibold text-sm">{job.job_number}</div>
              <div className="text-xs text-slate-400 mt-0.5">
                {job.customer_name} · {job.vehicle_label}
              </div>
              <button
                onClick={() => handleAccept(job.id)}
                disabled={accepting === job.id}
                className="w-full mt-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium py-2 rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                {accepting === job.id ? 'Accepting...' : 'Accept'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
