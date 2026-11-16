/**
 * Suggests prescription templates from what reception wrote at check-in (and what
 * the doctor types as diagnosis). Plain keyword matching with light stemming and a
 * small synonym list for the clinic's specialties (dermatology, paediatrics,
 * plastic surgery), so "pimples" finds an Acne template and "hair loss" finds
 * Alopecia, even before anyone fills in a template's keywords.
 */

export interface MatchableTemplate {
  id: string;
  name: string;
  condition?: string | null;
  keywords?: string | null;
  diagnosis?: string | null;
  items?: { description?: string | null; medicine?: { name?: string | null } | null }[];
}

/** Each group is one idea; any word in a group stands for all of them. */
const SYNONYMS: string[][] = [
  ['acne', 'pimple', 'pimples', 'breakout', 'comedone', 'comedones', 'blackhead', 'whitehead', 'zit'],
  ['hair fall', 'hairfall', 'hair loss', 'alopecia', 'baldness', 'thinning hair', 'balding'],
  ['dandruff', 'seborrheic', 'seborrhoeic', 'flaky scalp', 'scalp flakes'],
  ['pigmentation', 'melasma', 'dark spot', 'dark spots', 'hyperpigmentation', 'tan', 'tanning', 'freckle', 'freckles', 'blemish'],
  ['fungal', 'fungus', 'ringworm', 'tinea', 'candida', 'jock itch', 'athlete foot'],
  ['eczema', 'dermatitis', 'atopic'],
  ['rash', 'rashes', 'redness', 'hives', 'urticaria'],
  ['itching', 'itch', 'itchy', 'pruritus'],
  ['wart', 'warts', 'verruca', 'molluscum'],
  ['psoriasis', 'plaque'],
  ['vitiligo', 'white patch', 'white patches', 'leucoderma'],
  ['scar', 'scars', 'keloid', 'acne scar', 'stretch mark', 'stretch marks'],
  ['dry skin', 'xerosis', 'dryness'],
  ['wrinkle', 'wrinkles', 'ageing', 'aging', 'fine lines', 'anti aging', 'botox', 'filler'],
  ['fever', 'pyrexia', 'temperature', 'febrile'],
  ['cough', 'coughing'],
  ['cold', 'running nose', 'runny nose', 'rhinitis', 'sneezing', 'blocked nose', 'congestion'],
  ['sore throat', 'throat pain', 'pharyngitis', 'tonsillitis', 'tonsil'],
  ['diarrhoea', 'diarrhea', 'loose motion', 'loose motions', 'gastroenteritis'],
  ['vomiting', 'vomit', 'nausea'],
  ['stomach pain', 'abdominal pain', 'tummy pain', 'colic'],
  ['vaccination', 'vaccine', 'immunisation', 'immunization', 'shot'],
  ['ear pain', 'earache', 'otitis'],
  ['wound', 'cut', 'laceration', 'injury', 'dressing'],
  ['burn', 'burns'],
  ['nail', 'nails', 'paronychia', 'onychomycosis'],
  ['lice', 'head lice', 'pediculosis'],
  ['scabies', 'mites'],
  ['allergy', 'allergic'],
];

const STOP = new Set(['the', 'and', 'for', 'with', 'has', 'have', 'had', 'from', 'since', 'days', 'day', 'week', 'weeks', 'month', 'months', 'year', 'years', 'patient', 'came', 'come', 'very', 'some', 'also', 'on', 'in', 'of', 'to', 'a', 'an', 'is', 'my', 'her', 'his', 'their', 'face', 'body', 'skin', 'problem', 'issue', 'issues', 'follow', 'up', 'review', 'visit', 'new', 'old']);

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()} `;
/** pimples -> pimple, itching -> itch, scars -> scar */
const stem = (w: string) => w.replace(/(ing|es|s)$/, '').replace(/(.)\1$/, '$1');
const words = (s: string) => norm(s).trim().split(' ').filter((w) => w.length >= 3 && !STOP.has(w));

/** Every phrase that stands for something in `text`, synonyms included. */
const expand = (text: string) => {
  const t = norm(text);
  const phrases = new Set<string>();
  for (const w of words(text)) phrases.add(stem(w));
  for (const group of SYNONYMS) {
    if (group.some((p) => t.includes(norm(p)) || words(p).every((w) => t.includes(` ${w}`) || t.includes(` ${stem(w)}`)))) {
      for (const p of group) phrases.add(norm(p).trim());
    }
  }
  return phrases;
};

const hits = (phrases: Set<string>, field?: string | null) => {
  if (!field) return [] as string[];
  const f = norm(field);
  const fStems = norm(words(field).map(stem).join(' '));
  return [...phrases].filter((p) => p.length >= 3 && (f.includes(` ${p} `) || f.includes(` ${p}`) || fStems.includes(` ${stem(p)} `)));
};

export interface Suggestion<T> {
  template: T;
  score: number;
  /** Words that linked the complaint to this template, for the "why" hint. */
  matched: string[];
}

/** Templates that fit the complaint, best first. Empty when there is nothing to go on. */
export function suggestTemplates<T extends MatchableTemplate>(templates: T[], text: string, limit = 6): Suggestion<T>[] {
  if (!text.trim()) return [];
  const phrases = expand(text);
  if (!phrases.size) return [];
  const out: Suggestion<T>[] = [];
  for (const t of templates) {
    const keywordList = (t.keywords || '').split(',').map((k) => k.trim()).filter(Boolean);
    const cond = hits(phrases, t.condition);
    const kw = keywordList.flatMap((k) => hits(phrases, k));
    const name = hits(phrases, t.name);
    const dx = hits(phrases, t.diagnosis);
    // A condition fully covered by the complaint beats one that only shares a word
    // ("pimples" -> "Acne" before "Acne scars").
    const condWords = t.condition ? words(t.condition) : [];
    const fullCond = condWords.length > 0 && condWords.every((w) => [...phrases].some((p) => stem(p) === stem(w)));
    const score = cond.length * 4 + kw.length * 4 + name.length * 3 + dx.length + (fullCond ? 3 : 0);
    if (score > 0) {
      // Show whole words only in the "why" hint, not stems.
      const shown = [...new Set([...cond, ...kw, ...name, ...dx])].filter((p) =>
        [t.condition, t.keywords, t.name, t.diagnosis].some((f) => f && norm(f).includes(` ${p} `)),
      );
      out.push({ template: t, score, matched: shown.slice(0, 3) });
    }
  }
  return out.sort((a, b) => b.score - a.score || a.template.name.localeCompare(b.template.name)).slice(0, limit);
}

/** Free search across name, condition, keywords, diagnosis and the medicines inside. */
export function searchTemplates<T extends MatchableTemplate>(templates: T[], q: string): T[] {
  const query = q.trim().toLowerCase();
  if (!query) return templates;
  const synonyms = expand(query);
  return templates.filter((t) => {
    const hay = [
      t.name, t.condition, t.keywords, t.diagnosis,
      ...(t.items ?? []).map((i) => `${i.description ?? ''} ${i.medicine?.name ?? ''}`),
    ].join(' ').toLowerCase();
    return hay.includes(query) || hits(synonyms, hay).length > 0;
  });
}
