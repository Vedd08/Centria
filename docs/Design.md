# Design System — "Ward Board"

**Source of truth:** `frontend/tailwind.config.js` and `frontend/src/index.css`. If
this document and the code ever disagree, the code wins — update this file to match.

**Last updated:** 2026-09-15

---

## 1. Concept

> Dark structural chrome carries the system (navigation, identity, shift context);
> light paper cards carry the patient data. That inversion is how a real ward board
> and a monitor bezel read, and it keeps "the software" visually separate from
> "the chart."

Status is expressed in **triage language** — the vocabulary every person on a
clinical floor already reads without thinking (wait / active / done / urgent) —
rather than generic "info/success/warning/error" labels.

Token *names* are treated as stable API: don't rename `brand`, `shell`, `surface`,
`ink`, `triage`, `status`, `border` casually. Every screen depends on them; changing a
name means a find-and-replace across the whole frontend, not just a config edit.

## 2. Brand — Centria

The software is **Centria**. The source artwork is `frontend/src/assets/CENTRIA.jpeg`;
never use that JPEG directly in the UI — it carries a white box. Use the transparent
cuts in `frontend/src/assets/brand/` through the `BrandLogo` component
(`components/common/BrandLogo.tsx`):

| `variant` | Artwork | Where |
|---|---|---|
| `wordmark` (default) | "C" + ENTRIA | Top nav, footer, print footers, dark modal toolbars |
| `lockup` | wordmark + "Everything Connected. Everything Simplified." | Login identity panel, loading screen |
| `mark` | the "C" alone | Very tight spaces; also `public/favicon.png` |

- `tone="onDark"` on `shell` chrome (the navy lettering turns white); `onLight`
  everywhere else, including paper.
- Size by height only (`h-7`, `h-3` …) — width follows the artwork.
- **Centria is the software, not the clinic.** A printed bill or prescription keeps the
  clinic's own letterhead at the top; Centria appears only as a small "Powered by"
  line in the document footer.

## 3. Color

Every colour below is sampled from the Centria logo: the navy wordmark became the
chrome and the ink; the blue→teal "C" became the brand. Where a logo colour failed
WCAG AA under white text it was darkened rather than swapped for something off-brand.

