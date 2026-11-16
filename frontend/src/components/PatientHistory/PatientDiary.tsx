import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { LoadingSkeleton } from '../common/LoadingSkeleton';
import { compressImage } from '../../utils/compressImage';
import { fmtDate, fmtDateTime } from '../../utils/date';
import {
  ArrowUp, ArrowRight, ArrowDown, Camera, ImagePlus, X, Trash2, ChevronLeft, ChevronRight, NotebookPen, Plus, Columns2,
} from 'lucide-react';

interface DiaryEntry {
  id: string;
  visitDate: string;
  purchaseId?: string | null;
  packageName?: string | null;
  treatmentName?: string | null;
  sittingNumber?: number | null;
  totalSittings?: number | null;
  progress?: 'BETTER' | 'SAME' | 'WORSE' | null;
  notes: string;
  reaction?: string | null;
  createdAt: string;
  createdBy: { id: string; name: string; role: string };
  photos: { id: string }[];
}

interface DiaryContext {
  date: string;
  treatments: {
    purchaseItemId: string; purchaseId: string; packageName: string; treatmentName: string;
    sittingNumber: number; totalSittings: number; today: boolean; active: boolean;
  }[];
  procedures: string[];
}

const MAX_PHOTOS = 6;
const GENERAL = 'General';

const PROGRESS: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  BETTER: { label: 'Better', icon: ArrowUp, cls: 'bg-status-success/10 text-status-success border-status-success/30' },
  SAME: { label: 'Same', icon: ArrowRight, cls: 'bg-surface-page text-ink-secondary border-border' },
  WORSE: { label: 'Worse', icon: ArrowDown, cls: 'bg-status-danger/10 text-status-danger border-status-danger/30' },
};

const sittingLabel = (e: { sittingNumber?: number | null; totalSittings?: number | null }) =>
  e.sittingNumber ? `Sitting ${e.sittingNumber}${e.totalSittings ? ` of ${e.totalSittings}` : ''}` : null;

// Photos need the auth header, so they're fetched as blobs; kept for the session.
const photoCache = new Map<string, string>();

const DiaryPhoto: React.FC<{ id: string; className?: string; alt?: string; onClick?: () => void }> = ({ id, className, alt, onClick }) => {
  const { apiFetch } = useAuth();
  const [src, setSrc] = useState<string | null>(photoCache.get(id) ?? null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (photoCache.has(id)) { setSrc(photoCache.get(id)!); return; }
    let alive = true;
    apiFetch(`/api/patient-diary/photos/${id}`)
      .then((r) => (r.ok ? r.blob() : Promise.reject()))
      .then((b) => {
        const url = URL.createObjectURL(b);
        photoCache.set(id, url);
        if (alive) setSrc(url);
      })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [id, apiFetch]);
  if (failed) return <div className={`${className} flex items-center justify-center bg-surface-page text-[10px] text-ink-secondary`}>Photo unavailable</div>;
  if (!src) return <div className={`${className} animate-pulse bg-surface-page`} />;
  return <img src={src} alt={alt || 'Diary photo'} className={`${className} object-cover ${onClick ? 'cursor-zoom-in' : ''}`} onClick={onClick} />;
};

interface PatientDiaryProps {
  patientId: string;
  /** Today's visit — entries written here are tied to it and its sitting. */
  queueId?: string;
  /** Open the "new entry" form straight away (e.g. a patient here for a sitting). */
  startWriting?: boolean;
}

