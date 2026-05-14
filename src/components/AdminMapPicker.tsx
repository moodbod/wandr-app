"use client";

import { useEffect, useRef, useState } from "react";
import mapboxgl, { type Map as MapboxMap, type Marker } from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Loader2 } from "lucide-react";

type AdminMapPickerProps = {
  center: [number, number];
  zoom: number;
  markerLngLat?: [number, number] | null;
  onChange?: (lng: number, lat: number) => void;
  onZoomChange?: (zoom: number) => void;
  onCenterChange?: (lng: number, lat: number) => void;
  markerLabel?: string;
};

export function AdminMapPicker({ center, zoom, markerLngLat, onChange, onZoomChange, onCenterChange, markerLabel }: AdminMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
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

    mapRef.current = map;

    map.on("error", (e) => {
      console.error("Mapbox error:", e);
      setError(e.error?.message || "Failed to load map");
    });

    map.on("load", () => {
      setReady(true);
      setTimeout(() => map.resize(), 100);
    });

    map.on("click", (e) => {
      onChange?.(e.lngLat.lng, e.lngLat.lat);
    });

    map.on("moveend", () => {
      const newCenter = map.getCenter();
      onCenterChange?.(newCenter.lng, newCenter.lat);
      onZoomChange?.(map.getZoom());
    });

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
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]); // Only re-initialize if token changes

  // Handle map view updates
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    map.jumpTo({
      center,
      zoom,
    });
    map.resize();
  }, [center[0], center[1], zoom, ready]);

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
          onChange?.(lngLat.lng, lngLat.lat);
        }
      });
    } else {
      markerRef.current.setLngLat(markerLngLat);
    }

    // Handle popup/label
    if (markerLabel && markerRef.current) {
      const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
        .setHTML(`<div class="px-1 py-0.5 font-bold text-xs">${markerLabel}</div>`);
      markerRef.current.setPopup(popup);
      if (!popup.isOpen()) {
        markerRef.current.togglePopup();
      }
    } else if (markerRef.current) {
      markerRef.current.setPopup(null);
    }
  }, [markerLngLat, ready, onChange, markerLabel]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || !accessToken) return;

    setIsSearching(true);
    try {
      const resp = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          searchQuery
        )}.json?access_token=${accessToken}&limit=1`
      );
      const data = await resp.json();
      const feature = data.features?.[0];
      if (feature) {
        const [lng, lat] = feature.center;
        mapRef.current?.flyTo({ center: [lng, lat], zoom: 14 });
        onChange?.(lng, lat);
        setSearchQuery("");
      }
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

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
    <div className="relative h-[300px] w-full overflow-hidden rounded-lg border border-border bg-[#f3f4f6]">
      <div 
        ref={containerRef} 
        className="absolute inset-0" 
        style={{ width: '100%', height: '300px', display: 'block' }} 
      />
      
      {/* Search Overlay */}
      <div className="absolute top-2 left-2 right-12 z-20">
        <form 
          onSubmit={handleSearch}
          className="flex gap-1.5"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Find any location..."
            className="flex-1 h-9 rounded-lg border border-border bg-background/95 px-3 text-xs shadow-sm focus:outline-none focus:ring-2 ring-accent/50 backdrop-blur"
          />
          <button
            type="submit"
            disabled={isSearching}
            className="h-9 px-3 rounded-lg bg-foreground text-background text-xs font-medium shadow-sm active:scale-95 transition-transform disabled:opacity-50"
          >
            {isSearching ? "..." : "Search"}
          </button>
        </form>
      </div>

      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-[2px] z-20">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-destructive/5 px-4 text-center z-20">
          <div className="text-xs text-destructive font-medium">
            {error}
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-2 left-2 right-12 z-10 rounded-md bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
        Drag marker to set spot, drag map to set destination center
      </div>
    </div>
  );
}
