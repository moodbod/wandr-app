import { describe, expect, it } from "vitest";
import {
  buildDirectionsUrl,
  buildRouteCacheKey,
  distanceMeters,
  estimateOfflineDownload,
  spotsInsideRadius,
} from "@/lib/offlineMapStorage";
import type { Spot } from "@/data/destinations";

const center: [number, number] = [17.0832, -22.5597];
const nearby: Spot = {
  id: "nearby",
  name: "Nearby",
  category: "see",
  top: "0",
  left: "0",
  lngLat: [17.0922, -22.5474],
  walkMin: 8,
  driveMin: 4,
  tip: "Near",
  tag: "Near",
  image: "/near.jpg",
};
const far: Spot = {
  ...nearby,
  id: "far",
  name: "Far",
  lngLat: [14.5247, -22.6821],
};

describe("offline map storage helpers", () => {
  it("filters picks by manual download radius", () => {
    expect(spotsInsideRadius([nearby, far], center, 3_000).map((spot) => spot.id)).toEqual(["nearby"]);
  });

  it("builds stable route keys from rounded coordinates and mode", () => {
    expect(buildRouteCacheKey(center, [nearby.lngLat], "walk")).toBe("walk|17.08320,-22.55970|17.09220,-22.54740");
  });

  it("keeps Mapbox Directions URLs aligned with route rendering", () => {
    const url = buildDirectionsUrl(center, [nearby.lngLat], "drive", "token");

    expect(url.pathname).toBe("/directions/v5/mapbox/driving/17.0832,-22.5597;17.0922,-22.5474");
    expect(url.searchParams.get("geometries")).toBe("geojson");
    expect(url.searchParams.get("overview")).toBe("full");
  });

  it("returns practical non-zero estimates for small areas", () => {
    expect(distanceMeters(center, nearby.lngLat)).toBeGreaterThan(1_000);
    expect(estimateOfflineDownload([nearby], 3_000)).toBeGreaterThanOrEqual(16);
  });
});
