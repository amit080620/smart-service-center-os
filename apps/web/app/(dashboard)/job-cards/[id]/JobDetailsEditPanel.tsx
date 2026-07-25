'use client';

import { useState, type FormEvent } from 'react';
import { Pencil, ShieldCheck } from 'lucide-react';

interface JobDetailsData {
  id: string;
  notes: string;
  odometer_in: number;
  is_insurance_claim: boolean;
  insurance_company: string;
  insurance_claim_number: string;
  insurance_approved_amount: number | null;
}

export default function JobDetailsEditPanel({
  job,
  canEdit,
  onSaved
}: {
  job: JobDetailsData;
  canEdit: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState(job.notes);
  const [odometerIn, setOdometerIn] = useState(String(job.odometer_in));
  const [isInsuranceClaim, setIsInsuranceClaim] = useState(job.is_insurance_claim);
  const [insuranceCompany, setInsuranceCompany] = useState(job.insurance_company);
  const [insuranceClaimNumber, setInsuranceClaimNumber] = useState(job.insurance_claim_number);
  const [insuranceApprovedAmount, setInsuranceApprovedAmount] = useState(
    job.insurance_approved_amount !== null ? String(job.insurance_approved_amount) : ''
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/job-cards/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notes,
        odometerIn: Number(odometerIn) || 0,
        isInsuranceClaim,
        insuranceCompany,
        insuranceClaimNumber,
        insuranceApprovedAmount: insuranceApprovedAmount ? Number(insuranceApprovedAmount) : null
      })
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not update job details.');
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setEditing(false);
    onSaved();
  }

  if (!canEdit) return null;

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer"
      >
        <Pencil className="w-3 h-3" /> Edit Notes / Odometer / Insurance
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4 animate-fadeIn">
      {error && <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={submitting}
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Odometer In (km)</label>
          <input
            type="number"
            value={odometerIn}
            onChange={(e) => setOdometerIn(e.target.value)}
            disabled={submitting}
            min="0"
            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
          />
        </div>
      </div>

      <div className="border-t border-slate-800 pt-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isInsuranceClaim}
            onChange={(e) => setIsInsuranceClaim(e.target.checked)}
            disabled={submitting}
            className="w-4 h-4 accent-amber-500"
          />
          <span className="text-sm font-medium text-slate-200 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-500" /> This is an insurance claim job
          </span>
        </label>

        {isInsuranceClaim && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3 animate-fadeIn">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Insurance Company</label>
              <input
                value={insuranceCompany}
                onChange={(e) => setInsuranceCompany(e.target.value)}
                disabled={submitting}
                placeholder="e.g. ICICI Lombard"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Claim Number</label>
              <input
                value={insuranceClaimNumber}
                onChange={(e) => setInsuranceClaimNumber(e.target.value)}
                disabled={submitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Approved Amount (₹)</label>
              <input
                type="number"
                value={insuranceApprovedAmount}
                onChange={(e) => setInsuranceApprovedAmount(e.target.value)}
                disabled={submitting}
                min="0"
                placeholder="Optional, once known"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2.5 rounded-xl text-sm cursor-pointer disabled:opacity-50"
        >
          {submitting ? 'Saving...' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="text-slate-500 hover:text-slate-300 px-4 py-2.5 text-sm cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
