import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, ImagePlus, AlertTriangle, Loader2 } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { compressImage, photoTitle } from '../../utils/compressImage';

interface LinkInfo {
  patientName: string;
  uhid: string;
  clinicName: string;
  expiresAt: string;
}

interface Uploaded {
  id: string;
  name: string;
  previewUrl?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  SCAN_IMAGE: 'Photo / Scan',
  LAB_REPORT: 'Lab Report',
  PRESCRIPTION_SCAN: 'Prescription Scan',
  DISCHARGE_SUMMARY: 'Discharge Summary',
  OTHER: 'Other',
};

/**
 * Opened on a phone by scanning the QR code shown on the computer. No sign-in —
 * the link itself allows adding photos to one patient for a short time. Each photo
 * uploads the moment it is taken, and appears on the computer automatically.
 */
export const MobileUploadPage: React.FC<{ token: string }> = ({ token }) => {
  const [info, setInfo] = useState<LinkInfo | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [category, setCategory] = useState('SCAN_IMAGE');
  const [uploading, setUploading] = useState(0);
  const [uploaded, setUploaded] = useState<Uploaded[]>([]);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/patient-documents/mobile/${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message || 'This link is not valid');
        setInfo(data);
      } catch (err: any) {
        setLinkError(err.message || 'This link is not valid');
      }
    })();
  }, [token]);

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    for (const original of Array.from(files)) {
      setUploading((n) => n + 1);
      try {
        const file = await compressImage(original);
        const form = new FormData();
        form.append('file', file);
        form.append('category', category);
        form.append('title', photoTitle());
        const res = await fetch(`/api/patient-documents/mobile/${encodeURIComponent(token)}`, { method: 'POST', body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (res.status === 401) setLinkError(data.message || 'This link has expired');
          throw new Error(data.message || 'Upload failed');
        }
        setUploaded((prev) => [
          { id: data.id, name: data.title, previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined },
          ...prev,
        ]);
      } catch (err: any) {
        setError(err.message || 'Upload failed — try again');
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  return (
    <div className="min-h-screen bg-surface-page text-ink-primary font-sans">
      <header className="bg-shell px-4 py-3 flex items-center justify-between">
        <BrandLogo className="h-5" tone="onDark" />
        <span className="text-[11px] text-white/70">Document upload</span>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {linkError ? (
          <div className="bg-surface-card border border-status-danger/30 rounded-xl p-6 text-center space-y-2">
            <AlertTriangle className="w-8 h-8 text-status-danger mx-auto" />
            <p className="text-sm font-semibold">{linkError}</p>
            <p className="text-xs text-ink-secondary">Open the patient's Documents tab on the computer and press "Use phone" for a new QR code.</p>
          </div>
        ) : !info ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-brand" />
          </div>
        ) : (
          <>
            <div className="bg-surface-card border border-border rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-wider text-ink-secondary font-semibold">Uploading for</p>
              <p className="text-lg font-semibold leading-tight mt-0.5">{info.patientName}</p>
              <p className="text-xs text-ink-secondary font-mono">{info.uhid}{info.clinicName ? ` · ${info.clinicName}` : ''}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Type</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-surface-card"
              >
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                uploadFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => {
                uploadFiles(e.target.files);
                e.target.value = '';
              }}
            />

            <button
              onClick={() => cameraRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-brand text-white text-base font-semibold shadow-sm active:bg-brand-deep"
            >
              <Camera className="w-5 h-5" /> Take Photo
            </button>
            <button
              onClick={() => galleryRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-card border border-border text-sm font-medium"
            >
              <ImagePlus className="w-4 h-4" /> Choose from gallery
            </button>

            {uploading > 0 && (
              <p className="flex items-center justify-center gap-2 text-xs text-ink-secondary">
                <Loader2 className="w-4 h-4 animate-spin" /> Uploading…
              </p>
            )}
            {error && <p className="text-xs text-status-danger text-center">{error}</p>}

            {uploaded.length > 0 && (
              <div className="bg-surface-card border border-status-success/30 rounded-xl p-3 space-y-2">
                <p className="flex items-center gap-1.5 text-xs font-semibold text-status-success">
                  <CheckCircle2 className="w-4 h-4" /> {uploaded.length} uploaded — they are on the computer now
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {uploaded.map((u) =>
                    u.previewUrl ? (
                      <img key={u.id} src={u.previewUrl} alt={u.name} className="w-full aspect-square object-cover rounded-md border border-border" />
                    ) : (
                      <div key={u.id} className="w-full aspect-square rounded-md border border-border bg-surface-page flex items-center justify-center text-[10px] text-ink-secondary">
                        PDF
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}

            <p className="text-[11px] text-ink-secondary text-center">
              This link stops working at{' '}
              {new Date(info.expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}. You can close this page when done.
            </p>
          </>
        )}
      </main>
    </div>
  );
};
