'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Upload, Image as ImageIcon } from 'lucide-react';

export default function SettingsClient({
  orgName,
  currentLogoUrl,
  canManage
}: {
  orgName: string;
  currentLogoUrl: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(false);
    setUploading(true);

    // Show an immediate local preview while the real upload runs, so the
    // person doesn't stare at the old logo wondering if their click
    // registered.
    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/organization/logo', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error?.message ?? 'Could not upload logo.');
      setUploading(false);
      setPreview(currentLogoUrl);
      return;
    }

    setPreview(data.logoUrl);
    setUploading(false);
    setSuccess(true);
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

        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-sm mb-1">Business Logo</h2>
            <p className="text-xs text-slate-500">
              Shown on printed invoices (A4 and thermal). PNG, JPEG, WEBP, or SVG — up to 2MB.
            </p>
          </div>

          {error && (
            <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-3">{error}</div>
          )}
          {success && (
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
      </div>
    </div>
  );
}
