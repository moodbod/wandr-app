"use client";

import { useEffect, useRef } from "react";
import type { Destination } from "@/data/destinations";

type MapWarmupProps = {
  destinations: Destination[];
  accessToken: string | undefined;
};

const SESSION_KEY = "wandr.warmup.done";

/**
 * Proactively pre-caches Mapbox Directions API responses for all destinations.
 * No hidden map instance — just fetch requests that the Service Worker will intercept and cache.
 *
 * URL params match EXACTLY what MapboxStreetsMap uses, so cache keys align.
 */
export function MapWarmup({ destinations, accessToken }: MapWarmupProps) {
  const startedRef = useRef(false);

  useEffect(() => {
    if (!accessToken || destinations.length === 0 || startedRef.current) {
      return;
    }

    // Only warm once per session
    if (typeof sessionStorage !== "undefined" && sessionStorage.getItem(SESSION_KEY)) {
      return;
    }

    startedRef.current = true;

    const abortController = new AbortController();

    const buildDirectionsUrl = (start: [number, number], end: [number, number], profile: "walking" | "driving") => {
      const coordinateParam = `${start[0]},${start[1]};${end[0]},${end[1]}`;
      const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinateParam}`);
      url.searchParams.set("alternatives", "false");
      url.searchParams.set("continue_straight", "false");
      url.searchParams.set("geometries", "geojson");
      url.searchParams.set("overview", "simplified");
      url.searchParams.set("steps", "false");
      url.searchParams.set("access_token", accessToken);
      return url.toString();
    };

    // Build task queue: center → each spot (walk + drive) + sequential spot → spot
    const urls: string[] = [];

    for (const dest of destinations) {
      for (const spot of dest.spots) {
        // Center → spot
        urls.push(buildDirectionsUrl(dest.map.center, spot.lngLat, "walking"));
        urls.push(buildDirectionsUrl(dest.map.center, spot.lngLat, "driving"));
      }

      // Sequential: spot[0] → spot[1], spot[1] → spot[2], etc.
      for (let i = 0; i < dest.spots.length - 1; i++) {
        urls.push(buildDirectionsUrl(dest.spots[i].lngLat, dest.spots[i + 1].lngLat, "walking"));
        urls.push(buildDirectionsUrl(dest.spots[i].lngLat, dest.spots[i + 1].lngLat, "driving"));
      }
    }

    let current = 0;

    const fetchNext = () => {
      if (abortController.signal.aborted || current >= urls.length) {
        if (current >= urls.length && typeof sessionStorage !== "undefined") {
          sessionStorage.setItem(SESSION_KEY, "1");
        }
        return;
      }

      fetch(urls[current], { signal: abortController.signal }).catch(() => {
        // Ignore — warming is best-effort
      });

      current++;
      setTimeout(fetchNext, 1200);
    };

    // Wait for the app to be idle before starting
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => fetchNext(), { timeout: 5000 });
    } else {
      setTimeout(fetchNext, 3000);
    }

    return () => {
      abortController.abort();
    };
  }, [accessToken, destinations]);

  // No DOM element needed — pure fetch-based warming
  return null;
}