export const PatientDiary: React.FC<PatientDiaryProps> = ({ patientId, queueId, startWriting }) => {
  const { apiFetch, hasRole, user } = useAuth();
  const { addToast } = useToast();
  const canWrite = hasRole('NURSE', 'STAFF', 'DOCTOR');
  const isAdmin = user?.role === 'MASTER' || user?.role === 'SUPER_ADMIN';

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [viewer, setViewer] = useState<{ photos: { id: string; caption: string }[]; index: number } | null>(null);

  // --- New entry form ---
  const [writing, setWriting] = useState(!!startWriting && canWrite);
  const [ctx, setCtx] = useState<DiaryContext | null>(null);
  const [subject, setSubject] = useState(''); // item:<id> | proc:<name> | ''
  const [progress, setProgress] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [reaction, setReaction] = useState('');
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/patient-diary?patientId=${patientId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not load the diary');
      setEntries(data);
    } catch (err: any) {
      addToast('error', err.message || 'Could not load the diary');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiFetch, patientId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!writing || ctx) return;
    const params = new URLSearchParams({ patientId });
    if (queueId) params.set('queueId', queueId);
    apiFetch(`/api/patient-diary/context?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: DiaryContext | null) => {
        if (!d) return;
        setCtx(d);
        // Default to today's sitting, else today's procedure.
        const todays = d.treatments.find((t) => t.today);
        if (todays) setSubject(`item:${todays.purchaseItemId}`);
        else if (d.procedures[0]) setSubject(`proc:${d.procedures[0]}`);
      })
      .catch(() => {});
  }, [writing, ctx, patientId, queueId, apiFetch]);

  // Release previews when the form is cleared or closed.
  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), [files]);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list).filter((f) => f.type.startsWith('image/'));
    const room = MAX_PHOTOS - files.length;
    if (picked.length > room) addToast('warning', `Up to ${MAX_PHOTOS} photos per entry — extra ones were left out`);
    setFiles((prev) => [...prev, ...picked.slice(0, Math.max(0, room)).map((file) => ({ file, url: URL.createObjectURL(file) }))]);
  };

  const resetForm = () => {
    setProgress('');
    setNotes('');
    setReaction('');
    setFiles([]);
  };

  const save = async () => {
    if (!notes.trim()) {
      addToast('error', 'Write how the patient is recovering');
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.append('patientId', patientId);
      if (queueId) form.append('queueId', queueId);
      if (subject.startsWith('item:')) form.append('purchaseItemId', subject.slice(5));
      if (subject.startsWith('proc:')) form.append('treatmentName', subject.slice(5));
      if (progress) form.append('progress', progress);
      form.append('notes', notes.trim());
      if (reaction.trim()) form.append('reaction', reaction.trim());
      // Stored in the database, so every photo is shrunk to a sensible size first.
      for (const { file } of files) {
        form.append('photos', await compressImage(file, { maxEdge: 1400, quality: 0.8, minBytes: 300 * 1024 }));
      }
      const res = await apiFetch('/api/patient-diary', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message.join(', ') : data.message || 'Could not save the entry');
      setEntries((prev) => [data, ...prev]);
      addToast('success', `Diary entry saved${files.length ? ` with ${files.length} photo${files.length === 1 ? '' : 's'}` : ''}`);
      resetForm();
      setWriting(false);
      setCtx(null);
    } catch (err: any) {
      addToast('error', err.message || 'Could not save the entry');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entry: DiaryEntry) => {
    if (!window.confirm('Delete this diary entry and its photos?')) return;
    try {
      const res = await apiFetch(`/api/patient-diary/${entry.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Could not delete');
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      addToast('success', 'Diary entry deleted');
    } catch (err: any) {
      addToast('error', err.message || 'Could not delete');
    }
  };

  const today = new Date().toLocaleDateString('en-CA');
  const canDelete = (e: DiaryEntry) => isAdmin || (e.createdBy.id === user?.id && e.createdAt && new Date(e.createdAt).toLocaleDateString('en-CA') === today);

  const topicOf = (e: DiaryEntry) => e.treatmentName || GENERAL;
  const topics = useMemo(() => [...new Set(entries.map(topicOf))], [entries]);
  const shown = filter ? entries.filter((e) => topicOf(e) === filter) : entries;

  // Before / latest: first photo of the oldest entry vs the newest entry, for one treatment.
  const withPhotos = shown.filter((e) => e.photos.length);
  const compare = filter && withPhotos.length >= 2
    ? { first: withPhotos[withPhotos.length - 1], latest: withPhotos[0] }
    : null;

  const captionOf = (e: DiaryEntry) => [fmtDate(e.visitDate), e.treatmentName, sittingLabel(e)].filter(Boolean).join(' · ');
  const openViewer = (photoId: string) => {
    const photos = shown.flatMap((e) => e.photos.map((p) => ({ id: p.id, caption: captionOf(e) })));
    setViewer({ photos, index: Math.max(0, photos.findIndex((p) => p.id === photoId)) });
  };

  useEffect(() => {
    if (!viewer) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setViewer(null);
      if (ev.key === 'ArrowRight') setViewer((v) => v && { ...v, index: Math.min(v.photos.length - 1, v.index + 1) });
      if (ev.key === 'ArrowLeft') setViewer((v) => v && { ...v, index: Math.max(0, v.index - 1) });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer]);

  const inputClass = 'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';
  const selectedTreatment = ctx?.treatments.find((t) => `item:${t.purchaseItemId}` === subject);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-secondary">
          How the patient is recovering, visit by visit — notes and photos for the doctor to follow each treatment.
        </p>
        {canWrite && !writing && (
          <button
            type="button"
            onClick={() => setWriting(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Add diary entry
          </button>
        )}
      </div>

      {writing && (
        <div className="p-4 rounded-lg border border-brand/30 bg-brand-soft/40 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-primary inline-flex items-center gap-1.5">
              <NotebookPen className="w-3.5 h-3.5 text-brand" /> New diary entry{ctx ? ` — ${fmtDate(ctx.date)}` : ''}
            </span>
            <button type="button" onClick={() => { setWriting(false); resetForm(); }} className="p-1 rounded text-ink-secondary hover:text-ink-primary cursor-pointer" title="Close">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Treatment</label>
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass}>
                <option value="">General (not about one treatment)</option>
                {ctx?.treatments.length ? (
                  <optgroup label="Package treatments">
                    {ctx.treatments.map((t) => (
                      <option key={t.purchaseItemId} value={`item:${t.purchaseItemId}`}>
                        {t.today ? '★ ' : ''}{t.treatmentName} — sitting {t.sittingNumber} of {t.totalSittings} ({t.packageName}){!t.active ? ' · finished' : ''}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {ctx?.procedures.length ? (
                  <optgroup label="Today's procedures">
                    {ctx.procedures.map((p) => <option key={p} value={`proc:${p}`}>{p}</option>)}
                  </optgroup>
                ) : null}
              </select>
              {selectedTreatment?.today && <p className="text-[10px] text-brand-deep mt-1">★ Today's sitting</p>}
            </div>

            <div>
              <label className="block text-xs font-semibold text-ink-secondary mb-1">Recovery since last visit</label>
              <div className="flex gap-2">
                {Object.entries(PROGRESS).map(([key, p]) => {
                  const Icon = p.icon;
                  const on = progress === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setProgress(on ? '' : key)}
                      className={`flex-1 inline-flex items-center justify-center gap-1 px-2 py-2 rounded-md border text-xs font-semibold cursor-pointer ${on ? p.cls : 'bg-surface-card border-border text-ink-secondary hover:bg-surface-page'}`}
                    >
                      <Icon className="w-3.5 h-3.5" /> {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Recovery notes <span className="text-status-danger">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="e.g. Redness reduced on both cheeks, mild peeling, patient says itching is less. Treated area healing well."
              className={inputClass}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Reaction / side effects <span className="font-normal text-ink-secondary/70">(optional)</span>
            </label>
            <input value={reaction} onChange={(e) => setReaction(e.target.value)} placeholder="e.g. Mild burning for 10 minutes, settled" className={inputClass} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ink-secondary mb-1">
              Photos <span className="font-normal text-ink-secondary/70">(up to {MAX_PHOTOS} — same angle and light each visit makes them easy to compare)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={f.url} className="relative w-20 h-20 rounded-md overflow-hidden border border-border">
                  <img src={f.url} alt="" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => { URL.revokeObjectURL(prev[i].url); return prev.filter((_, j) => j !== i); })}
                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-black/60 text-white cursor-pointer"
                    title="Remove"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {files.length < MAX_PHOTOS && (
                <>
                  <button type="button" onClick={() => cameraRef.current?.click()} className="w-20 h-20 rounded-md border border-dashed border-brand/40 bg-surface-card text-brand-deep text-[10px] font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-brand-soft">
                    <Camera className="w-5 h-5" /> Take photo
                  </button>
                  <button type="button" onClick={() => galleryRef.current?.click()} className="w-20 h-20 rounded-md border border-dashed border-border bg-surface-card text-ink-secondary text-[10px] font-semibold flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-surface-page">
                    <ImagePlus className="w-5 h-5" /> Choose
                  </button>
                </>
              )}
            </div>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
            <input ref={galleryRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setWriting(false); resetForm(); }} className="px-3.5 py-1.5 text-xs font-medium text-ink-primary bg-surface-card hover:bg-surface-page border border-border rounded-md cursor-pointer">
              Cancel
            </button>
            <button type="button" onClick={save} disabled={saving} className="px-3.5 py-1.5 text-xs font-semibold text-white bg-brand hover:bg-brand-deep rounded-md shadow-xs cursor-pointer disabled:opacity-50">
              {saving ? 'Saving…' : 'Save entry'}
            </button>
          </div>
        </div>
      )}

      {topics.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {['', ...topics].map((t) => (
            <button
              key={t || 'all'}
              type="button"
              onClick={() => setFilter(t)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer ${filter === t ? 'bg-brand text-white border-brand' : 'bg-surface-card text-ink-secondary border-border hover:bg-surface-page'}`}
            >
              {t || `All (${entries.length})`}
            </button>
          ))}
        </div>
      )}

      {compare && (
        <div className="p-3 rounded-lg border border-border bg-surface-page">
          <p className="text-xs font-semibold text-ink-primary mb-2 inline-flex items-center gap-1.5">
            <Columns2 className="w-3.5 h-3.5 text-brand" /> {filter}: first vs latest
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[{ label: 'First', e: compare.first }, { label: 'Latest', e: compare.latest }].map(({ label, e }) => (
              <div key={label}>
                <DiaryPhoto id={e.photos[0].id} className="w-full aspect-[4/3] rounded-md border border-border" onClick={() => openViewer(e.photos[0].id)} />
                <p className="text-[11px] text-ink-secondary mt-1">
                  <span className="font-semibold text-ink-primary">{label}</span> · {captionOf(e)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton rows={2} />
      ) : shown.length === 0 ? (
        <div className="text-ink-secondary text-xs py-8 text-center bg-surface-page rounded-lg border border-border">
          No diary entries yet.{canWrite ? ' Add one after each sitting — a few photos and how the patient is healing.' : ''}
        </div>
      ) : (
        <ol className="relative border-l-2 border-border ml-2 space-y-4">
          {shown.map((e) => {
            const p = e.progress ? PROGRESS[e.progress] : null;
            const PIcon = p?.icon;
            return (
              <li key={e.id} className="ml-4">
                <span className="absolute -left-[7px] mt-1.5 w-3 h-3 rounded-full bg-brand border-2 border-surface-card" />
                <div className="p-3 rounded-lg border border-border bg-surface-card space-y-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-xs font-semibold text-ink-primary">{fmtDate(e.visitDate)}</span>
                    {e.treatmentName && <span className="text-xs text-ink-primary">· {e.treatmentName}</span>}
                    {sittingLabel(e) && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-brand-soft text-brand-deep border border-brand/20">{sittingLabel(e)}</span>
                    )}
                    {e.packageName && <span className="text-[10px] text-ink-secondary">{e.packageName}</span>}
                    {p && PIcon && (
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${p.cls}`}>
                        <PIcon className="w-3 h-3" /> {p.label}
                      </span>
                    )}
                    {canDelete(e) && (
                      <button type="button" onClick={() => remove(e)} className="ml-auto p-1 rounded text-ink-secondary hover:text-status-danger cursor-pointer" title="Delete entry">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-ink-primary whitespace-pre-wrap">{e.notes}</p>
                  {e.reaction && (
                    <p className="text-[11px] text-status-warning"><span className="font-semibold">Reaction:</span> {e.reaction}</p>
                  )}
                  {e.photos.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {e.photos.map((ph) => (
                        <DiaryPhoto key={ph.id} id={ph.id} className="w-20 h-20 sm:w-24 sm:h-24 rounded-md border border-border" onClick={() => openViewer(ph.id)} />
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-ink-faint">
                    {e.createdBy.name} · {fmtDateTime(e.createdAt)}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {viewer && (
        <div className="fixed inset-0 z-[120] bg-black/85 flex flex-col items-center justify-center p-4" onClick={() => setViewer(null)}>
          <button type="button" className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white cursor-pointer" onClick={() => setViewer(null)} title="Close">
            <X className="w-5 h-5" />
          </button>
          <div className="relative max-w-4xl w-full flex items-center justify-center" onClick={(ev) => ev.stopPropagation()}>
            {viewer.index > 0 && (
              <button type="button" className="absolute left-0 p-2 rounded-full bg-white/10 text-white cursor-pointer" onClick={() => setViewer({ ...viewer, index: viewer.index - 1 })} title="Previous">
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}
            <DiaryPhoto key={viewer.photos[viewer.index].id} id={viewer.photos[viewer.index].id} className="max-h-[80vh] max-w-full !object-contain rounded" />
            {viewer.index < viewer.photos.length - 1 && (
              <button type="button" className="absolute right-0 p-2 rounded-full bg-white/10 text-white cursor-pointer" onClick={() => setViewer({ ...viewer, index: viewer.index + 1 })} title="Next">
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>
          <p className="mt-3 text-xs text-white/80">
            {viewer.photos[viewer.index].caption} · {viewer.index + 1} / {viewer.photos.length}
          </p>
        </div>
      )}
    </div>
  );
};
