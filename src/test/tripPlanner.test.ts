import { describe, expect, it } from "vitest";
import {
  getCurrentStop,
  getRouteStopIds,
  getTripProgress,
  hasTripSpot,
  orderedTripStops,
  type TripStopView,
} from "@/lib/tripPlanner";

const stops: TripStopView[] = [
  { _id: "stop-2", spotId: "second", position: 1, status: "planned" },
  { _id: "stop-1", spotId: "first", position: 0, status: "done" },
  { _id: "stop-3", spotId: "third", position: 2, status: "current" },
];

describe("trip planner helpers", () => {
  it("orders stops by position without mutating the source list", () => {
    const ordered = orderedTripStops(stops);

    expect(ordered.map((stop) => stop.spotId)).toEqual(["first", "second", "third"]);
    expect(stops[0]?.spotId).toBe("second");
  });

  it("detects duplicate spots in a trip", () => {
    expect(hasTripSpot(stops, "second")).toBe(true);
    expect(hasTripSpot(stops, "missing")).toBe(false);
  });

  it("uses the current stop during an active trip", () => {
    expect(getCurrentStop(stops, "active")?.spotId).toBe("third");
  });

  it("uses the first planned stop while planning", () => {
    expect(getCurrentStop(stops, "planning")?.spotId).toBe("second");
  });

  it("summarizes completed and skipped progress", () => {
    expect(getTripProgress([...stops, { _id: "stop-4", spotId: "fourth", position: 3, status: "skipped" }])).toEqual({
      finished: 2,
      total: 4,
    });
  });

  it("returns remaining route stops for active trips", () => {
    expect(getRouteStopIds(stops, "active")).toEqual(["second", "third"]);
  });

  it("does not route completed trips", () => {
    expect(getRouteStopIds(stops, "completed")).toEqual([]);
  });
});
