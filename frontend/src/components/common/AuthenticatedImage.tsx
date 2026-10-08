import React, { useEffect, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AuthenticatedImageProps {
  src: string;
  alt: string;
  className?: string;
}

/**
 * Renders an image served behind the same bearer-token auth as every other API call.
 * `<img src>` can't send an Authorization header, so this fetches the bytes via
 * apiFetch and hands the browser a local blob: URL instead.
 */
export const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({ src, alt, className }) => {
  const { apiFetch } = useAuth();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let localUrl: string | null = null;
    setError(false);
    setObjectUrl(null);

    (async () => {
      try {
        const res = await apiFetch(src);
        if (!res.ok) throw new Error('Failed to load image');
        const blob = await res.blob();
        if (cancelled) return;
        localUrl = URL.createObjectURL(blob);
        setObjectUrl(localUrl);
      } catch {
        if (!cancelled) setError(true);
      }
    })();

    return () => {
      cancelled = true;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-surface-page text-ink-secondary ${className ?? ''}`}>
        <ImageOff className="w-6 h-6" />
      </div>
    );
  }

  if (!objectUrl) {
    return (
      <div className={`flex items-center justify-center bg-surface-page text-ink-secondary ${className ?? ''}`}>
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  return <img src={objectUrl} alt={alt} className={className} />;
};
