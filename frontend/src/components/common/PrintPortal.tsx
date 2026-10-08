import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Renders a printable document as a sibling of `#root` rather than inside the app tree.
 *
 * A print stylesheet can hide the nav and the footer, but it cannot hide the screen a
 * modal is floating over — so printing a bill also printed the patient list behind it.
 * Out here the document is the only thing left on the page (see the `body.printing`
 * rule in index.css), and it paginates normally instead of being clipped to a
 * fixed-position box.
 */
export const PrintPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [host] = useState(() => document.createElement('div'));

  useEffect(() => {
    document.body.appendChild(host);
    document.body.classList.add('printing');
    return () => {
      document.body.classList.remove('printing');
      host.remove();
    };
  }, [host]);

  return createPortal(children, host);
};
