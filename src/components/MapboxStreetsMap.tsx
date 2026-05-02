"use client";

import { useEffect, useRef, useState } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import mapboxgl, {
  LngLatBounds,
  type GeolocateControl,
  type GeoJSONSource,
  type Map as MapboxMap,
  type Marker,
} from "mapbox-gl";
import type { Spot } from "@/data/destinations";

type Props = {
  mapConfig: {
    center: [number, number];
    zoom: number;
    label: string;
  };
  spots: Spot[];
  visibleSpotIds?: string[];
  nextStop?: Spot;
  highlightedSpotId?: string | null;
  routeStops: Spot[];
  routeOpen: boolean;
  routeMode: "walk" | "drive";
  onOpenSpot: (spotId: string) => void;
  onRouteSummaryChange?: (summary: RouteSummary | null) => void;
};

const routeSourceId = "wandr-route";
const routeLayerId = "wandr-route-line";
const routeCasingLayerId = "wandr-route-line-casing";
type LngLat = [number, number];
export type RouteSummary = {
  distanceMeters: number;
  durationSeconds: number;
};
type CurrentPosition = {
  lngLat: LngLat;
  accuracy: number;
};
type MarkerEntry = {
  marker: Marker;
  element: HTMLButtonElement;
};
type PersistentMapState = {
  host: HTMLDivElement | null;
  map: MapboxMap | null;
  geolocateControl: GeolocateControl | null;
  markers: Map<string, MarkerEntry>;
  ready: boolean;
  onOpenSpot: ((spotId: string) => void) | null;
};

