"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UserPosition = {
  lngLat: [number, number];
  accuracy: number;
  heading: number | null;
  timestamp: number;
};

type LiveLocationPreference = {
  enabled: boolean;
  prompted: boolean;
};

const POSITION_STORAGE_KEY = "wandr.lastPosition.v1";
const PREFERENCE_STORAGE_KEY = "wandr.liveLocation.preference.v1";
const PREFERENCE_CHANGE_EVENT = "wandr-live-location-preference-change";

const defaultLiveLocationPreference: LiveLocationPreference = {
  enabled: true,
  prompted: false,
};

function readPersistedPosition(): UserPosition | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(POSITION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserPosition) : null;
  } catch {
    return null;
  }
}

function normalizePreference(value: unknown): LiveLocationPreference {
  if (!value || typeof value !== "object") {
    return defaultLiveLocationPreference;
  }

  const candidate = value as Partial<LiveLocationPreference>;

  return {
    enabled: candidate.enabled !== false,
    prompted: candidate.prompted === true,
  };
}

export function readLiveLocationPreference(): LiveLocationPreference {
  if (typeof window === "undefined") {
    return defaultLiveLocationPreference;
  }

  try {
    const raw = localStorage.getItem(PREFERENCE_STORAGE_KEY);
    return raw ? normalizePreference(JSON.parse(raw)) : defaultLiveLocationPreference;
  } catch {
    return defaultLiveLocationPreference;
  }
}

export function writeLiveLocationPreference(preference: LiveLocationPreference) {
  try {
    localStorage.setItem(PREFERENCE_STORAGE_KEY, JSON.stringify(preference));
    window.dispatchEvent(new Event(PREFERENCE_CHANGE_EVENT));
  } catch {
    // Storage full or unavailable - keep the current in-memory state.
  }
}

function persistPosition(position: UserPosition) {
  try {
    localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(position));
  } catch {
    // Storage full or unavailable - ignore.
  }
}

export function useLiveLocationPreference() {
  const [preference, setPreferenceState] = useState<LiveLocationPreference>(() => readLiveLocationPreference());

  useEffect(() => {
    const syncPreference = () => setPreferenceState(readLiveLocationPreference());

    window.addEventListener("storage", syncPreference);
    window.addEventListener(PREFERENCE_CHANGE_EVENT, syncPreference);

    return () => {
      window.removeEventListener("storage", syncPreference);
      window.removeEventListener(PREFERENCE_CHANGE_EVENT, syncPreference);
    };
  }, []);

  const setPreference = useCallback((next: LiveLocationPreference) => {
    setPreferenceState(next);
    writeLiveLocationPreference(next);
  }, []);

  return [preference, setPreference] as const;
}

export function useUserLocation() {
  const [position, setPosition] = useState<UserPosition | null>(() => readPersistedPosition());
  const [preference, setPreference] = useLiveLocationPreference();
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  const handleSuccess = useCallback((geo: GeolocationPosition) => {
    const next: UserPosition = {
      lngLat: [geo.coords.longitude, geo.coords.latitude],
      accuracy: geo.coords.accuracy,
      heading: geo.coords.heading,
      timestamp: geo.timestamp,
    };

    setPosition(next);
    setIsTracking(true);
    setError(null);
    persistPosition(next);

    if (!preference.enabled || !preference.prompted) {
      setPreference({ enabled: true, prompted: true });
    }
  }, [preference.enabled, preference.prompted, setPreference]);

  const handleError = useCallback((err: GeolocationPositionError) => {
    // Keep the last known position unless the user disables live location.
    setIsTracking(false);
    setError(err.message);

    if (err.code === 1) {
      setPreference({ enabled: false, prompted: true });
      return;
    }

    if (!preference.prompted) {
      setPreference({ enabled: preference.enabled, prompted: true });
    }
  }, [preference.enabled, preference.prompted, setPreference]);

  useEffect(() => {
    if (!preference.enabled) {
      setIsTracking(false);
      return;
    }

    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported");
      setIsTracking(false);
      return;
    }

    let cancelled = false;

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 20_000,
    };

    const startTracking = () => {
      if (cancelled) {
        return;
      }

      navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);
      watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, options);
    };

    const checkPermissionAndTrack = async () => {
      if (!("permissions" in navigator) || !navigator.permissions?.query) {
        startTracking();
        return;
      }

      try {
        const status = await navigator.permissions.query({ name: "geolocation" });

        if (cancelled) {
          return;
        }

        if (status.state === "denied") {
          setPreference({ enabled: false, prompted: true });
          setIsTracking(false);
          return;
        }

        if (status.state === "prompt" && preference.prompted) {
          setIsTracking(false);
          return;
        }

        startTracking();
      } catch {
        startTracking();
      }
    };

    void checkPermissionAndTrack();

    return () => {
      cancelled = true;
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [handleError, handleSuccess, preference.enabled, preference.prompted, setPreference]);

  return { position: preference.enabled ? position : null, isTracking, error };
}
