"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UserPosition = {
  lngLat: [number, number];
  accuracy: number;
  heading: number | null;
  timestamp: number;
};

const STORAGE_KEY = "wandr.lastPosition.v1";

function readPersistedPosition(): UserPosition | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as UserPosition) : null;
  } catch {
    return null;
  }
}

function persistPosition(position: UserPosition) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  } catch {
    // Storage full or unavailable — ignore
  }
}

export function useUserLocation() {
  const [position, setPosition] = useState<UserPosition | null>(() => readPersistedPosition());
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
  }, []);

  const handleError = useCallback((err: GeolocationPositionError) => {
    // Don't wipe position on error — keep the last known position
    setIsTracking(false);
    setError(err.message);
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setError("Geolocation not supported");
      return;
    }

    const options: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 10_000,
      timeout: 20_000,
    };

    // Get one immediate position
    navigator.geolocation.getCurrentPosition(handleSuccess, handleError, options);

    // Then watch for updates
    watchIdRef.current = navigator.geolocation.watchPosition(handleSuccess, handleError, options);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [handleError, handleSuccess]);

  return { position, isTracking, error };
}
