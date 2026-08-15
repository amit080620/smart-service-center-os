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

// Persistent job-assignment alert.
//
// Sound pattern:
// DING → DING → DING → pause → stronger DING
//
// The alert keeps repeating until the technician accepts the job.
// Audio starts after the first user interaction with the page.

export default function AssignmentAlert() {
  const [pending, setPending] = useState<Assignment[]>([]);
  const [accepting, setAccepting] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const soundEnabledRef = useRef(false);
  const soundTimerRef = useRef<number | null>(null);
  const soundPlayingRef = useRef(false);

  // ---------------------------------------------------------------------------
  // Poll assignments
  // ---------------------------------------------------------------------------

  async function poll() {
    try {
      const res = await fetch('/api/my-assignments');

      if (!res.ok) return;

      const data = await res.json();

      setPending(data);
    } catch {
      // Silent — retry on next poll.
    }
  }

  useEffect(() => {
    poll();

    const interval = setInterval(
      poll,
      POLL_INTERVAL_MS
    );

    return () => {
      clearInterval(interval);
      stopAlertTone();
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Create / reuse AudioContext
  // ---------------------------------------------------------------------------

  function getAudioContext(): AudioContext | null {
    try {
      if (!audioCtxRef.current) {
        const AudioContextClass =
          window.AudioContext ||
          (
            window as unknown as {
              webkitAudioContext: typeof AudioContext;
            }
          ).webkitAudioContext;

        if (!AudioContextClass) {
          return null;
        }

        audioCtxRef.current =
          new AudioContextClass();
      }

      const ctx = audioCtxRef.current;

      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {
          // Browser may require user interaction.
        });
      }

      return ctx;
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Play one louder professional "DING"
  // ---------------------------------------------------------------------------

  function playDing(
    frequency: number,
    volume: number,
    duration: number
  ) {
    const ctx = getAudioContext();

    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      const oscillator =
        ctx.createOscillator();

      const gain =
        ctx.createGain();

      // Professional notification tone.
      oscillator.type = 'sine';

      oscillator.frequency.setValueAtTime(
        frequency,
        now
      );

      // Small pitch rise gives the sound a cleaner
      // notification/chime character.
      oscillator.frequency.exponentialRampToValueAtTime(
        frequency * 1.10,
        now + duration
      );

      oscillator.connect(gain);
      gain.connect(ctx.destination);

      // Start almost silent.
      gain.gain.setValueAtTime(
        0.0001,
        now
      );

      // Faster / stronger attack.
      gain.gain.exponentialRampToValueAtTime(
        volume,
        now + 0.012
      );

      // Smooth but clear fade-out.
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + duration
      );

      oscillator.start(now);

      oscillator.stop(
        now + duration + 0.03
      );
    } catch {
      // Ignore audio errors.
    }
  }

  // ---------------------------------------------------------------------------
  // Alert sequence
  //
  // DING
  // DING
  // DING
  // pause
  // DING! stronger
  // ---------------------------------------------------------------------------

  function playAlertSequence() {
    if (!soundEnabledRef.current) {
      return;
    }

    // -------------------------------------------------------------------------
    // DING 1
    // -------------------------------------------------------------------------

    playDing(
      780,
      0.20,
      0.18
    );

    // -------------------------------------------------------------------------
    // DING 2
    // -------------------------------------------------------------------------

    window.setTimeout(() => {
      if (!soundPlayingRef.current) return;

      playDing(
        780,
        0.20,
        0.18
      );
    }, 260);

    // -------------------------------------------------------------------------
    // DING 3
    // -------------------------------------------------------------------------

    window.setTimeout(() => {
      if (!soundPlayingRef.current) return;

      playDing(
        780,
        0.20,
        0.18
      );
    }, 520);

    // -------------------------------------------------------------------------
    // PAUSE → STRONG DING
    // -------------------------------------------------------------------------

    window.setTimeout(() => {
      if (!soundPlayingRef.current) return;

      playDing(
        1050,
        0.32,
        0.30
      );
    }, 950);
  }

  // ---------------------------------------------------------------------------
  // Start looping alert
  // ---------------------------------------------------------------------------

  function startAlertTone() {
    if (soundPlayingRef.current) {
      return;
    }

    if (!soundEnabledRef.current) {
      return;
    }

    soundPlayingRef.current = true;

    // Play immediately.
    playAlertSequence();

    // Repeat every 2.4 seconds.
    soundTimerRef.current =
      window.setInterval(() => {
        if (!soundPlayingRef.current) {
          return;
        }

        playAlertSequence();
      }, 2400);
  }

  // ---------------------------------------------------------------------------
  // Stop alert
  // ---------------------------------------------------------------------------

  function stopAlertTone() {
    soundPlayingRef.current = false;

    if (soundTimerRef.current !== null) {
      window.clearInterval(
        soundTimerRef.current
      );

      soundTimerRef.current = null;
    }
  }

  // ---------------------------------------------------------------------------
  // Enable sound after first interaction
  // ---------------------------------------------------------------------------

  useEffect(() => {
    function enableSoundOnFirstInteraction() {
      soundEnabledRef.current = true;

      const ctx = getAudioContext();

      if (ctx?.state === 'suspended') {
        ctx.resume().catch(() => {
          // Ignore browser audio restriction.
        });
      }

      if (pending.length > 0) {
        startAlertTone();
      }
    }

    document.addEventListener(
      'click',
      enableSoundOnFirstInteraction,
      {
        once: true,
      }
    );

    return () => {
      document.removeEventListener(
        'click',
        enableSoundOnFirstInteraction
      );
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Start / stop sound based on pending assignments
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (
      pending.length > 0 &&
      soundEnabledRef.current
    ) {
      startAlertTone();
    } else if (
      pending.length === 0
    ) {
      stopAlertTone();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending.length]);

  // ---------------------------------------------------------------------------
  // Accept assignment
  // ---------------------------------------------------------------------------

  async function handleAccept(
    jobId: string
  ) {
    setAccepting(jobId);

    try {
      const res = await fetch(
        `/api/job-cards/${jobId}/accept-assignment`,
        {
          method: 'POST',
        }
      );

      if (res.ok) {
        setPending((prev) =>
          prev.filter(
            (p) => p.id !== jobId
          )
        );
      }
    } catch {
      // Keep assignment visible if accepting failed.
    }

    setAccepting(null);
  }

  // ---------------------------------------------------------------------------
  // No pending assignments
  // ---------------------------------------------------------------------------

  if (pending.length === 0) {
    return null;
  }

  // ---------------------------------------------------------------------------
  // Alert UI
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-slate-900 border-2 border-amber-500 rounded-2xl p-6 max-w-sm w-full text-center space-y-4">

        {/* Bell */}
        <div className="w-14 h-14 rounded-full bg-amber-500 flex items-center justify-center mx-auto animate-pulse">
          <Bell className="w-7 h-7 text-slate-950" />
        </div>

        {/* Header */}
        <div>
          <h2 className="text-lg font-bold text-slate-100">
            New Job Assigned
          </h2>

          <p className="text-xs text-slate-500 mt-1">
            Accept to stop this alert.
          </p>
        </div>

        {/* Jobs */}
        <div className="space-y-2">
          {pending.map((job) => (
            <div
              key={job.id}
              className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-left"
            >
              <div className="font-mono text-amber-500 font-semibold text-sm">
                {job.job_number}
              </div>

              <div className="text-xs text-slate-400 mt-0.5">
                {job.customer_name} ·{' '}
                {job.vehicle_label}
              </div>

              <button
                onClick={() =>
                  handleAccept(job.id)
                }
                disabled={
                  accepting === job.id
                }
                className="w-full mt-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium py-2 rounded-lg text-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-4 h-4" />

                {accepting === job.id
                  ? 'Accepting...'
                  : 'Accept'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}