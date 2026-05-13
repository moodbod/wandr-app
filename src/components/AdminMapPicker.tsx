"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl, { type Map as MapboxMap, type Marker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type AdminMapPickerProps = {
  center: [number, number];
  zoom: number;
  markerLngLat: [number, number] | null;
  onChange: (lng: number, lat: number) => void;
};

export function AdminMapPicker({ center, zoom, markerLngLat, onChange }: AdminMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

  useEffect(() => {
    if (!containerRef.current || !accessToken || mapRef.current) {
      return;
    }

    const container = containerRef.current;
    mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      container,
      style: "mapbox://styles/mapbox/streets-v12",
      center,
      zoom,
      attributionControl: false,
      pitchWithRotate: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", () => {
      setReady(true);
    });

    map.on("click", (e) => {
      onChange(e.lngLat.lng, e.lngLat.lat);
    });

    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, center[0], center[1], zoom]); // Center and zoom as dependencies if destination changes

  // Handle marker updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    if (!markerLngLat) {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      return;
    }

    if (!markerRef.current) {
      markerRef.current = new mapboxgl.Marker({
        draggable: true,
        color: "hsl(0, 0%, 10%)", // Dark marker for admin
      })
        .setLngLat(markerLngLat)
        .addTo(map);

      markerRef.current.on("dragend", () => {
        const lngLat = markerRef.current?.getLngLat();
        if (lngLat) {
          onChange(lngLat.lng, lngLat.lat);
        }
      });
    } else {
      markerRef.current.setLngLat(markerLngLat);
    }
  }, [markerLngLat, ready, onChange]);

  if (!accessToken) {
    return (
      <div className="grid h-full place-items-center rounded-lg border border-border bg-secondary text-center">
        <div className="p-4 text-sm text-muted-foreground">
          Mapbox token required
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[300px] w-full overflow-hidden rounded-lg border border-border">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute bottom-2 left-2 right-12 z-10 rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
        Click or drag the marker to set coordinates
      </div>
    </div>
  );
}
