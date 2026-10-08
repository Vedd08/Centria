import React, { useRef, useEffect } from 'react';
import { X } from 'lucide-react';

interface BulletListEditorProps {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  containerClass?: string;
  buttonClass?: string;
}

export const BulletListEditor: React.FC<BulletListEditorProps> = ({
  value,
  onChange,
  placeholder,
  containerClass = "w-full p-2.5 rounded-md border border-border bg-surface-page text-ink-primary flex flex-col gap-1",
  buttonClass = "self-start text-[11px] text-brand hover:underline mt-1 cursor-pointer bg-transparent border-none p-0",
}) => {
  const points = value === '' ? [''] : value.split('\n');
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Update refs array size
  useEffect(() => {
    textareaRefs.current = textareaRefs.current.slice(0, points.length);
  }, [points.length]);

  const updatePoint = (idx: number, val: string) => {
    const newPts = [...points];
    newPts[idx] = val;
    onChange(newPts.join('\n'));
  };

  const addPoint = (focusIdx?: number) => {
    const newPts = [...points];
    if (typeof focusIdx === 'number') {
      newPts.splice(focusIdx, 0, '');
      onChange(newPts.join('\n'));
      setTimeout(() => textareaRefs.current[focusIdx]?.focus(), 0);
    } else {
      newPts.push('');
      onChange(newPts.join('\n'));
      setTimeout(() => textareaRefs.current[newPts.length - 1]?.focus(), 0);
    }
  };

  const removePoint = (idx: number) => {
    let newPts = points.filter((_, i) => i !== idx);
    if (newPts.length === 0) newPts = [''];
    onChange(newPts.join('\n'));
    if (idx > 0) {
      setTimeout(() => textareaRefs.current[idx - 1]?.focus(), 0);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, idx: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addPoint(idx + 1);
    } else if (e.key === 'Backspace' && points[idx] === '') {
      e.preventDefault();
      removePoint(idx);
    }
  };

  const handleBlur = () => {
    const trimmed = points.map(p => p.trim()).filter(p => p !== '');
    const newValue = trimmed.length === 0 ? '' : trimmed.join('\n');
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  return (
    <div className={containerClass}>
      {points.map((pt, i) => (
        <div key={i} className="flex items-start gap-2 group relative">
          <span className="mt-0.5 text-xs leading-tight text-ink-secondary font-normal">•</span>
          <textarea
            ref={el => textareaRefs.current[i] = el}
            value={pt}
            onChange={(e) => updatePoint(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onBlur={handleBlur}
            placeholder={placeholder}
            rows={1}
            className="flex-1 bg-transparent border-none p-0 text-xs focus:ring-0 resize-none text-inherit placeholder:text-inherit/40 overflow-hidden min-h-[20px]"
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = target.scrollHeight + 'px';
            }}
          />
          <button
            type="button"
            onClick={() => removePoint(i)}
            className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-0.5 hover:bg-black/10 rounded absolute -right-2 top-0 transition-opacity cursor-pointer text-ink-secondary"
            title="Remove point"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => addPoint()}
        className={buttonClass}
      >
        + Add point
      </button>
    </div>
  );
};
