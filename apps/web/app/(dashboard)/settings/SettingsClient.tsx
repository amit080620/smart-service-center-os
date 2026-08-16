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
  currentHeaderImageUrl,
  currentFooterImageUrl,
  thermalPrinterIp,
  thermalPaperWidth,
  canManage
}: {
  orgName: string;
  currentLogoUrl: string | null;
  contactPhone: string;
  contactEmail: string;
  address: string;
  gstNumber: string;
  invoiceFooterText: string;
  currentHeaderImageUrl: string | null;
  currentFooterImageUrl: string | null;
  thermalPrinterIp: string;
  thermalPaperWidth: 58 | 80;
  canManage: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const footerInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoSuccess, setLogoSuccess] = useState(false);

  const [headerPreview, setHeaderPreview] = useState<string | null>(currentHeaderImageUrl);
  const [footerPreview, setFooterPreview] = useState<string | null>(currentFooterImageUrl);
  const [headerUploading, setHeaderUploading] = useState(false);
  const [footerUploading, setFooterUploading] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const [footerError, setFooterError] = useState<string | null>(null);

  const [phone, setPhone] = useState(contactPhone);
  const [email, setEmail] = useState(contactEmail);
  const [addr, setAddr] = useState(address);
  const [gst, setGst] = useState(gstNumber);
  const [footerText, setFooterText] = useState(invoiceFooterText);
  const [printerIp, setPrinterIp] = useState(thermalPrinterIp);
  const [paperWidth, setPaperWidth] = useState<58 | 80>(thermalPaperWidth);
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

  async function handleHeaderFooterUpload(kind: 'header' | 'footer', file: File) {
    const setUploadingFn = kind === 'header' ? setHeaderUploading : setFooterUploading;
    const setErrorFn = kind === 'header' ? setHeaderError : setFooterError;
    const setPreviewFn = kind === 'header' ? setHeaderPreview : setFooterPreview;
    const fallback = kind === 'header' ? currentHeaderImageUrl : currentFooterImageUrl;

    setErrorFn(null);
    setUploadingFn(true);
    setPreviewFn(URL.createObjectURL(file));

    const formData = new FormData();
    formData.append('file', file);
    formData.append('kind', kind);

    const res = await fetch('/api/organization/invoice-image', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      setErrorFn(data.error?.message ?? `Could not upload ${kind} image.`);
      setUploadingFn(false);
      setPreviewFn(fallback);
      return;
    }

    setPreviewFn(data.imageUrl);
    setUploadingFn(false);
    router.refresh();
  }

  async function handleRemoveImage(kind: 'header' | 'footer') {
    const setUploadingFn = kind === 'header' ? setHeaderUploading : setFooterUploading;
    const setErrorFn = kind === 'header' ? setHeaderError : setFooterError;
    const setPreviewFn = kind === 'header' ? setHeaderPreview : setFooterPreview;

    setUploadingFn(true);
    setErrorFn(null);
    const res = await fetch('/api/organization/invoice-image', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind })
    });
    if (!res.ok) {
      const data = await res.json();
      setErrorFn(data.error?.message ?? `Could not remove ${kind} image.`);
      setUploadingFn(false);
      return;
    }
    setPreviewFn(null);
    setUploadingFn(false);
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
        invoiceFooterText: footerText,
        thermalPrinterIp: printerIp,
        thermalPaperWidth: paperWidth
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

        {/* A4 letterhead header/footer images */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-5">
          <div>
            <h2 className="font-semibold text-sm mb-1">A4 Print — Custom Header & Footer Images</h2>
            <p className="text-xs text-slate-500">
              For shops that print on pre-designed letterhead paper, or want a fully custom branded band (shop photo,
              service list, ad banner) instead of the plain text header/footer. <strong className="text-slate-400">Only affects the A4
              print</strong> — the thermal (72mm) print always stays plain text, since a receipt-width printout has no
              room for a banner image.
            </p>
            <div className="mt-2 text-xs text-slate-500 bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1">
              <div><strong className="text-slate-400">Format:</strong> PNG, JPEG, or WEBP — up to 3MB</div>
              <div><strong className="text-slate-400">Width:</strong> at least 1600px wide (it's scaled to fit the page automatically)</div>
              <div><strong className="text-slate-400">Header height:</strong> keep it compact — under ~300px tall, so there's still room for the invoice itself</div>
              <div><strong className="text-slate-400">Footer height:</strong> under ~200px tall works best</div>
              <div>If you upload one, it fully replaces the plain text version for that spot (e.g. uploading a header image hides the logo/business-name text block, since your image already shows that).</div>
            </div>
          </div>

          {/* Header image */}
          <div className="space-y-2">
            <div className="text-xs font-mono text-slate-400 uppercase">Header Image</div>
            {headerError && <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-2">{headerError}</div>}
            <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
              {headerPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={headerPreview} alt="Invoice header" className="w-full h-auto max-h-32 object-contain bg-white" />
              ) : (
                <div className="h-16 flex items-center justify-center text-slate-700 text-xs">No header image — plain text header will print</div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={headerInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => e.target.files?.[0] && handleHeaderFooterUpload('header', e.target.files[0])}
                className="hidden"
                disabled={headerUploading}
              />
              <button
                onClick={() => headerInputRef.current?.click()}
                disabled={headerUploading}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-3 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                {headerUploading ? 'Uploading...' : headerPreview ? 'Change Header Image' : 'Upload Header Image'}
              </button>
              {headerPreview && (
                <button
                  onClick={() => handleRemoveImage('header')}
                  disabled={headerUploading}
                  className="text-red-400 hover:text-red-300 text-xs px-3 py-2 cursor-pointer disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Footer image */}
          <div className="space-y-2">
            <div className="text-xs font-mono text-slate-400 uppercase">Footer Image</div>
            {footerError && <div className="bg-red-950/40 border border-red-900 text-red-200 text-xs rounded-xl p-2">{footerError}</div>}
            <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
              {footerPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={footerPreview} alt="Invoice footer" className="w-full h-auto max-h-24 object-contain bg-white" />
              ) : (
                <div className="h-16 flex items-center justify-center text-slate-700 text-xs">No footer image — plain text footer will print</div>
              )}
            </div>
            <div className="flex gap-2">
              <input
                ref={footerInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => e.target.files?.[0] && handleHeaderFooterUpload('footer', e.target.files[0])}
                className="hidden"
                disabled={footerUploading}
              />
              <button
                onClick={() => footerInputRef.current?.click()}
                disabled={footerUploading}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium px-3 py-2 rounded-xl text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Upload className="w-3.5 h-3.5" />
                {footerUploading ? 'Uploading...' : footerPreview ? 'Change Footer Image' : 'Upload Footer Image'}
              </button>
              {footerPreview && (
                <button
                  onClick={() => handleRemoveImage('footer')}
                  disabled={footerUploading}
                  className="text-red-400 hover:text-red-300 text-xs px-3 py-2 cursor-pointer disabled:opacity-50"
                >
                  Remove
                </button>
              )}
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
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Network Printer IP (optional)</label>
              <input
                value={printerIp}
                onChange={(e) => setPrinterIp(e.target.value)}
                disabled={detailsSubmitting}
                placeholder="e.g. 192.168.1.50"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50 font-mono"
              />
              <p className="text-xs text-slate-500 mt-1">Only if your thermal printer connects via WiFi/LAN, not Bluetooth.</p>
            </div>
            <div>
              <label className="block text-xs font-mono text-slate-400 mb-1.5 uppercase">Thermal Paper Width</label>
              <select
                value={paperWidth}
                onChange={(e) => setPaperWidth(Number(e.target.value) as 58 | 80)}
                disabled={detailsSubmitting}
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded-xl py-2.5 px-3 text-sm outline-none disabled:opacity-50"
              >
                <option value={58}>58mm (most common)</option>
                <option value={80}>80mm</option>
              </select>
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