### Brand
| Token | Value | Use |
|---|---|---|
| `brand.DEFAULT` | `#0E6193` | Primary actions, focus rings, active state (blue end of the "C"; 6.7:1 with white) |
| `brand.soft` | `#E3EFF6` | Subtle brand-tinted backgrounds |
| `brand.deep` | `#0A4A70` | Pressed/hover-dark state |
| `brand.lift` | `#177B7E` | Filled emphasis on dark chrome — active nav pill (logo mid-teal, darkened to 5.0:1 with white) |
| `brand.teal` | `#30B695` | Accents and hover text on `shell` only (6.0:1 on shell) — never under white text |
| `bg-brand-gradient` | `#0E6193 → #229495 → #30B695` | Thin decorative rules only (e.g. the top nav's bottom edge) — never behind text |

### Shell (system chrome — nav, header, identity surfaces)
| Token | Value | Use |
|---|---|---|
| `shell.DEFAULT` | `#15253E` | Base chrome background (the logo's navy) |
| `shell.raised` | `#1E3252` | Elevated chrome panels |
| `shell.line` | `#2B4062` | Dividers within chrome |
| `shell.ink` | `#DDE5EF` | Text on chrome |
| `shell.muted` | `#8D9CB3` | Secondary text on chrome |

### Surface (data/content — cards, pages)
| Token | Value | Use |
|---|---|---|
| `surface.page` | `#EEF2F6` | App background |
| `surface.card` | `#FFFFFF` | Card / panel background |
| `surface.sunken` | `#F5F7FA` | Recessed areas within a card (e.g. table zebra) |

### Ink (text on light surfaces)
| Token | Value | Use |
|---|---|---|
| `ink.primary` | `#15253E` | Primary text |
| `ink.secondary` | `#56657A` | Secondary text |
| `ink.faint` | `#7F8BA0` | Placeholder / disabled text |

### Triage (patient/queue status — the clinical vocabulary)
| Token | Value | Meaning |
|---|---|---|
| `triage.wait` | `#A86511` | Waiting |
| `triage.active` | `#0E6193` | In progress / being seen |
| `triage.done` | `#157F66` | Completed |
| `triage.urgent` | `#B3352C` | Needs attention / critical |

### Status (generic UI feedback — separate from triage; use triage for patient-flow
state, status for form/system feedback)
| Token | Value |
|---|---|
| `status.success` | `#157F66` |
| `status.warning` | `#A86511` |
| `status.danger` | `#B3352C` |
| `status.info` | `#0E6193` |

### Border
| Token | Value |
|---|---|
| `border.DEFAULT` | `#D8E0E9` |
| `border.subtle` | `#E8EDF3` |
| `border.strong` | `#B9C5D3` |

### Chart series (analytics only)
Assigned in this fixed order and **never cycled** — a filter that drops a series must
not repaint the survivors. Validated for colour-vision deficiency: adjacent pairs clear
ΔE 20 under deuteranopia and tritanopia.

| Slot | Value | Note |
|---|---|---|
| 1 | `#0E6193` | `brand.DEFAULT` — also the single hue for magnitude (bar lists, one-series columns) |
| 2 | `#30B695` | `brand.teal` — 2.48:1 on white, so it only ever appears with a visible value label or table view |
| 3 | `#7A5AA6` | third identity; a 4th series folds into "Other" or becomes small multiples |

Rules that go with them: status colours are **not** reusable as series colours; an
ordinal set (expiry windows) is one hue plus text labels, never a red→amber ramp, whose
adjacent pairs are indistinguishable under deuteranopia; every chart ships a table view;
2px gaps separate touching fills; a legend appears for two or more series.

### Accent tints (small-surface badges/tags only)
| Token | bg / text |
|---|---|
| `tint2` | `#F6E6DF` / `#8A4327` |
| `tint3` | `#F7EEDA` / `#87661B` |

**Rule:** never write a raw hex value in a component when a token above already
covers the case. If a new semantic color is genuinely needed, add it to
`tailwind.config.js` first, named for its *meaning* (like `triage.urgent`), not its
appearance (not `red2`). In `index.css`, reach tokens with `theme('colors.…')`.

## 4. Typography

| Role | Font stack | Token |
|---|---|---|
| Display / headings (`h1`–`h3`, `.font-display`) | Archivo → IBM Plex Sans → sans-serif | `font-display` |
| Body | IBM Plex Sans → system sans fallback stack | `font-sans` (default) |
| Monospace / tabular data | IBM Plex Mono → monospace | `font-mono` |

- Headings carry `letter-spacing: -0.015em` — slightly tightened, "the institutional
  voice" per the codebase's own comment.
- **Tabular numerals are mandatory for any column of numbers.** `table td`, `table
  th`, and `input[type=number|date|time]` get `font-variant-numeric: tabular-nums`
  globally via `index.css` — don't override this for new number-bearing tables; a
  clinic compares figures down a column and jitter there is a real usability defect.
- `.eyebrow` utility: 10px, weight 600, `0.09em` letter-spacing, uppercase — the
  small-caps section label used above card/section headers throughout the app.

## 5. Elevation & Structure

| Token | Use |
|---|---|
| `shadow-xs` | Minimal separation (list rows, inline chips) |
| `shadow-card` | Standard card elevation |
| `shadow-lift` | Modals, popovers, anything that should feel "picked up" |
| `shadow-shell` | Inset highlight on dark chrome surfaces only |

## 6. Motion

- Standard entrance animations: `animate-fade-in`, `animate-slide-up`,
  `animate-scale-in`, `animate-slide-in-right` (0.2–0.25s ease, defined in
  `index.css`). Reuse these rather than writing new keyframes for a similar effect.
- The `.care-rail` component (a patient's progress through the day, rendered as a
  segmented bar) pulses its `active` segment — this is the one place continuous
  animation is intentional; don't add ambient motion elsewhere.
- **Accessibility is non-negotiable here:** `prefers-reduced-motion: reduce` collapses
  all animation/transition durations to near-zero globally. Any new animation must
  respect this automatically (it will, if done via standard `transition`/`animation`
  CSS) — never gate it manually per-component.

## 7. Interaction & Accessibility

- Every interactive element (`button`, `a`, `select`, `input`, `textarea`,
  `[tabindex]`) gets a visible `2px solid var(--brand)` focus ring on
  `:focus-visible`, offset 2px, 4px corner radius. This exists explicitly for
  "keyboard and for gloves" (clinical staff, hands not always free for a mouse) — do
  not suppress focus outlines on new components.
- Scrollbars are thin (9px) and tinted (`#c1cbd7` on transparent) — don't let a
  new scrollable panel fall back to the OS default chunky bar.

## 8. Print

Bills and prescriptions leave the building on paper. The `@media print` block forces
a white background and hides `header`, `footer`, `nav`, and anything tagged
`.print:hidden`. Any new printable document (a new invoice/prescription/report
layout) must:
- Live in its own "Printable*" component (see `PrintableInvoiceModal`,
  `PrintablePrescriptionModal`, `PrintablePatientBill` for the existing pattern)
- Render inside `<PrintPortal>`, which mounts the document as a sibling of `#root` and
  marks `body.printing` so the app itself leaves the paper. Without it the screen behind
  the modal prints along with the document
- Carry the `print:` overrides that turn the on-screen modal into a page —
  `print:static print:bg-white print:p-0 print:block print:overflow-visible` on the
  overlay, and `print:shadow-none print:border-0 print:max-w-none print:max-h-none` on
  the sheet — or it prints as a boxed grey card with its edges clipped
- Close with the "Powered by" `BrandLogo` line — in a `div`, not a `<footer>`, or the
  print stylesheet hides it
- Be tested in the browser's print preview, not just on-screen

## 9. Applying This System to New Screens

1. Chrome (top nav, side nav, identity bar) → `shell.*` tokens, dark.
2. Content (everything holding patient/clinic data) → `surface.*` + `ink.*` tokens,
   light.
3. Any patient-flow state (queue, admission, care order status) → `triage.*`, never
   plain `status.*` or ad-hoc colors — that vocabulary is reserved for form/system
   feedback (save succeeded, validation failed, etc.).
4. Numbers in a list or table → `font-mono` / rely on the global tabular-nums rule.
5. New icon → `lucide-react`, sized/colored via existing utility classes, not a new
   icon package.
