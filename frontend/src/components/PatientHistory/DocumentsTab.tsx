import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { AuthenticatedImage } from '../common/AuthenticatedImage';
import { FileText, ImagePlus, Upload, X } from 'lucide-react';

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

  const fetchDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ patientId });
      const res = await apiFetch(`/api/patient-documents?${params}`);
      if (!res.ok) throw new Error('Failed to load documents');
      setDocuments(await res.json());
    } catch (err: any) {
      addToast('error', err.message || 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

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
      formData.append('file', file);
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
        <div className="flex justify-end">
          {!showUpload ? (
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Document</span>
            </button>
          ) : null}
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
                      by {doc.uploadedBy.name} &bull; {new Date(doc.createdAt).toLocaleDateString()}
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
