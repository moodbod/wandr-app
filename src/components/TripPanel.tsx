import React from "react";
import {
  ArrowDown,
  ArrowUp,
  Car,
  Check,
  Footprints,
  ListChecks,
  MapPin,
  Navigation,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { Spot } from "@/data/destinations";
import {
  getCurrentStop,
  getTripProgress,
  hasTripSpot,
  orderedTripStops,
  type RouteMode,
  type TripStatus,
  type TripStopStatus,
  type TripStopView,
} from "@/lib/tripPlanner";

export type TripPanelTrip = {
  _id: string;
  title: string;
  status: TripStatus;
  routeMode: RouteMode;
};

export type TripPanelStop = TripStopView & {
  status: TripStopStatus;
};

export type TripPanelData = {
  trip: TripPanelTrip;
  stops: TripPanelStop[];
} | null;

type TripPanelSpot = Spot & {
  destinationId: string;
  destinationCity: string;
  destinationCountry: string;
};

type Props = {
  title: string;
  spots: TripPanelSpot[];
  tripData: TripPanelData | undefined;
  selectedSpot?: TripPanelSpot | null;
  routedSpotId?: string | null;
  onAddSpot: (spot: TripPanelSpot) => void;
  onRemoveStop: (tripStopId: string) => void;
  onMoveStop: (tripStopId: string, direction: "up" | "down") => void;
  onStartTrip: (tripId: string) => void;
  onRouteStop: (spot: TripPanelSpot) => void;
  onMarkDone: (tripStopId: string) => void;
  onSkipStop: (tripStopId: string) => void;
  onRouteModeChange: (tripId: string, mode: RouteMode) => void;
};

const statusLabel: Record<TripStopStatus, string> = {
  planned: "Planned",
  current: "Next up",
  done: "Done",
  skipped: "Skipped",
};

function findSpot(spots: TripPanelSpot[], spotId: string) {
  return spots.find((spot) => spot.id === spotId) ?? null;
}

function TripModeToggle({
  mode,
  onChange,
}: {
  mode: RouteMode;
  onChange: (mode: RouteMode) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-secondary p-1 text-xs font-medium">
      <button
        type="button"
        onClick={() => onChange("walk")}
        className={[
          "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors",
          mode === "walk" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
      >
        <Footprints className="size-3.5" />
        Walk
      </button>
      <button
        type="button"
        onClick={() => onChange("drive")}
        className={[
          "inline-flex min-h-8 items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors",
          mode === "drive" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
      >
        <Car className="size-3.5" />
        Drive
      </button>
    </div>
  );
}

const TripPanel = ({
  title,
  spots: allSpots,
  tripData,
  selectedSpot,
  routedSpotId,
  onAddSpot,
  onRemoveStop,
  onMoveStop,
  onStartTrip,
  onRouteStop,
  onMarkDone,
  onSkipStop,
  onRouteModeChange,
}: Props) => {
  const trip = tripData?.trip ?? null;
  const stops = orderedTripStops(tripData?.stops ?? []);
  const progress = getTripProgress(stops);
  const currentStop = trip ? getCurrentStop(stops, trip.status) : null;
  const currentSpot = currentStop ? findSpot(allSpots, currentStop.spotId) : null;
  const selectedSpotInTrip = selectedSpot ? hasTripSpot(stops, selectedSpot.id) : false;
  const isLoading = tripData === undefined;

  return (
    <aside className="flex h-full min-h-0 flex-col bg-card text-foreground">
      <div className="px-4 pb-4 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="mt-1 text-2xl font-black leading-none tracking-[-0.04em]">{title}</h2>
          </div>
          <div className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-muted-foreground">
            {progress.total} stops
          </div>
        </div>

        {trip ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <TripModeToggle mode={trip.routeMode} onChange={(mode) => onRouteModeChange(trip._id, mode)} />
            <div className="text-right text-xs font-medium text-muted-foreground">
              {trip.status === "active"
                ? `${progress.finished}/${progress.total} complete`
                : trip.status === "completed"
                  ? "Trip complete"
                  : "Planning"}
            </div>
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="rounded-lg border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
            Loading your adventure...
          </div>
        ) : !trip ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-secondary/40 p-5 text-center">
            <div className="grid size-10 place-items-center rounded-full bg-card shadow-sm">
              <MapPin className="size-5 text-accent" />
            </div>
            <h3 className="mt-3 text-base font-semibold">Start with a spot</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Pick places from the map and shape them into a route for the day.
            </p>
            {selectedSpot ? (
              <button
                type="button"
                onClick={() => onAddSpot(selectedSpot)}
                className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
              >
                <Plus className="size-4" />
                Add {selectedSpot.name}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {selectedSpot && trip.status === "planning" ? (
              <div className="rounded-lg border border-border bg-secondary/40 p-3">
                <div className="text-xs font-medium text-muted-foreground">Selected spot</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{selectedSpot.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {[selectedSpot.destinationCity, selectedSpot.tag].filter(Boolean).join(" - ")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddSpot(selectedSpot)}
                    disabled={selectedSpotInTrip}
                    className={[
                      "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                      selectedSpotInTrip
                        ? "bg-card text-muted-foreground"
                        : "bg-foreground text-background hover:bg-foreground/90",
                    ].join(" ")}
                  >
                    {selectedSpotInTrip ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                    {selectedSpotInTrip ? "In trip" : "Add"}
                  </button>
                </div>
              </div>
            ) : null}

            {trip.status === "active" && currentSpot && currentStop ? (
              <div className="rounded-[1.25rem] bg-accent/10 p-4 ring-1 ring-accent/25">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
                  <Navigation className="size-3.5" />
                  Next up
                </div>
                <h3 className="mt-2 text-xl font-semibold leading-tight">{currentSpot.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{currentSpot.tip}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onRouteStop(currentSpot)}
                    className={[
                      "inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors",
                      routedSpotId === currentSpot.id
                        ? "bg-foreground text-background hover:bg-foreground/90"
                        : "bg-foreground text-background hover:bg-foreground/90",
                    ].join(" ")}
                  >
                    <Navigation className="size-3.5" />
                    {routedSpotId === currentSpot.id ? "Tracking" : "Route"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onMarkDone(currentStop._id)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary"
                  >
                    <Check className="size-3.5" />
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={() => onSkipStop(currentStop._id)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-card px-3.5 py-2 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-secondary"
                  >
                    <X className="size-3.5" />
                    Skip
                  </button>
                </div>
              </div>
            ) : null}

            {stops.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                Add spots to build your route.
              </div>
            ) : (
              <ol className="flex flex-col gap-3">
                {stops.map((stop, index) => {
                  const spot = findSpot(allSpots, stop.spotId);

                  if (!spot) {
                    return null;
                  }

                  const isCurrent = stop.status === "current";
                  const isRouted = routedSpotId === spot.id;

                  return (
                    <li
                      key={stop._id}
                      className={[
                        "rounded-[1.15rem] bg-card p-3 shadow-sm ring-1",
                        isCurrent ? "ring-accent/30" : "ring-border",
                        stop.status === "done" || stop.status === "skipped" ? "opacity-70" : "",
                      ].join(" ")}
                    >
                      <div className="flex gap-3">
                        <img
                          src={spot.image}
                          alt={spot.name}
                          className="size-14 shrink-0 rounded-xl object-cover"
                          loading="lazy"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold leading-tight">{spot.name}</div>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                                <span>{index + 1}</span>
                                <span className="size-1 rounded-full bg-muted-foreground/50" />
                                {spot.destinationCity ? (
                                  <>
                                    <span>{spot.destinationCity}</span>
                                    <span className="size-1 rounded-full bg-muted-foreground/50" />
                                  </>
                                ) : null}
                                <span>{statusLabel[stop.status]}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onRouteStop(spot)}
                              className={[
                                "grid size-9 shrink-0 place-items-center rounded-full bg-card shadow-sm ring-1 transition-colors",
                                isRouted
                                  ? "ring-foreground bg-foreground text-background"
                                  : "ring-border text-muted-foreground hover:bg-secondary hover:text-foreground",
                              ].join(" ")}
                              aria-label={isRouted ? `Tracking ${spot.name}` : `Route to ${spot.name}`}
                            >
                              <Navigation className="size-4" />
                            </button>
                          </div>

                          {trip.status === "planning" ? (
                            <div className="mt-3 flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onMoveStop(stop._id, "up")}
                                disabled={index === 0}
                                className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40"
                                aria-label={`Move ${spot.name} up`}
                              >
                                <ArrowUp className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onMoveStop(stop._id, "down")}
                                disabled={index === stops.length - 1}
                                className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-secondary disabled:opacity-40"
                                aria-label={`Move ${spot.name} down`}
                              >
                                <ArrowDown className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onRemoveStop(stop._id)}
                                className="ml-auto grid size-8 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                                aria-label={`Remove ${spot.name}`}
                              >
                                <Trash2 className="size-4" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}
      </div>

      {trip && trip.status === "planning" ? (
        <div className="border-t border-border p-4">
          <button
            type="button"
            onClick={() => onStartTrip(trip._id)}
            disabled={stops.length === 0}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ListChecks className="size-4" />
            Start trip
          </button>
        </div>
      ) : trip?.status === "completed" ? (
        <div className="border-t border-border p-4 text-center text-sm font-medium text-highlight">
          Stop complete. Adventure wrapped.
        </div>
      ) : null}
    </aside>
  );
};

export default TripPanel;
