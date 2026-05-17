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
import { SpotImage } from "@/components/SpotImage";
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
  onClose?: () => void;
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
    <div className="inline-flex rounded-full bg-secondary p-1 text-sm font-medium">
      <button
        type="button"
        onClick={() => onChange("walk")}
        className={[
          "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 py-2 transition-colors",
          mode === "walk" ? "bg-card text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
      >
        <Footprints className="size-3.5" />
        Walk
      </button>
      <button
        type="button"
        onClick={() => onChange("drive")}
        className={[
          "inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 py-2 transition-colors",
          mode === "drive" ? "bg-card text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
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
  onClose,
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
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="mt-1 text-3xl font-bold leading-9">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-foreground">
              {progress.total} stops
            </div>
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="grid size-10 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Close trip panel"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        {trip ? (
          <div className="mt-5 flex items-center justify-between gap-3">
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

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {isLoading ? (
          <div className="rounded-2xl bg-secondary p-5 text-sm text-muted-foreground">
            Loading your adventure...
          </div>
        ) : !trip ? (
          <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl bg-secondary p-6 text-center">
            <div className="grid size-12 place-items-center rounded-full bg-card">
              <MapPin className="size-5 text-foreground" />
            </div>
            <h3 className="mt-4 text-xl font-bold leading-7">Start with a spot</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Pick places from the map and shape them into a route for the day.
            </p>
            {selectedSpot ? (
              <button
                type="button"
                onClick={() => onAddSpot(selectedSpot)}
                className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/80"
              >
                <Plus className="size-4" />
                Add {selectedSpot.name}
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {selectedSpot && trip.status === "planning" ? (
              <div className="rounded-2xl bg-secondary p-4">
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
                      "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors",
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
              <div className="rounded-2xl bg-foreground p-5 text-background">
                <div className="flex items-center gap-1.5 text-sm font-medium text-background/70">
                  <Navigation className="size-3.5" />
                  Next up
                </div>
                <h3 className="mt-2 text-2xl font-bold leading-8">{currentSpot.name}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-background/75">{currentSpot.tip}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onRouteStop(currentSpot)}
                    className={[
                      "inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
                      routedSpotId === currentSpot.id
                        ? "bg-card text-foreground hover:bg-card/90"
                        : "bg-card text-foreground hover:bg-card/90",
                    ].join(" ")}
                  >
                    <Navigation className="size-3.5" />
                    {routedSpotId === currentSpot.id ? "Tracking" : "Route"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onMarkDone(currentStop._id)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/15 px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-white/25"
                  >
                    <Check className="size-3.5" />
                    Done
                  </button>
                  <button
                    type="button"
                    onClick={() => onSkipStop(currentStop._id)}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white/15 px-4 py-2.5 text-sm font-medium text-background transition-colors hover:bg-white/25"
                  >
                    <X className="size-3.5" />
                    Skip
                  </button>
                </div>
              </div>
            ) : null}

            {stops.length === 0 ? (
              <div className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">
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
                        "rounded-2xl bg-card p-3 ring-1",
                        "wandr-trip-stop-row",
                        isCurrent ? "ring-foreground" : "ring-border",
                        stop.status === "done" || stop.status === "skipped" ? "opacity-70" : "",
                      ].join(" ")}
                    >
                      <div className="flex gap-3">
                        <div className="relative size-14 shrink-0 overflow-hidden rounded-xl">
                          <SpotImage
                            src={spot.image}
                            alt={spot.name}
                            className="object-cover"
                            sizes="3.5rem"
                            fill
                          />
                        </div>
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
                                "grid size-10 shrink-0 place-items-center rounded-full bg-card ring-1 transition-colors",
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
                                className="grid size-9 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                                aria-label={`Move ${spot.name} up`}
                              >
                                <ArrowUp className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onMoveStop(stop._id, "down")}
                                disabled={index === stops.length - 1}
                                className="grid size-9 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
                                aria-label={`Move ${spot.name} down`}
                              >
                                <ArrowDown className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onRemoveStop(stop._id)}
                                className="ml-auto grid size-9 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
        <div className="border-t border-border p-5">
          <button
            type="button"
            onClick={() => onStartTrip(trip._id)}
            disabled={stops.length === 0}
            className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-full bg-foreground px-5 py-3 text-base font-medium text-background transition-colors hover:bg-foreground/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ListChecks className="size-4" />
            Start trip
          </button>
        </div>
      ) : trip?.status === "completed" ? (
        <div className="border-t border-border p-5 text-center text-sm font-medium text-foreground">
          Stop complete. Adventure wrapped.
        </div>
      ) : null}
    </aside>
  );
};

export default TripPanel;
