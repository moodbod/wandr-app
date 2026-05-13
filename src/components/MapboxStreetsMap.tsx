"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl, {
  LngLatBounds,
  type GeoJSONSource,
  type Map as MapboxMap,
  type Marker,
} from "mapbox-gl";
import type { UserPosition } from "@/hooks/useUserLocation";
import type { Spot } from "@/data/destinations";

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
type LngLat = [number, number];
export type RouteSummary = {
  distanceMeters: number;
  durationSeconds: number;
};
type MarkerHandle = {
  id: string;
  element: HTMLButtonElement;
  marker: Marker;
};

const categoryInitials: Record<Spot["category"], string> = {
  eat: "E",
  see: "S",
  gems: "G",
  routes: "R",
};

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
  const mapRef = useRef<MapboxMap | null>(null);
  const markersRef = useRef<MarkerHandle[]>([]);
  const [ready, setReady] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<LngLat[]>([]);
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  // Track whether we've done the initial center so we don't fight the user
  const didInitialCenterRef = useRef(false);

  // --- Map initialization ---
  useEffect(() => {
    if (!containerRef.current || !accessToken || mapRef.current) {
      return;
    }

    const container = containerRef.current;
    mapboxgl.accessToken = accessToken;

    // Use persisted position as initial center if available
    const initialCenter = userPosition?.lngLat ?? mapConfig.center;
    const initialZoom = userPosition ? 14 : mapConfig.zoom;

    const map = new mapboxgl.Map({
      container,
      style: "mapbox://styles/mapbox/streets-v12",
      center: initialCenter,
      zoom: initialZoom,
      attributionControl: false,
      pitchWithRotate: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");

    map.on("load", () => {
      // Add user position source + layers
      map.addSource(userSourceId, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Accuracy circle (subtle blue fill)
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

      // Outer glow
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

      // Inner blue dot
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

      setReady(true);
    });
    mapRef.current = map;

    let resizeFrame: number | null = null;
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (resizeFrame !== null) {
              window.cancelAnimationFrame(resizeFrame);
            }

            resizeFrame = window.requestAnimationFrame(() => {
              map.resize();
              resizeFrame = null;
            });
          });
    resizeObserver?.observe(container);

    return () => {
      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame);
      }
      resizeObserver?.disconnect();
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

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
    if (!map || !ready || didInitialCenterRef.current) {
      return;
    }

    if (userPosition) {
      didInitialCenterRef.current = true;
      return;
    }

    if (spots.length === 0) {
      return;
    }

    didInitialCenterRef.current = true;
    const bounds = new LngLatBounds();
    spots.forEach((spot) => bounds.extend(spot.lngLat));
    map.fitBounds(bounds, {
      padding: { top: 140, right: 80, bottom: 260, left: 80 },
      maxZoom: 12,
      duration: 700,
      essential: true,
    });
  }, [ready, spots, userPosition]);

  // --- Follow mode: recenter on user when routing is active ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !routeOpen || !userPosition) {
      return;
    }

    map.easeTo({
      center: userPosition.lngLat,
      duration: 600,
      essential: false,
    });
  }, [ready, routeOpen, userPosition]);

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

      const avatar = document.createElement("span");
      avatar.className = "wandr-photo-marker__avatar";
      avatar.textContent = categoryInitials[spot.category];
      photoWrap.append(avatar);

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
    const origin = userPosition?.lngLat ?? mapConfig.center;
    const coordinates = [origin, ...routeTargets.map((spot) => spot.lngLat)];
    const abortController = new AbortController();

    if (coordinates.length < 2 || !accessToken) {
      setRouteCoordinates([]);
      onRouteSummaryChange?.(null);
      return () => abortController.abort();
    }

    const profile = routeMode === "walk" ? "walking" : "driving";
    const coordinateParam = coordinates.map(([lng, lat]) => `${lng},${lat}`).join(";");
    const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinateParam}`);
    url.searchParams.set("alternatives", "false");
    url.searchParams.set("continue_straight", "false");
    url.searchParams.set("geometries", "geojson");
    url.searchParams.set("overview", "simplified");
    url.searchParams.set("steps", "false");
    url.searchParams.set("access_token", accessToken);

    fetch(url, { signal: abortController.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Directions request failed: ${response.status}`);
        }

        return response.json() as Promise<{
          routes?: Array<{
            distance?: number;
            duration?: number;
            geometry?: { coordinates?: LngLat[] };
          }>;
        }>;
      })
      .then((data) => {
        const route = data.routes?.[0];
        setRouteCoordinates(route?.geometry?.coordinates ?? []);
        onRouteSummaryChange?.(
          typeof route?.distance === "number" && typeof route.duration === "number"
            ? { distanceMeters: route.distance, durationSeconds: route.duration }
            : null,
        );
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setRouteCoordinates([]);
        onRouteSummaryChange?.(null);
      });

    return () => abortController.abort();
  }, [
    accessToken,
    userPosition?.lngLat,
    mapConfig.center,
    nextStop,
    ready,
    routeMode,
    routeOpen,
    routeStops,
    onRouteSummaryChange,
  ]);

  // --- Route line rendering ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }

    const data: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
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
    };

    const source = map.getSource(routeSourceId) as GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
    } else {
      map.addSource(routeSourceId, { type: "geojson", data });
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
  }, [ready, routeCoordinates, routeMode]);

  if (!accessToken) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-secondary text-center">
        <div className="max-w-xs rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground shadow-sm">
          Add <span className="font-medium text-foreground">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</span> to load Mapbox Streets.
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="absolute inset-0" aria-label={`Map of ${mapConfig.label}`} />;
};

export default MapboxStreetsMap;
