import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

/** What a clinic puts at the top of the paper it hands a patient. */
export interface ClinicProfile {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  stateCode?: string | null;
  stateName?: string | null;
}

/**
 * Cached per clinic for the life of the tab. Bills and prescriptions are opened all
 * day long and a clinic's own details change about never, so the first print pays for
 * the fetch and the rest are instant. A failed fetch drops out of the cache, so the
 * next document tries again rather than printing a blank letterhead forever.
 */
const cache = new Map<string, Promise<ClinicProfile>>();

/**
 * The clinic this session is working inside — the signed-in user's own, or the client
 * hospital a platform admin has stepped into. Returns null until it arrives; callers
 * render a sensible fallback rather than an empty letterhead.
 */
export function useClinicProfile(): ClinicProfile | null {
  const { apiFetch, token, clinicContext } = useAuth();
  const [profile, setProfile] = useState<ClinicProfile | null>(null);
  const key = clinicContext?.id ?? 'self';

  useEffect(() => {
    if (!token) return;
    let active = true;

    let request = cache.get(key);
    if (!request) {
      request = apiFetch('/api/clinics/me').then(async (res) => {
        if (!res.ok) throw new Error('Could not load the clinic profile');
        return (await res.json()) as ClinicProfile;
      });
      cache.set(key, request);
    }

    request
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch(() => {
        cache.delete(key);
      });

    return () => {
      active = false;
    };
  }, [key, token, apiFetch]);

  return profile;
}
