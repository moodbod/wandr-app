export type TripStatus = "planning" | "active" | "completed";
export type TripStopStatus = "planned" | "current" | "done" | "skipped";
export type RouteMode = "walk" | "drive";

export type TripStopView = {
  _id: string;
  spotId: string;
  position: number;
  status: TripStopStatus;
};

export function orderedTripStops<T extends { position: number }>(stops: T[]) {
  return [...stops].sort((a, b) => a.position - b.position);
}

export function hasTripSpot(stops: TripStopView[], spotId: string) {
  return stops.some((stop) => stop.spotId === spotId);
}

export function getCurrentStop(stops: TripStopView[], status?: TripStatus) {
  const orderedStops = orderedTripStops(stops);

  if (status === "active") {
    return orderedStops.find((stop) => stop.status === "current") ?? null;
  }

  return orderedStops.find((stop) => stop.status === "planned") ?? orderedStops[0] ?? null;
}

export function getTripProgress(stops: TripStopView[]) {
  const finished = stops.filter((stop) => stop.status === "done" || stop.status === "skipped").length;
  return { finished, total: stops.length };
}

export function getRouteStopIds(stops: TripStopView[], status?: TripStatus) {
  const orderedStops = orderedTripStops(stops);

  if (status === "completed") {
    return [];
  }

  if (status === "active") {
    return orderedStops
      .filter((stop) => stop.status === "current" || stop.status === "planned")
      .map((stop) => stop.spotId);
  }

  return orderedStops
    .filter((stop) => stop.status !== "done" && stop.status !== "skipped")
    .map((stop) => stop.spotId);
}
