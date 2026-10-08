import React from 'react';
import mark from '../../assets/brand/centria-mark.png';
import wordmark from '../../assets/brand/centria-wordmark.png';
import wordmarkInverse from '../../assets/brand/centria-wordmark-inverse.png';
import lockup from '../../assets/brand/centria-logo.png';
import lockupInverse from '../../assets/brand/centria-logo-inverse.png';

export const PRODUCT_NAME = 'Centria';

type Tone = 'onLight' | 'onDark';

/** mark = the "C" alone; wordmark = C + ENTRIA; lockup = wordmark + tagline. */
const SOURCES = {
  mark: { onLight: mark, onDark: mark },
  wordmark: { onLight: wordmark, onDark: wordmarkInverse },
  lockup: { onLight: lockup, onDark: lockupInverse },
} as const;

interface BrandLogoProps {
  variant?: keyof typeof SOURCES;
  /** The ground it sits on — the navy lettering turns white on shell chrome. */
  tone?: Tone;
  /** Size by height (e.g. `h-7`); width follows the artwork. */
  className?: string;
}

/**
 * The Centria logo, cut from `src/assets/CENTRIA.jpeg` onto a transparent background
 * so it sits on chrome, cards and paper alike. Use it wherever the software itself is
 * speaking; a clinic's own letterhead stays the clinic's.
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({ variant = 'wordmark', tone = 'onLight', className = '' }) => (
  <img
    src={SOURCES[variant][tone]}
    alt={PRODUCT_NAME}
    draggable={false}
    className={`w-auto select-none ${className}`}
  />
);