const persistentMapState: PersistentMapState = {
  host: null,
  map: null,
  geolocateControl: null,
  markers: new Map(),
  ready: false,
  onOpenSpot: null,
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

const wandrMarkerClassNames = [
  "wandr-photo-marker",
  "wandr-photo-marker--see",
  "wandr-photo-marker--eat",
  "wandr-photo-marker--gems",
  "wandr-photo-marker--routes",
  "wandr-photo-marker--active",
];

function applyWandrMarkerClasses(element: HTMLElement, spot: Spot, isHighlighted: boolean) {
  element.classList.remove(...wandrMarkerClassNames);
  element.classList.add("wandr-photo-marker", `wandr-photo-marker--${markerTone(spot)}`);

  if (isHighlighted) {
    element.classList.add("wandr-photo-marker--active");
  }
}

function getFitBoundsPadding(map: MapboxMap) {
  const canvas = map.getCanvas();
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  const horizontalBudget = Math.max(width - 80, 0);
  const verticalBudget = Math.max(height - 80, 0);

  return {
    top: Math.min(140, Math.floor(verticalBudget * 0.28)),
    right: Math.min(80, Math.floor(horizontalBudget * 0.18)),
    bottom: Math.min(260, Math.floor(verticalBudget * 0.46)),
    left: Math.min(80, Math.floor(horizontalBudget * 0.18)),
  };
}

const MapboxStreetsMap = ({
  mapConfig,
  spots,
  visibleSpotIds,
  nextStop,
  highlightedSpotId,
  routeStops,
  routeOpen,
  routeMode,
  onOpenSpot,
  onRouteSummaryChange,
}: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const geolocateControlRef = useRef<GeolocateControl | null>(null);
  const markersRef = useRef<Map<string, MarkerEntry>>(persistentMapState.markers);
  const hasTriggeredGeolocationRef = useRef(false);
  const [ready, setReady] = useState(() => persistentMapState.ready);
  const [currentPosition, setCurrentPosition] = useState<CurrentPosition | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<LngLat[]>([]);
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    persistentMapState.onOpenSpot = onOpenSpot;
  }, [onOpenSpot]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container || !accessToken) {
      return;
    }

    mapboxgl.accessToken = accessToken;

    if (!persistentMapState.host) {
      persistentMapState.host = document.createElement("div");
      persistentMapState.host.className = "absolute inset-0 min-h-dvh w-full";
    }

    const host = persistentMapState.host;
    container.append(host);

    if (persistentMapState.map) {
      mapRef.current = persistentMapState.map;
      geolocateControlRef.current = persistentMapState.geolocateControl;
      setReady(persistentMapState.ready || persistentMapState.map.loaded());
      requestAnimationFrame(() => persistentMapState.map?.resize());

      return () => {
        host.remove();
        mapRef.current = null;
        geolocateControlRef.current = null;
      };
    }

    const map = new mapboxgl.Map({
      container: host,
      style: "mapbox://styles/mapbox/streets-v12",
      center: mapConfig.center,
      zoom: mapConfig.zoom,
      attributionControl: false,
      pitchWithRotate: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    const geolocateControl = new mapboxgl.GeolocateControl({
      fitBoundsOptions: { maxZoom: 16 },
      positionOptions: {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      },
      showAccuracyCircle: true,
      showUserHeading: true,
      showUserLocation: true,
      trackUserLocation: true,
    });
    geolocateControl.on("geolocate", ({ coords }) => {
      setCurrentPosition({
        lngLat: [coords.longitude, coords.latitude],
        accuracy: coords.accuracy,
      });
    });
    geolocateControl.on("error", () => {
      setCurrentPosition(null);
    });
    map.addControl(geolocateControl, "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
    geolocateControlRef.current = geolocateControl;
    persistentMapState.geolocateControl = geolocateControl;
    map.on("load", () => {
      persistentMapState.ready = true;
      setReady(true);
      map.resize();
      requestAnimationFrame(() => map.resize());
    });
    mapRef.current = map;
    persistentMapState.map = map;
    requestAnimationFrame(() => map.resize());

    return () => {
      host.remove();
      geolocateControlRef.current = null;
      mapRef.current = null;
    };
  }, [accessToken, mapConfig.center, mapConfig.zoom]);

  useEffect(() => {
    if (!ready || !routeOpen || currentPosition || hasTriggeredGeolocationRef.current) {
      return;
    }

    hasTriggeredGeolocationRef.current = true;
    geolocateControlRef.current?.trigger();
  }, [currentPosition, ready, routeOpen]);

  useEffect(() => {
    const container = containerRef.current;
    const map = mapRef.current;
    if (!container || !map) {
      return;
    }

    const resizeMap = () => {
      map.resize();
    };

    const resizeObserver = new ResizeObserver(resizeMap);

    resizeObserver.observe(container);
    window.addEventListener("resize", resizeMap);
    window.visualViewport?.addEventListener("resize", resizeMap);
    requestAnimationFrame(resizeMap);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", resizeMap);
      window.visualViewport?.removeEventListener("resize", resizeMap);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }

    if (currentPosition) {
      return;
    }

    map.flyTo({
      center: mapConfig.center,
      zoom: mapConfig.zoom,
      duration: 700,
      essential: true,
    });
  }, [currentPosition, mapConfig, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || currentPosition || spots.length === 0) {
      return;
    }

    const bounds = new LngLatBounds();
    spots.forEach((spot) => bounds.extend(spot.lngLat));
    map.fitBounds(bounds, {
      padding: getFitBoundsPadding(map),
      maxZoom: 12,
      duration: 700,
      essential: true,
    });
  }, [currentPosition, ready, spots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }

    const nextSpotIds = new Set(spots.map((spot) => spot.id));
    markersRef.current.forEach(({ marker }, spotId) => {
      if (!nextSpotIds.has(spotId)) {
        marker.remove();
        markersRef.current.delete(spotId);
      }
    });

    spots.forEach((spot) => {
      if (markersRef.current.has(spot.id)) {
        return;
      }

      const button = document.createElement("button");
      button.type = "button";
      applyWandrMarkerClasses(button, spot, spot.id === highlightedSpotId);
      button.ariaLabel = `Open details for ${spot.name}`;
      button.addEventListener("click", () => persistentMapState.onOpenSpot?.(spot.id));

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

      markersRef.current.set(spot.id, { marker, element: button });
    });
  }, [highlightedSpotId, onOpenSpot, ready, spots]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const visibleIds = visibleSpotIds ? new Set(visibleSpotIds) : null;
    const spotMap = new Map(spots.map((spot) => [spot.id, spot]));

    markersRef.current.forEach(({ element, marker }, spotId) => {
      const spot = spotMap.get(spotId);

      if (!spot) {
        return;
      }

      marker.setLngLat(spot.lngLat);
      applyWandrMarkerClasses(element, spot, spot.id === highlightedSpotId);
      element.hidden = visibleIds ? !visibleIds.has(spotId) : false;
    });
  }, [highlightedSpotId, ready, spots, visibleSpotIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }

    const routeTargets = routeOpen ? (routeStops.length > 0 ? routeStops : nextStop ? [nextStop] : []) : [];
    const origin = currentPosition?.lngLat ?? mapConfig.center;
    const coordinates = [origin, ...routeTargets.map((spot) => spot.lngLat)];
    const abortController = new AbortController();

    if (!routeOpen || coordinates.length < 2 || !accessToken) {
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
    url.searchParams.set("overview", "full");
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
    currentPosition?.lngLat,
    mapConfig.center,
    nextStop,
    ready,
    routeMode,
    routeOpen,
    routeStops,
    onRouteSummaryChange,
  ]);

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
          "line-color": "hsl(14, 80%, 56%)",
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

  return <div ref={containerRef} className="absolute inset-0 min-h-dvh w-full" aria-label={`Map of ${mapConfig.label}`} />;
};

export default MapboxStreetsMap;
