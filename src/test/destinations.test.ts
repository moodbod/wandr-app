import { describe, expect, it } from "vitest";
import { destinations } from "@/data/destinations";

describe("Namibia destination seed data", () => {
  it("uses Namibia as the starting test market", () => {
    expect(destinations.length).toBeGreaterThan(0);
    expect(destinations.every((destination) => destination.country === "Namibia")).toBe(true);
  });

  it("includes real map coordinates for each seeded spot", () => {
    for (const destination of destinations) {
      expect(destination.map.center).toHaveLength(2);
      expect(destination.spots.length).toBeGreaterThanOrEqual(3);

      for (const spot of destination.spots) {
        expect(spot.lngLat).toHaveLength(2);
        expect(Number.isFinite(spot.lngLat[0])).toBe(true);
        expect(Number.isFinite(spot.lngLat[1])).toBe(true);
      }
    }
  });
});
