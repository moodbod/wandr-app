import type { RouteSummary } from "@/components/MapboxStreetsMap";
import type { Spot } from "@/data/destinations";

export type LngLat = [number, number];

export type OfflineAreaStatus = "ready" | "failed";

export type OfflineAreaRecord = {
  id: string;
  label: string;
  center: LngLat;
  radiusMeters: number;
  routeMode: "walk" | "drive";
  spotIds: string[];
  routeKeys: string[];
  createdAt: number;
  updatedAt: number;
  status: OfflineAreaStatus;
};

export type CachedRoutePayload = RouteSummary & {
  coordinates: LngLat[];
  updatedAt: number;
};

type OfflineMapDb = IDBDatabase;

const dbName = "wandr.offlineMap.v1";
const areaStore = "areas";
const routeStore = "routes";
const imageCacheName = "wandr-offline-images";
const mapboxCacheName = "wandr-mapbox";
const directionsCacheName = "wandr-directions";

function isBrowser() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDb(): Promise<OfflineMapDb> {
  if (!isBrowser()) {
    return Promise.reject(new Error("Offline map storage is unavailable."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(areaStore)) {
        db.createObjectStore(areaStore, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(routeStore)) {
        db.createObjectStore(routeStore, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline map storage."));
  });
}

async function getAllFromStore<T>(storeName: string): Promise<T[]> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as T[]);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function putInStore<T>(storeName: string, value: T): Promise<void> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function getFromStore<T>(storeName: string, key: string): Promise<T | null> {
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve((request.result as T | undefined) ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function distanceMeters(a: LngLat, b: LngLat) {
  const earthRadius = 6_371_000;
  const dLat = toRadians(b[1] - a[1]);
  const dLng = toRadians(b[0] - a[0]);
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function spotsInsideRadius(spots: Spot[], center: LngLat, radiusMeters: number) {
  return spots.filter((spot) => distanceMeters(center, spot.lngLat) <= radiusMeters);
}

export function estimateOfflineDownload(spots: Spot[], radiusMeters: number) {
  const imageMb = Math.max(1, spots.length * 0.35);
  const routeMb = Math.max(1, spots.length * 0.08);
  const mapMb = Math.max(8, Math.round((radiusMeters / 1000) * 5));
  return Math.round(imageMb + routeMb + mapMb);
}

function roundCoord([lng, lat]: LngLat) {
  return `${lng.toFixed(5)},${lat.toFixed(5)}`;
}

export function buildRouteCacheKey(origin: LngLat, stops: LngLat[], mode: "walk" | "drive") {
  return [mode, roundCoord(origin), ...stops.map(roundCoord)].join("|");
}

export function buildDirectionsUrl(origin: LngLat, stops: LngLat[], mode: "walk" | "drive", accessToken: string) {
  const profile = mode === "walk" ? "walking" : "driving";
  const coordinateParam = [origin, ...stops].map(([lng, lat]) => `${lng},${lat}`).join(";");
  const url = new URL(`https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinateParam}`);
  url.searchParams.set("alternatives", "false");
  url.searchParams.set("continue_straight", "false");
  url.searchParams.set("geometries", "geojson");
  url.searchParams.set("overview", "full");
  url.searchParams.set("steps", "false");
  url.searchParams.set("access_token", accessToken);
  return url;
}

export async function listOfflineAreas() {
  try {
    return await getAllFromStore<OfflineAreaRecord>(areaStore);
  } catch {
    return [];
  }
}

export async function saveOfflineArea(area: OfflineAreaRecord) {
  await putInStore(areaStore, area);
}

export async function saveRouteGeometry(key: string, payload: CachedRoutePayload) {
  await putInStore(routeStore, { key, payload });
}

export async function readRouteGeometry(key: string) {
  const row = await getFromStore<{ key: string; payload: CachedRoutePayload }>(routeStore, key);
  return row?.payload ?? null;
}

export async function cacheResponse(request: RequestInfo | URL, cacheName = mapboxCacheName) {
  if (typeof caches === "undefined") {
    return;
  }

  const response = await fetch(request);
  if (!response.ok) {
    return;
  }

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

export async function cacheImage(url: string) {
  if (!url || url.startsWith("data:")) {
    return;
  }

  try {
    await cacheResponse(url, imageCacheName);
  } catch {
    // Image warming should not block the offline package.
  }
}

export async function fetchAndCacheRoute(key: string, url: URL, signal?: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Directions request failed: ${response.status}`);
  }

  if (typeof caches !== "undefined") {
    const cache = await caches.open(directionsCacheName);
    await cache.put(url.toString(), response.clone());
  }

  const data = (await response.json()) as {
    routes?: Array<{
      distance?: number;
      duration?: number;
      geometry?: { coordinates?: LngLat[] };
    }>;
  };
  const route = data.routes?.[0];

  if (!route?.geometry?.coordinates || typeof route.distance !== "number" || typeof route.duration !== "number") {
    throw new Error("Directions response did not include a road route.");
  }

  const payload: CachedRoutePayload = {
    coordinates: route.geometry.coordinates,
    distanceMeters: route.distance,
    durationSeconds: route.duration,
    updatedAt: Date.now(),
  };
  await saveRouteGeometry(key, payload);
  return payload;
}

export async function deleteOfflineArea(areaId: string) {
  const db = await openDb();

  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(areaStore, "readwrite");
    tx.objectStore(areaStore).delete(areaId);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
