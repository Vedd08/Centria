import React, { useMemo } from 'react';
import { X, ArrowUp, ArrowDown, ArrowRight, Search, Sparkles, Check } from 'lucide-react';
import { searchTemplates, suggestTemplates } from '../../../utils/templateMatch';

const inputClass = 'w-full px-3 py-2 rounded-md border border-border text-xs bg-surface-card text-ink-primary focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand';

export interface Step1DiagnosisProps {
  diagnosis: string;
  setDiagnosis: (d: string) => void;
  diagnosisTouched: boolean;
  setDiagnosisTouched: (t: boolean) => void;
  entry: any;
  conditionTrend: string;
  setConditionTrend: (t: string) => void;
  doctorNotes: string;
  setDoctorNotes: (n: string) => void;
  templates: any[];
  templateSearch: string;
  setTemplateSearch: (s: string) => void;
  applyingTemplate: string;
  applyTemplate: (id: string) => void;
  activeTemplateNames: string[];
  removeAppliedTemplate: (name: string) => void;
  setShowSaveTemplate: (s: boolean) => void;
  setShowManageTemplates: (s: boolean) => void;
}

export const Step1Diagnosis: React.FC<Step1DiagnosisProps> = ({
  diagnosis, setDiagnosis, diagnosisTouched, setDiagnosisTouched, entry,
  conditionTrend, setConditionTrend, doctorNotes, setDoctorNotes,
  templates, templateSearch, setTemplateSearch, applyingTemplate, applyTemplate,
  activeTemplateNames, removeAppliedTemplate, setShowSaveTemplate, setShowManageTemplates
}) => {
  // What reception noted at check-in, plus whatever the doctor has typed since.
  const complaint = (entry.complaint || '').trim();
  const suggestions = useMemo(
    () => suggestTemplates(templates, `${complaint} ${diagnosis || ''}`),
    [templates, complaint, diagnosis],
  );
  // Templates only appear through a suggestion or a search — no full list.
  const searchResults = useMemo(() => searchTemplates(templates, templateSearch), [templates, templateSearch]);

  return (
    <div className="space-y-4">
      <div className="p-3 rounded-lg bg-brand-soft/50 border border-brand/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 flex-1">
            <label className="block text-xs font-semibold text-brand-deep shrink-0">
              Prescription Templates
            </label>
            {templates.length > 0 && (
              <div className="relative flex-1 max-w-[260px]">
                <Search className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-brand/50" />
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  placeholder="Search problem, template or medicine..."
                  className="w-full pl-6 pr-2 py-1 rounded border border-brand/20 text-[11px] bg-white text-brand-deep focus:outline-none focus:border-brand/40 placeholder:text-brand/40"
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setShowSaveTemplate(true)}
              className="text-[10px] font-medium text-brand hover:underline cursor-pointer"
            >
              Save Current as Template
            </button>
            <button
              type="button"
              onClick={() => setShowManageTemplates(true)}
              className="text-[10px] font-medium text-brand hover:underline cursor-pointer"
            >
              Manage
            </button>
          </div>
        </div>
        
        {templates.length > 0 ? (
          <div className="flex flex-col gap-2 mt-3">
            {/* Suggested from the complaint reception recorded */}
            {!templateSearch && (
              suggestions.length > 0 ? (
                <div className="rounded-md border border-brand/30 bg-white p-2.5 space-y-2">
                  <p className="text-[11px] font-semibold text-brand-deep flex items-center gap-1.5 flex-wrap">
                    <Sparkles className="w-3.5 h-3.5" /> Suggested for this patient
                    {complaint && <span className="font-normal text-ink-secondary">— reception noted: “{complaint.length > 80 ? `${complaint.slice(0, 80)}…` : complaint}”</span>}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map(({ template: t, matched }) => {
                      const applied = activeTemplateNames.includes(t.name);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={!!applyingTemplate || applied}
                          onClick={() => applyTemplate(t.id)}
                          className={`text-left px-2.5 py-1.5 rounded-md border text-[11px] transition-colors cursor-pointer disabled:cursor-default ${
                            applied ? 'bg-status-success/10 border-status-success/30 text-status-success' : 'bg-brand-soft/40 border-brand/30 hover:border-brand text-brand-deep'
                          } ${applyingTemplate && !applied ? 'opacity-50' : ''}`}
                          title={t.condition ? `For ${t.condition}` : undefined}
                        >
                          <span className="font-semibold flex items-center gap-1">
                            {applied && <Check className="w-3 h-3" />}
                            {applyingTemplate === t.id ? 'Applying...' : t.name}
                          </span>
                          {matched.length > 0 && <span className="block text-[10px] text-ink-secondary">matches: {matched.join(', ')}</span>}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-ink-faint">Tap to apply — you can apply more than one.</p>
                </div>
              ) : (
                <p className="text-[11px] text-ink-secondary bg-white/70 border border-brand/10 rounded-md px-2.5 py-1.5">
                  {complaint
                    ? <>No template matches “{complaint.length > 60 ? `${complaint.slice(0, 60)}…` : complaint}” — search above by problem, template or medicine.</>
                    : 'Reception did not note the problem — search above by problem, template or medicine.'}
                </p>
              )
            )}

            {templateSearch ? (
              <div className="flex flex-wrap gap-2">
                {searchResults.map((t) => {
                  const applied = activeTemplateNames.includes(t.name);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      disabled={!!applyingTemplate || applied}
                      onClick={() => applyTemplate(t.id)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 border text-[11px] font-medium rounded-md shadow-xs transition-colors cursor-pointer disabled:cursor-default ${
                        applied ? 'bg-status-success/10 border-status-success/30 text-status-success' : 'bg-white border-brand/20 hover:border-brand/40 text-brand-deep disabled:opacity-50'
                      }`}
                      title={t.condition ? `For ${t.condition}` : ''}
                    >
                      {applied && <Check className="w-3 h-3" />}
                      {applyingTemplate === t.id ? 'Applying...' : t.name}
                      {t.condition && <span className="text-[10px] text-ink-secondary font-normal">· {t.condition}</span>}
                    </button>
                  );
                })}
                {searchResults.length === 0 && (
                  <p className="text-[11px] text-ink-secondary italic py-1">No templates found matching "{templateSearch}"</p>
                )}
              </div>
            ) : null}
            {activeTemplateNames.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <p className="text-[10px] font-medium text-ink-secondary">Currently applied:</p>
                <div className="flex flex-wrap gap-2">
                  {activeTemplateNames.map(templateName => (
                    <div key={templateName} className="inline-flex items-center gap-1 bg-status-warning/10 border border-status-warning/20 text-status-warning pl-2 pr-1 py-1 rounded-md">
                      <span className="text-[10px] font-medium">{templateName}</span>
                      <button
                        type="button"
                        disabled={!!applyingTemplate}
                        onClick={() => removeAppliedTemplate(templateName)}
                        className="p-0.5 rounded hover:bg-status-warning/20 cursor-pointer disabled:opacity-50"
                        title="Remove template text and orders"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[11px] text-ink-secondary/70 mt-2">
            You haven't saved any templates yet. Fill out the assessment below and click "Save Current as Template".
          </p>
        )}
        <p className="text-[10px] text-ink-secondary/70 mt-2">
          Clicking a template appends its diagnosis, advice, and orders to the current patient.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-semibold text-ink-secondary">Diagnosis / what happened</label>
          {(entry.patient?._count?.visits ?? 0) - (entry.visitId ? 1 : 0) === 0 ? (
            <span className="text-[10px] font-medium text-ink-secondary/70 bg-surface-page px-2 py-0.5 rounded border border-border">
              Baseline
            </span>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setConditionTrend(conditionTrend === 'IMPROVING' ? '' : 'IMPROVING')}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                  conditionTrend === 'IMPROVING'
                    ? 'bg-status-success text-white'
                    : 'bg-surface-page text-ink-secondary hover:bg-surface-hover border border-border'
                }`}
              >
                <ArrowUp className="w-3 h-3" /> Better
              </button>
              <button
                type="button"
                onClick={() => setConditionTrend(conditionTrend === 'SAME' ? '' : 'SAME')}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                  conditionTrend === 'SAME'
                    ? 'bg-ink-secondary text-white'
                    : 'bg-surface-page text-ink-secondary hover:bg-surface-hover border border-border'
                }`}
              >
                <ArrowRight className="w-3 h-3" /> Same
              </button>
              <button
                type="button"
                onClick={() => setConditionTrend(conditionTrend === 'WORSENING' ? '' : 'WORSENING')}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                  conditionTrend === 'WORSENING'
                    ? 'bg-status-danger text-white'
                    : 'bg-surface-page text-ink-secondary hover:bg-surface-hover border border-border'
                }`}
              >
                <ArrowDown className="w-3 h-3" /> Worse
              </button>
            </div>
          )}
        </div>
        <textarea
          value={diagnosis}
          onChange={(e) => {
            setDiagnosis(e.target.value);
            setDiagnosisTouched(true);
          }}
          rows={2}
          placeholder="Clinical findings"
          className={inputClass}
        />
        {!diagnosisTouched && diagnosis && diagnosis === entry.complaint && !entry.visitId && (
          <p className="text-[10px] text-ink-secondary mt-1">Prefilled from reception — edit before saving</p>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-ink-secondary mb-1">Clinical notes (record)</label>
        <textarea
          value={doctorNotes}
          onChange={(e) => setDoctorNotes(e.target.value)}
          rows={2}
          placeholder="Assessment recorded against the visit"
          className={inputClass}
        />
      </div>
    </div>
  );
};