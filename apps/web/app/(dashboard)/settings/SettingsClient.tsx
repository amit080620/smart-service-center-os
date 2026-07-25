'use client';

import { useState, useRef, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Upload, Image as ImageIcon, FileText } from 'lucide-react';

export default function SettingsClient({
  orgName,
  currentLogoUrl,
  contactPhone,
  contactEmail,
  address,
  gstNumber,
  invoiceFooterText,
  canManage
}: {
  orgName: string;
  currentLogoUrl: string | null;
  contactPhone: string;
  contactEmail: string;
  address: string;
  gstNumber: string;
  invoiceFooterText: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSuccess, setLogoSuccess] = useState(false);

  const [phone, setPhone] = useState(contactPhone);
  const [email, setEmail] = useState(contactEmail);
  const [addr, setAddr] = useState(address);
  const [gst, setGst] = useState(gstNumber);
  const [footerText, setFooterText] = useState(invoiceFooterText);
  const [detailsSubmitting, setDetailsSubmitting] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsSuccess, setDetailsSuccess] = useState(false);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLogoError(null);
    setLogoSuccess(false);
    setUploading(true);

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/organization/logo', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      setLogoError(data.error?.message ?? 'Could not upload logo.');
      setUploading(false);
      setPreview(currentLogoUrl);
      return;
    }

    setPreview(data.logoUrl);
    setUploading(false);
    setLogoSuccess(true);
    router.refresh();
  }

  async function handleDetailsSubmit(e: FormEvent) {
    e.preventDefault();
    setDetailsSubmitting(true);
    setDetailsError(null);
    setDetailsSuccess(false);

    const res = await fetch('/api/organization/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactPhone: phone,
        contactEmail: email,
        address: addr,
        gstNumber: gst,
        invoiceFooterText: footerText
      })
    });
    const data = await res.json();

    if (!res.ok) {
      setDetailsError(data.error?.message ?? 'Could not update settings.');
      setDetailsSubmitting(false);
      return;
    }

    setDetailsSubmitting(false);
    setDetailsSuccess(true);
    router.refresh();
  }

  if (!canManage) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
        <div className="max-w-2xl mx-auto text-center text-slate-500 text-sm mt-12">
          Only the org owner can access organization settings.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-amber-500" />
            Organization Settings
          </h1>
          <p className="text-sm text-slate-500 mt-1">{orgName}</p>
        </div>

        {/* Logo */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-sm mb-1">Business Logo</h2>
            <p className="text-xs text-slate-500">
              Shown on printed invoices and estimates (A4 and thermal). PNG, JPEG, WEBP, or SVG — up to 2MB.
            </p>
          </div>

          {logoError && (
            <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{logoError}</div>
          )}
          {logoSuccess && (
            <div className="bg-emerald-950/40 border border-emerald-900 text-emerald-200 text-xs rounded-xl p-3">
              Logo updated.
            </div>
          )}

          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Business logo" className="w-full h-full object-contain" />
              ) : (
                <ImageIcon className="w-8 h-8 text-slate-700" />
              )}
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploading}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2 rounded-xl text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                {uploading ? 'Uploading...' : preview ? 'Change Logo' : 'Upload Logo'}
              </button>
            </div>
          </div>
        </div>

        {/* Invoice header/footer details */}
        <form onSubmit={handleDetailsSubmit} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-sm mb-1 flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-500" /> Invoice Header & Footer
            </h2>
            <p className="text-xs text-slate-500">
              These details appear on every printed invoice and estimate — header (contact info, GST) and footer (custom message).
            </p>
          </div>

          {detailsError && (
            <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{detailsError}</div>
          )}
          {detailsSuccess && (
            <div className="bg-emerald-950/40 border border-emerald-900 text-emerald-200 text-xs rounded-xl p-3">
              Settings saved.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Contact Phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={detailsSubmitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Contact Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={detailsSubmitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Business Address</label>
              <input
                value={addr}
                onChange={(e) => setAddr(e.target.value)}
                disabled={detailsSubmitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">GST Number</label>
              <input
                value={gst}
                onChange={(e) => setGst(e.target.value)}
                disabled={detailsSubmitting}
                placeholder="e.g. 27AAAAA0000A1Z5"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50 font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Invoice Footer Text (optional)</label>
              <textarea
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                disabled={detailsSubmitting}
                rows={2}
                placeholder="e.g. Thank you for choosing us! Terms: payment due within 7 days."
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50 resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={detailsSubmitting}
            className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-medium px-4 py-2.5 rounded-xl text-sm cursor-pointer disabled:opacity-50"
          >
            {detailsSubmitting ? 'Saving...' : 'Save Details'}
          </button>
        </form>
      </div>
    </div>
  );
}
