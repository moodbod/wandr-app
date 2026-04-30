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
  routeOpen: boolean;
  routeMode: "walk" | "drive";
  onOpenSpot: (spotId: string) => void;
};

const routeSourceId = "wandr-route";
const routeLayerId = "wandr-route-line";
type LngLat = [number, number];
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
  routeOpen,
  routeMode,
  onOpenSpot,
}: Props) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const geolocateControlRef = useRef<GeolocateControl | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [ready, setReady] = useState(false);
  const [currentPosition, setCurrentPosition] = useState<CurrentPosition | null>(null);
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
      const isNext = spot.id === nextStop?.id;
      const button = document.createElement("button");
      button.type = "button";
      button.className = [
        "wandr-photo-marker",
        `wandr-photo-marker--${markerTone(spot)}`,
        isNext ? "wandr-photo-marker--active" : "",
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

      const label = document.createElement("span");
      label.textContent = spot.name;
      label.className = "wandr-photo-marker__label";

      const stem = document.createElement("span");
      stem.className = "wandr-photo-marker__stem";

      visual.append(photoWrap, label, stem);
      button.append(visual);

      markersRef.current.push(
        new mapboxgl.Marker({ element: button, anchor: "bottom" })
          .setLngLat(spot.lngLat)
          .addTo(map)
      );
    });
  }, [nextStop?.id, onOpenSpot, ready, spots]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) {
      return;
    }

    const data: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
      type: "FeatureCollection",
      features:
        routeOpen && nextStop
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: [currentPosition?.lngLat ?? destination.map.center, nextStop.lngLat],
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
        id: routeLayerId,
        type: "line",
        source: routeSourceId,
        paint: {
          "line-color": "hsl(14, 80%, 56%)",
          "line-width": routeMode === "drive" ? 3 : 2,
          "line-dasharray": routeMode === "drive" ? [1, 0] : [1, 3],
        },
      });
    }

    if (map.getLayer(routeLayerId)) {
      map.setPaintProperty(routeLayerId, "line-width", routeMode === "drive" ? 3 : 2);
      map.setPaintProperty(routeLayerId, "line-dasharray", routeMode === "drive" ? [1, 0] : [1, 3]);
    }
  }, [currentPosition?.lngLat, destination.map.center, nextStop, ready, routeMode, routeOpen]);

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
