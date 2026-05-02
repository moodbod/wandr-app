import { getCurrentStop, orderedTripStops, type RouteMode, type TripStatus, type TripStopStatus } from "@/lib/tripPlanner";

export type PersistedTrip = {
  _id: string;
  destinationId?: string;
  title: string;
  status: TripStatus;
  routeMode: RouteMode;
};

export type PersistedTripStop = {
  _id: string;
  spotId: string;
  position: number;
  status: TripStopStatus;
};

export type PersistedTripData = {
  trip: PersistedTrip;
  stops: PersistedTripStop[];
};

export type OfflineTripAction =
  | {
      id: string;
      tripId: string;
      createdAt: number;
      type: "markDone";
      tripStopId: string;
    }
  | {
      id: string;
      tripId: string;
      createdAt: number;
      type: "skip";
      tripStopId: string;
    }
  | {
      id: string;
      tripId: string;
      createdAt: number;
      type: "setRouteMode";
      routeMode: RouteMode;
    }
  | {
      id: string;
      tripId: string;
      createdAt: number;
      type: "moveStop";
      tripStopId: string;
      direction: "up" | "down";
    };

type NewOfflineTripAction = OfflineTripAction extends infer Action
  ? Action extends OfflineTripAction
    ? Omit<Action, "id" | "createdAt">
    : never
  : never;

export type ActiveTripSnapshot = PersistedTripData & {
  destinationId: string;
  routeOpen: boolean;
  routedSpotId: string | null;
  lastViewedAt: number;
};

const snapshotKey = "wandr.activeTrip.snapshot.v1";
const queueKey = "wandr.activeTrip.offlineQueue.v1";

function isBrowser() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readJson<T>(key: string): T | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function readActiveTripSnapshot() {
  return readJson<ActiveTripSnapshot>(snapshotKey);
}

export function saveActiveTripSnapshot(snapshot: ActiveTripSnapshot) {
  writeJson(snapshotKey, snapshot);
}

export function clearActiveTripSnapshot() {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.removeItem(snapshotKey);
}

export function readOfflineTripQueue() {
  return readJson<OfflineTripAction[]>(queueKey) ?? [];
}

export function saveOfflineTripQueue(queue: OfflineTripAction[]) {
  writeJson(queueKey, queue);
}

export function createOfflineAction(action: NewOfflineTripAction): OfflineTripAction {
  return {
    ...action,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    createdAt: Date.now(),
  } as OfflineTripAction;
}

export function applyOfflineAction(snapshot: ActiveTripSnapshot, action: OfflineTripAction): ActiveTripSnapshot {
  if (snapshot.trip._id !== action.tripId) {
    return snapshot;
  }

  const nextSnapshot: ActiveTripSnapshot = {
    ...snapshot,
    trip: { ...snapshot.trip },
    stops: orderedTripStops(snapshot.stops).map((stop) => ({ ...stop })),
    lastViewedAt: Date.now(),
  };

  if (action.type === "setRouteMode") {
    nextSnapshot.trip.routeMode = action.routeMode;
    return nextSnapshot;
  }

  if (action.type === "moveStop") {
    const index = nextSnapshot.stops.findIndex((stop) => stop._id === action.tripStopId);
    const nextIndex = action.direction === "up" ? index - 1 : index + 1;

    if (index < 0 || nextIndex < 0 || nextIndex >= nextSnapshot.stops.length) {
      return nextSnapshot;
    }

    const current = nextSnapshot.stops[index];
    const other = nextSnapshot.stops[nextIndex];
    nextSnapshot.stops[index] = { ...other, position: current.position };
    nextSnapshot.stops[nextIndex] = { ...current, position: other.position };
    return nextSnapshot;
  }

  if (nextSnapshot.trip.status !== "active") {
    return nextSnapshot;
  }

  const target = nextSnapshot.stops.find((stop) => stop._id === action.tripStopId);

  if (!target || target.status === "done" || target.status === "skipped") {
    return nextSnapshot;
  }

  target.status = action.type === "markDone" ? "done" : "skipped";
  const nextCurrent = orderedTripStops(nextSnapshot.stops).find((stop) => stop.position > target.position && stop.status === "planned");

  if (nextCurrent) {
    nextCurrent.status = "current";
  } else {
    nextSnapshot.trip.status = "completed";
  }

  nextSnapshot.routedSpotId = getCurrentStop(nextSnapshot.stops, nextSnapshot.trip.status)?.spotId ?? null;
  return nextSnapshot;
}
