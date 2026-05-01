"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl, {
  type GeolocateControl,
  type GeoJSONSource,
  type Map as MapboxMap,
  type Marker,
} from "mapbox-gl";
import type { Destination, Spot } from "@/data/destinations";

type Props = {
  destination: Destination;
  spots: Spot[];
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
  destination,
  spots,
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
  const markersRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<CurrentPosition | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<LngLat[]>([]);
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    if (!containerRef.current || !accessToken || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: destination.map.center,
      zoom: destination.map.zoom,
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
    map.on("load", () => {
      setReady(true);
      geolocateControl.trigger();
    });
    mapRef.current = map;

    return () => {
      geolocateControlRef.current = null;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [accessToken, destination.map.center, destination.map.zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }

    if (currentPosition) {
      return;
    }

    map.flyTo({
      center: destination.map.center,
      zoom: destination.map.zoom,
      duration: 700,
      essential: true,
    });
  }, [currentPosition, destination, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    spots.forEach((spot) => {
      const isHighlighted = spot.id === highlightedSpotId;
      const button = document.createElement("button");
      button.type = "button";
      button.className = [
        "wandr-photo-marker",
        `wandr-photo-marker--${markerTone(spot)}`,
        isHighlighted ? "wandr-photo-marker--active" : "",
      ].join(" ");
      button.ariaLabel = `Open details for ${spot.name}`;
      button.addEventListener("click", () => onOpenSpot(spot.id));

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

      markersRef.current.push(
        new mapboxgl.Marker({ element: button, anchor: "bottom" })
          .setLngLat(spot.lngLat)
          .addTo(map)
      );
    });
  }, [highlightedSpotId, onOpenSpot, ready, spots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }

    const routeTargets = routeStops.length > 0 ? routeStops : routeOpen && nextStop ? [nextStop] : [];
    const origin = currentPosition?.lngLat ?? destination.map.center;
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
    destination.map.center,
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

  return <div ref={containerRef} className="absolute inset-0" aria-label={`Map of ${destination.city}`} />;
};

export default MapboxStreetsMap;
