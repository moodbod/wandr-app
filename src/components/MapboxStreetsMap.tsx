"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import mapboxgl, {
  LngLatBounds,
  type GeoJSONSource,
  type Map as MapboxMap,
  type Marker,
} from "mapbox-gl";
import { LocateFixed } from "lucide-react";
import type { UserPosition } from "@/hooks/useUserLocation";
import type { Spot } from "@/data/destinations";
import {
  buildDirectionsUrl,
  buildRouteCacheKey,
  fetchAndCacheRoute,
  readRouteGeometry,
  type LngLat,
} from "@/lib/offlineMapStorage";

type Props = {
  mapConfig: {
    center: [number, number];
    zoom: number;
    label: string;
  };
  spots: Spot[];
  nextStop?: Spot;
  highlightedSpotId?: string | null;
  routeStops: Spot[];
  routeOpen: boolean;
  routeMode: "walk" | "drive";
  userPosition: UserPosition | null;
  onOpenSpot: (spotId: string) => void;
  onRouteSummaryChange?: (summary: RouteSummary | null) => void;
};

const routeSourceId = "wandr-route";
const routeLayerId = "wandr-route-line";
const routeCasingLayerId = "wandr-route-line-casing";
const userSourceId = "wandr-user-position";
const userCircleLayerId = "wandr-user-circle";
const userDotLayerId = "wandr-user-dot";
const userAccuracyLayerId = "wandr-user-accuracy";
export type RouteSummary = {
  distanceMeters: number;
  durationSeconds: number;
  source?: "network" | "cache";
  unavailableReason?: "offline-missing-route" | "missing-token" | "request-failed";
};
type MarkerHandle = {
  id: string;
  element: HTMLButtonElement;
  marker: Marker;
};

type PersistentMapState = {
  host: HTMLDivElement | null;
  map: MapboxMap | null;
  markers: MarkerHandle[];
  ready: boolean;
  loadPromise: Promise<void> | null;
  resizeObserver: ResizeObserver | null;
  resizeFrame: number | null;
  didInitialCenter: boolean;
  routeKey: string | null;
  lastTargetCenter: [number, number] | null;
  lastTargetZoom: number | null;
};

const persistentMapState: PersistentMapState = {
  host: null,
  map: null,
  markers: [],
  ready: false,
  loadPromise: null,
  resizeObserver: null,
  resizeFrame: null,
  didInitialCenter: false,
  routeKey: null,
  lastTargetCenter: null,
  lastTargetZoom: null,
};

const followPreferenceKey = "wandr.map.followMode.v1";

function readFollowPreference() {
  if (typeof window === "undefined") {
    return true;
  }

  return window.localStorage.getItem(followPreferenceKey) !== "paused";
}

function saveFollowPreference(enabled: boolean) {
  try {
    window.localStorage.setItem(followPreferenceKey, enabled ? "follow" : "paused");
  } catch {
    // Follow preference is a small enhancement; ignore storage failures.
  }
}

function markerTone(spot: Spot) {
  if (spot.category === "gems") {
    return "gems";
  }

  if (spot.category === "eat") {
    return "eat";
  }

  if (spot.category === "routes") {
    return "routes";
  }

  return "see";
}

