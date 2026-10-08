/** @type {import('tailwindcss').Config} */

/**
 * "Ward Board" — the clinic's visual system, in Centria's colours.
 *
 * Dark structural chrome carries the system (navigation, identity, shift context);
 * light paper cards carry the patient data. That inversion is how a real ward board
 * and a monitor bezel read, and it keeps "the software" visually separate from
 * "the chart".
 *
 * The palette is sampled from the Centria logo (src/assets/CENTRIA.jpeg): the navy
 * wordmark becomes the chrome and the ink, and the blue→teal "C" becomes the brand.
 * Where a logo colour failed WCAG AA under white text it was darkened, not swapped.
 *
 * Status is expressed in triage language, because that is the vocabulary every
 * person on a clinical floor already reads without thinking.
 *
 * Token names are unchanged from the previous system on purpose — every screen keeps
 * working, only the values move.
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Archivo does the personality work on headings and figures; IBM Plex Sans
        // stays for body because it holds up at the 11–13px this app lives at.
        display: ['Archivo', '"IBM Plex Sans"', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      colors: {
        brand: {
          // The blue end of the logo's "C" — 6.7:1 under white text.
          DEFAULT: '#0E6193',
          soft: '#E3EFF6',
          deep: '#0A4A70',
          // The logo's mid teal, darkened to carry white text on dark chrome (5.0:1).
          lift: '#177B7E',
          // The teal end of the "C" — accents and text on shell only, never under white text.
          teal: '#30B695',
        },
        // The logo's navy wordmark, used for all system chrome.
        shell: {
          DEFAULT: '#15253E',
          raised: '#1E3252',
          line: '#2B4062',
          ink: '#DDE5EF',
          muted: '#8D9CB3',
        },
        surface: {
          page: '#EEF2F6',
          card: '#FFFFFF',
          sunken: '#F5F7FA',
        },
        ink: {
          primary: '#15253E',
          secondary: '#56657A',
          faint: '#7F8BA0',
        },
        // Triage language: what a patient's state is, at a glance.
        triage: {
          wait: '#A86511',
          active: '#0E6193',
          done: '#157F66',
          urgent: '#B3352C',
        },
        status: {
          success: '#157F66',
          warning: '#A86511',
          danger: '#B3352C',
          info: '#0E6193',
        },
        border: {
          DEFAULT: '#D8E0E9',
          subtle: '#E8EDF3',
          strong: '#B9C5D3',
        },
        tint2: { bg: '#F6E6DF', text: '#8A4327' },
        tint3: { bg: '#F7EEDA', text: '#87661B' },
      },
      backgroundImage: {
        // The logo's "C", for thin decorative rules — never behind text.
        'brand-gradient': 'linear-gradient(90deg, #0E6193 0%, #229495 60%, #30B695 100%)',
      },
      boxShadow: {
        xs: '0 1px 2px rgba(21, 37, 62, 0.06)',
        card: '0 1px 3px rgba(21, 37, 62, 0.07), 0 1px 2px rgba(21, 37, 62, 0.04)',
        lift: '0 8px 24px -6px rgba(21, 37, 62, 0.16)',
        shell: '0 1px 0 rgba(255, 255, 255, 0.04) inset',
      },
      letterSpacing: {
        eyebrow: '0.09em',
      },
    },
  },
  plugins: [],
};
