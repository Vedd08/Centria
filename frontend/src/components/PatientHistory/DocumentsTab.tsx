import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { AuthenticatedImage } from '../common/AuthenticatedImage';
import { FileText, ImagePlus, Upload, X, Camera, Smartphone, CheckCircle2, RefreshCw } from 'lucide-react';
import { compressImage, photoTitle } from '../../utils/compressImage';
import { fmtDate } from '../../utils/date';

interface DocumentItem {
  id: string;
  category: string;
  title: string;
  description?: string;
  fileName: string;
  mimeType: string;
  createdAt: string;
  uploadedBy?: { name: string; role: string };
}

const CATEGORY_LABELS: Record<string, string> = {
  LAB_REPORT: 'Lab Report',
  SCAN_IMAGE: 'Scan / Image',
  PRESCRIPTION_SCAN: 'Prescription Scan',
  DISCHARGE_SUMMARY: 'Discharge Summary',
  OTHER: 'Other',
};

interface DocumentsTabProps {
  patientId: string;
  /** When rendered inside an admission's chart, new uploads auto-link to it. */
  admissionId?: string;
  /** When rendered inside an OPD visit context, new uploads auto-link to it. */
  visitId?: string;
}

const inputClass =
  'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

export const DocumentsTab: React.FC<DocumentsTabProps> = ({ patientId, admissionId, visitId }) => {
  const { apiFetch, hasRole } = useAuth();
  const { addToast } = useToast();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [file, setFile] = useState<File | null>(null);

  const canUpload = hasRole('DOCTOR', 'NURSE', 'RECEPTION');
  // Phones and tablets get the camera button; laptops/desktops get the QR code to
  // hand the job to a phone. A touch-screen laptop still has a fine pointer → QR.
  const isTouchDevice = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const cameraRef = useRef<HTMLInputElement>(null);
  const [capturing, setCapturing] = useState(false);

  const [qr, setQr] = useState<{ image: string; expiresAt: number } | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrBaseline, setQrBaseline] = useState(0);
  const [now, setNow] = useState(Date.now());

  const fetchDocuments = async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const params = new URLSearchParams({ patientId });
      const res = await apiFetch(`/api/patient-documents?${params}`);
      if (!res.ok) throw new Error('Failed to load documents');
      const data: DocumentItem[] = await res.json();
      setDocuments(data);
      return data;
    } catch (err: any) {
      if (!opts?.silent) addToast('error', err.message || 'Failed to load documents');
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  };

  /** Phone/tablet camera: the photo uploads the moment it is taken. */
  const uploadCapturedPhoto = async (picked: File | undefined) => {
    if (!picked) return;
    setCapturing(true);
    try {
      const photo = await compressImage(picked);
      const formData = new FormData();
      formData.append('file', photo);
      formData.append('patientId', patientId);
      formData.append('category', 'SCAN_IMAGE');
      formData.append('title', photoTitle());
      if (admissionId) formData.append('admissionId', admissionId);
      else if (visitId) formData.append('visitId', visitId);
      const res = await apiFetch('/api/patient-documents', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(err.message || 'Upload failed');
      }
      addToast('success', 'Photo uploaded');
      fetchDocuments({ silent: true });
    } catch (err: any) {
      addToast('error', err.message || 'Upload failed');
    } finally {
      setCapturing(false);
    }
  };

  /** Laptop: show a QR code that opens a camera page on a phone for this patient. */
  const openQr = async () => {
    setQrOpen(true);
    setQrLoading(true);
    try {
      const res = await apiFetch('/api/patient-documents/upload-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId, admissionId, visitId: admissionId ? undefined : visitId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not create the QR code');
      const url = `${window.location.origin}/?upload=${encodeURIComponent(data.token)}`;
      const image = await QRCode.toDataURL(url, { width: 260, margin: 1 });
      setQr({ image, expiresAt: new Date(data.expiresAt).getTime() });
      setQrBaseline(documents.length);
    } catch (err: any) {
      addToast('error', err.message || 'Could not create the QR code');
      setQrOpen(false);
    } finally {
      setQrLoading(false);
    }
  };

  // While the QR code is open, pick up photos arriving from the phone.
  useEffect(() => {
    if (!qrOpen) return;
    const poll = setInterval(() => {
      fetchDocuments({ silent: true });
      setNow(Date.now());
    }, 4000);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrOpen, patientId]);

  const qrExpired = !!qr && now >= qr.expiresAt;
  const receivedFromPhone = Math.max(0, documents.length - qrBaseline);

  useEffect(() => {
    fetchDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      addToast('error', 'Please choose a file to upload');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', await compressImage(file));
      formData.append('patientId', patientId);
      formData.append('category', category);
      formData.append('title', title.trim() || file.name);
      if (admissionId) formData.append('admissionId', admissionId);
      else if (visitId) formData.append('visitId', visitId);

      // No Content-Type header here — letting the browser set the multipart boundary
      // is required for the upload to parse correctly on the server.
      const res = await apiFetch('/api/patient-documents', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Upload failed' }));
        throw new Error(err.message || 'Upload failed');
      }
      addToast('success', 'Document uploaded');
      setShowUpload(false);
      setTitle('');
      setCategory('OTHER');
      setFile(null);
      fetchDocuments();
    } catch (err: any) {
      addToast('error', err.message || 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {canUpload && (
        <div className="flex flex-wrap justify-end gap-2">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              uploadCapturedPhoto(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          {isTouchDevice ? (
            <button
              onClick={() => cameraRef.current?.click()}
              disabled={capturing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{capturing ? 'Uploading photo...' : 'Take Photo'}</span>
            </button>
          ) : (
            <button
              onClick={openQr}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer"
              title="Show a QR code — scan it with a phone to take photos for this patient"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Use phone (QR)</span>
            </button>
          )}
          {!showUpload && (
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-ink-primary bg-surface-card hover:bg-surface-page border border-border rounded-md transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload File</span>
            </button>
          )}
        </div>
      )}

      {qrOpen && (
        <div className="bg-surface-page p-4 rounded-lg border border-brand/30 flex flex-col sm:flex-row items-center gap-5">
          <div className="w-[200px] h-[200px] shrink-0 rounded-lg bg-white border border-border flex items-center justify-center overflow-hidden">
            {qrLoading || !qr ? (
              <RefreshCw className="w-6 h-6 animate-spin text-brand" />
            ) : qrExpired ? (
              <button onClick={openQr} className="text-xs font-medium text-brand underline cursor-pointer">
                Code expired — get a new one
              </button>
            ) : (
              <img src={qr.image} alt="QR code to upload photos from a phone" className="w-full h-full" />
            )}
          </div>
          <div className="flex-1 space-y-2 text-xs">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-ink-primary">Take photos with a phone</p>
              <button onClick={() => setQrOpen(false)} className="p-1 rounded text-ink-secondary hover:text-ink-primary cursor-pointer" title="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="list-decimal pl-4 space-y-1 text-ink-secondary">
              <li>Open the camera on any phone or tablet and point it at this code.</li>
              <li>Tap the link that appears — no login needed.</li>
              <li>Press <span className="font-semibold text-ink-primary">Take Photo</span>. Each photo appears here automatically.</li>
            </ol>
            {receivedFromPhone > 0 && (
              <p className="flex items-center gap-1.5 font-semibold text-status-success">
                <CheckCircle2 className="w-4 h-4" /> {receivedFromPhone} received from the phone
              </p>
            )}
            {qr && !qrExpired && (
              <p className="text-[11px] text-ink-secondary/80">
                Works for this patient only, until{' '}
                {new Date(qr.expiresAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}.
              </p>
            )}
          </div>
        </div>
      )}

      {showUpload && (
        <form onSubmit={handleUpload} className="bg-surface-page p-4 rounded-lg border border-border space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-primary">Upload document</span>
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="p-1 rounded text-ink-secondary hover:text-ink-primary cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Pre-treatment skin photo"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              File <span className="text-status-danger">*</span>
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs text-ink-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-border file:text-xs file:font-medium file:bg-surface-card file:cursor-pointer cursor-pointer"
            />
            <p className="text-[11px] text-ink-secondary/70 mt-1">JPEG, PNG, WEBP or PDF, up to 10MB.</p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowUpload(false)}
              className="px-3.5 py-1.5 text-xs font-medium text-ink-primary bg-surface-card hover:bg-surface-page/80 border border-border rounded-md cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-3.5 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <LoadingSkeleton rows={2} />
      ) : documents.length === 0 ? (
        <div className="text-ink-secondary text-xs py-8 text-center bg-surface-page rounded-lg border border-border">
          No documents uploaded for this patient yet.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {documents.map((doc) => {
            const isImage = doc.mimeType.startsWith('image/');
            const fileUrl = `/api/patient-documents/${doc.id}/file`;
            return (
              <div key={doc.id} className="bg-surface-page rounded-lg border border-border overflow-hidden">
                {isImage ? (
                  <AuthenticatedImage src={fileUrl} alt={doc.title} className="w-full h-28 object-cover" />
                ) : (
                  <button
                    onClick={async () => {
                      const res = await apiFetch(fileUrl);
                      const blob = await res.blob();
                      window.open(URL.createObjectURL(blob), '_blank');
                    }}
                    className="w-full h-28 flex items-center justify-center bg-surface-card text-ink-secondary cursor-pointer"
                  >
                    <FileText className="w-8 h-8" />
                  </button>
                )}
                <div className="p-2.5 space-y-0.5">
                  <p className="text-xs font-medium text-ink-primary truncate" title={doc.title}>
                    {doc.title}
                  </p>
                  <p className="text-[11px] text-ink-secondary">{CATEGORY_LABELS[doc.category] || doc.category}</p>
                  {doc.uploadedBy && (
                    <p className="text-[10px] text-ink-secondary/70">
                      by {doc.uploadedBy.name} &bull; {fmtDate(doc.createdAt)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!canUpload && documents.length === 0 && !loading && (
        <p className="text-[11px] text-ink-secondary/70 flex items-center gap-1.5">
          <ImagePlus className="w-3.5 h-3.5" /> Your role cannot upload documents for this patient.
        </p>
      )}
    </div>
  );
};