const MapboxStreetsMap = ({
  mapConfig,
  spots,
  nextStop,
  highlightedSpotId,
  routeStops,
  routeOpen,
  routeMode,
  userPosition,
  onOpenSpot,
  onRouteSummaryChange,
}: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(persistentMapState.map);
  const markersRef = useRef<MarkerHandle[]>(persistentMapState.markers);
  const [ready, setReady] = useState(persistentMapState.ready);
  const [routeCoordinates, setRouteCoordinates] = useState<LngLat[]>([]);
  const [isFollowingUser, setIsFollowingUser] = useState(() => readFollowPreference());
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const mapCenter = mapConfig.center;
  const mapZoom = mapConfig.zoom;
  const programmaticMoveRef = useRef(false);
  const isRouteActiveRef = useRef(routeOpen);

  useEffect(() => {
    isRouteActiveRef.current = routeOpen;
    if (routeOpen && userPosition && readFollowPreference()) {
      setIsFollowingUser(true);
    }
  }, [routeOpen, userPosition]);

  // --- Map initialization ---
  useEffect(() => {
    if (!containerRef.current || !accessToken) {
      return;
    }

    const container = containerRef.current;
    mapboxgl.accessToken = accessToken;
    let disposed = false;

    if (!persistentMapState.host) {
      persistentMapState.host = document.createElement("div");
      persistentMapState.host.className = "absolute inset-0";
    }

    container.append(persistentMapState.host);

    if (!persistentMapState.map) {
      const initialCenter = userPosition?.lngLat ?? mapConfig.center;
      const initialZoom = userPosition ? 14 : mapConfig.zoom;

      const map = new mapboxgl.Map({
        container: persistentMapState.host,
        style: "mapbox://styles/mapbox/streets-v12",
        center: initialCenter,
        zoom: initialZoom,
        attributionControl: false,
        pitchWithRotate: false,
      });

      map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

      persistentMapState.map = map;
      persistentMapState.loadPromise = new Promise((resolve) => {
        map.on("load", () => {
          if (!map.getSource(userSourceId)) {
            map.addSource(userSourceId, {
              type: "geojson",
              data: { type: "FeatureCollection", features: [] },
            });
          }

          if (!map.getLayer(userAccuracyLayerId)) {
            map.addLayer({
              id: userAccuracyLayerId,
              type: "circle",
              source: userSourceId,
              paint: {
                "circle-radius": ["get", "accuracyRadius"],
                "circle-color": "hsl(210, 100%, 56%)",
                "circle-opacity": 0.1,
                "circle-stroke-width": 0,
              },
            });
          }

          if (!map.getLayer(userCircleLayerId)) {
            map.addLayer({
              id: userCircleLayerId,
              type: "circle",
              source: userSourceId,
              paint: {
                "circle-radius": 11,
                "circle-color": "hsl(0, 0%, 100%)",
                "circle-opacity": 1,
              },
            });
          }

          if (!map.getLayer(userDotLayerId)) {
            map.addLayer({
              id: userDotLayerId,
              type: "circle",
              source: userSourceId,
              paint: {
                "circle-radius": 7,
                "circle-color": "hsl(210, 100%, 56%)",
                "circle-opacity": 1,
              },
            });
          }

          persistentMapState.ready = true;
          resolve();
        });
      });
    }

    const map = persistentMapState.map;
    mapRef.current = map;

    persistentMapState.loadPromise?.then(() => {
      if (disposed) {
        return;
      }
      setReady(true);
      window.setTimeout(() => map?.resize(), 80);
    });

    const pauseFollow = () => {
      if (programmaticMoveRef.current || !isRouteActiveRef.current) {
        return;
      }
      setIsFollowingUser(false);
      saveFollowPreference(false);
    };
    map?.on("dragstart", pauseFollow);
    map?.on("zoomstart", pauseFollow);
    map?.on("rotatestart", pauseFollow);
    map?.on("pitchstart", pauseFollow);

    if (persistentMapState.resizeObserver) {
      persistentMapState.resizeObserver.disconnect();
    }
    persistentMapState.resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (persistentMapState.resizeFrame !== null) {
              window.cancelAnimationFrame(persistentMapState.resizeFrame);
            }

            persistentMapState.resizeFrame = window.requestAnimationFrame(() => {
              map?.resize();
              persistentMapState.resizeFrame = null;
            });
          });
    persistentMapState.resizeObserver?.observe(container);

    return () => {
      disposed = true;
      map?.off("dragstart", pauseFollow);
      map?.off("zoomstart", pauseFollow);
      map?.off("rotatestart", pauseFollow);
      map?.off("pitchstart", pauseFollow);
      if (persistentMapState.resizeFrame !== null) {
        window.cancelAnimationFrame(persistentMapState.resizeFrame);
        persistentMapState.resizeFrame = null;
      }
      persistentMapState.resizeObserver?.disconnect();
      persistentMapState.host?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Handle map view updates (sync with mapConfig)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || routeOpen) return;

    const isInitialRun = !persistentMapState.lastTargetCenter;

    const centerChanged =
      isInitialRun ||
      persistentMapState.lastTargetCenter[0] !== mapCenter[0] ||
      persistentMapState.lastTargetCenter[1] !== mapCenter[1];
    const zoomChanged = persistentMapState.lastTargetZoom !== mapZoom;

    if (centerChanged || zoomChanged) {
      persistentMapState.lastTargetCenter = mapCenter;
      persistentMapState.lastTargetZoom = mapZoom;

      // On initial run, if we have a user position, the map was already centered at the user position by constructor.
      // Do NOT jump to mapCenter! Just save target center/zoom to prevent future snaps.
      if (isInitialRun && userPosition) {
        return;
      }

      programmaticMoveRef.current = true;
      map.jumpTo({
        center: mapCenter,
        zoom: mapZoom,
      });
      map.resize();
      window.setTimeout(() => {
        programmaticMoveRef.current = false;
      }, 0);
    }
  }, [mapCenter, mapZoom, ready, routeOpen, userPosition]);

  // --- Update user position on the map ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }

    const source = map.getSource(userSourceId) as GeoJSONSource | undefined;
    if (!source) {
      return;
    }

    if (!userPosition) {
      source.setData({ type: "FeatureCollection", features: [] });
      return;
    }

    // Convert accuracy (meters) to approximate pixel radius at current zoom
    const metersPerPixel = (156543.03392 * Math.cos((userPosition.lngLat[1] * Math.PI) / 180)) / Math.pow(2, map.getZoom());
    const accuracyRadius = Math.min(userPosition.accuracy / metersPerPixel, 200);

    source.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { accuracyRadius },
          geometry: {
            type: "Point",
            coordinates: userPosition.lngLat,
          },
        },
      ],
    });
  }, [ready, userPosition]);

  // --- Initial camera: fit to spots if no user position ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || persistentMapState.didInitialCenter) {
      return;
    }

    if (userPosition) {
      persistentMapState.didInitialCenter = true;
      return;
    }

    if (spots.length === 0) {
      return;
    }

    persistentMapState.didInitialCenter = true;
    const bounds = new LngLatBounds();
    spots.forEach((spot) => bounds.extend(spot.lngLat));
    programmaticMoveRef.current = true;
    map.fitBounds(bounds, {
      padding: { top: 140, right: 80, bottom: 260, left: 80 },
      maxZoom: 12,
      duration: 700,
      essential: true,
    });
    window.setTimeout(() => {
      programmaticMoveRef.current = false;
    }, 750);
  }, [ready, spots, userPosition]);

  // --- Follow mode: recenter on user when routing is active ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !routeOpen || !userPosition || !isFollowingUser) {
      return;
    }

    programmaticMoveRef.current = true;
    map.easeTo({
      center: userPosition.lngLat,
      zoom: Math.max(map.getZoom(), 15),
      duration: 600,
      essential: false,
    });
    window.setTimeout(() => {
      programmaticMoveRef.current = false;
    }, 650);
  }, [isFollowingUser, ready, routeOpen, userPosition]);

  const handleRecenter = useCallback(() => {
    const map = mapRef.current;
    if (!map || !userPosition) {
      return;
    }

    setIsFollowingUser(true);
    saveFollowPreference(true);
    programmaticMoveRef.current = true;
    map.easeTo({
      center: userPosition.lngLat,
      zoom: Math.max(map.getZoom(), 15),
      duration: 450,
      essential: true,
    });
    window.setTimeout(() => {
      programmaticMoveRef.current = false;
    }, 500);
  }, [userPosition]);

  // --- Stable callback ref for marker click handlers ---
  const onOpenSpotRef = useRef(onOpenSpot);
  useEffect(() => {
    onOpenSpotRef.current = onOpenSpot;
  }, [onOpenSpot]);

  // --- Spot markers (diff-based) ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }

    markersRef.current = persistentMapState.markers;
    const prevById = new Map(markersRef.current.map((h) => [h.id, h]));
    const nextIds = new Set(spots.map((s) => s.id));

    // Remove markers no longer in the list
    for (const [id, handle] of prevById) {
      if (!nextIds.has(id)) {
        handle.marker.remove();
        prevById.delete(id);
      }
    }

    // Start with kept markers
    const kept = Array.from(prevById.values());
    const existingIds = new Set(kept.map((h) => h.id));

    // Add only new markers
    spots.forEach((spot) => {
      if (existingIds.has(spot.id)) {
        return;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = [
        "wandr-photo-marker",
        `wandr-photo-marker--${markerTone(spot)}`,
      ].join(" ");
      button.ariaLabel = `Open details for ${spot.name}`;
      button.addEventListener("click", () => onOpenSpotRef.current(spot.id));

      const visual = document.createElement("span");
      visual.className = "wandr-photo-marker__visual";

      const photoWrap = document.createElement("span");
      photoWrap.className = "wandr-photo-marker__photo-wrap";

      const image = document.createElement("img");
      image.src = spot.image;
      image.alt = "";
      image.className = "wandr-photo-marker__image";
      image.loading = "lazy";
      image.decoding = "async";
      image.onload = () => visual.classList.add("wandr-photo-marker__visual--loaded");
      photoWrap.append(image);

      const stem = document.createElement("span");
      stem.className = "wandr-photo-marker__stem";

      visual.append(photoWrap, stem);
      button.append(visual);

      const marker = new mapboxgl.Marker({ element: button, anchor: "bottom" })
        .setLngLat(spot.lngLat)
        .addTo(map);

      kept.push({ id: spot.id, element: button, marker });
    });

    markersRef.current = kept;
    persistentMapState.markers = kept;
  }, [ready, spots]);

  // --- Highlighted spot ---
  useEffect(() => {
    if (!ready) {
      return;
    }

    markersRef.current.forEach(({ id, element }) => {
      element.classList.toggle("wandr-photo-marker--active", id === highlightedSpotId);
    });
  }, [highlightedSpotId, ready, spots]);

  // --- Directions fetch ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }

    const routeTargets = routeOpen ? (routeStops.length > 0 ? routeStops : nextStop ? [nextStop] : []) : [];
    const origin = userPosition?.lngLat ?? mapCenter;
    const coordinates = [origin, ...routeTargets.map((spot) => spot.lngLat)];
    const abortController = new AbortController();

    if (coordinates.length < 2 || !accessToken) {
      setRouteCoordinates([]);
      onRouteSummaryChange?.(accessToken ? null : { distanceMeters: 0, durationSeconds: 0, unavailableReason: "missing-token" });
      return () => abortController.abort();
    }

    const routeKey = buildRouteCacheKey(origin, routeTargets.map((spot) => spot.lngLat), routeMode);
    const url = buildDirectionsUrl(origin, routeTargets.map((spot) => spot.lngLat), routeMode, accessToken);
    persistentMapState.routeKey = routeKey;

    readRouteGeometry(routeKey)
      .then((cachedRoute) => {
        if (abortController.signal.aborted || persistentMapState.routeKey !== routeKey) {
          return null;
        }

        if (cachedRoute) {
          setRouteCoordinates(cachedRoute.coordinates);
          onRouteSummaryChange?.({ ...cachedRoute, source: "cache" });
          if (typeof navigator !== "undefined" && !navigator.onLine) {
            return null;
          }
        }

        return fetchAndCacheRoute(routeKey, url, abortController.signal);
      })
      .then((route) => {
        if (!route || abortController.signal.aborted || persistentMapState.routeKey !== routeKey) {
          return;
        }

        setRouteCoordinates(route.coordinates);
        onRouteSummaryChange?.({ ...route, source: "network" });
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setRouteCoordinates([]);
        onRouteSummaryChange?.(
          typeof navigator !== "undefined" && !navigator.onLine
            ? { distanceMeters: 0, durationSeconds: 0, unavailableReason: "offline-missing-route" }
            : { distanceMeters: 0, durationSeconds: 0, unavailableReason: "request-failed" },
        );
      });

    return () => abortController.abort();
  }, [
    accessToken,
    userPosition?.lngLat,
    mapCenter,
    nextStop,
    ready,
    routeMode,
    routeOpen,
    routeStops,
    onRouteSummaryChange,
  ]);

  const routeData = useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(
    () => ({
      type: "FeatureCollection",
      features:
        routeCoordinates.length > 1
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: routeCoordinates,
                },
              },
            ]
          : [],
    }),
    [routeCoordinates],
  );

  // --- Route line rendering ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }

    const source = map.getSource(routeSourceId) as GeoJSONSource | undefined;
    if (source) {
      source.setData(routeData);
    } else {
      map.addSource(routeSourceId, { type: "geojson", data: routeData });
      map.addLayer({
        id: routeCasingLayerId,
        type: "line",
        source: routeSourceId,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "hsl(0, 0%, 100%)",
          "line-opacity": 0.9,
          "line-width": routeMode === "drive" ? 7 : 6,
        },
      });
      map.addLayer({
        id: routeLayerId,
        type: "line",
        source: routeSourceId,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#9fe870",
          "line-width": routeMode === "drive" ? 4 : 3,
        },
      });
    }

    if (map.getLayer(routeCasingLayerId)) {
      map.setPaintProperty(routeCasingLayerId, "line-width", routeMode === "drive" ? 7 : 6);
    }

    if (map.getLayer(routeLayerId)) {
      map.setPaintProperty(routeLayerId, "line-width", routeMode === "drive" ? 4 : 3);
    }
  }, [ready, routeData, routeMode]);

  if (!accessToken) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-secondary text-center">
        <div className="max-w-xs rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
          Add <span className="font-medium text-foreground">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</span> to load Mapbox Streets.
        </div>
      </div>
    );
  }

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" aria-label={`Map of ${mapConfig.label}`} />
      {userPosition ? (
        <button
          type="button"
          onClick={handleRecenter}
          className={[
            "absolute right-4 top-[5.25rem] z-30 grid size-11 place-items-center rounded-full bg-card text-foreground ring-1 ring-border transition-colors hover:bg-secondary sm:right-8 sm:top-24",
            routeOpen && isFollowingUser ? "text-blue-600" : "",
          ].join(" ")}
          aria-label="Recenter on your location"
          title="Recenter"
        >
          <LocateFixed className="size-4" />
        </button>
      ) : null}
    </>
  );
};

export default MapboxStreetsMap;
