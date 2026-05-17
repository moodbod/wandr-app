import { Car, Footprints, Navigation, X } from "lucide-react";
import type { RouteSummary } from "@/components/MapboxStreetsMap";
import type { Spot } from "@/data/destinations";

type Props = {
  spot: Spot;
  mode: "walk" | "drive";
  summary: RouteSummary | null;
  isActive: boolean;
  isOnline: boolean;
  onModeChange: (m: "walk" | "drive") => void;
  onClose: () => void;
  onStart: () => void;
};

function formatMinutes(seconds: number) {
  return Math.max(1, Math.round(seconds / 60));
}

function formatDistance(meters: number) {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }

  return `${Math.max(1, Math.round(meters / 10) * 10)} m`;
}

const RoutePanel = ({ spot, mode, summary, isActive, isOnline, onModeChange, onClose, onStart }: Props) => {
  const unavailableReason = summary?.unavailableReason;
  const eta = summary && !unavailableReason ? formatMinutes(summary.durationSeconds) : null;
  const distance = summary && !unavailableReason ? formatDistance(summary.distanceMeters) : "Calculating route";
  const statusText =
    unavailableReason === "offline-missing-route"
      ? "Route not downloaded"
      : unavailableReason === "request-failed"
        ? "Route unavailable"
        : distance;

  return (
    <div className="overflow-hidden rounded-2xl bg-card">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="min-w-0">
          <div className="text-xs font-medium text-muted-foreground">Route</div>
          <h3 className="mt-1 truncate text-xl font-bold leading-7">to {spot.name}</h3>
        </div>
        <button
          onClick={onClose}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close route"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 px-4 pb-5">
        <div className="flex rounded-full bg-secondary p-1 text-sm font-medium">
          <button
            onClick={() => onModeChange("walk")}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 py-2 transition-colors ${mode === "walk" ? "bg-card text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Footprints className="size-3.5" /> Walk
          </button>
          <button
            onClick={() => onModeChange("drive")}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 py-2 transition-colors ${mode === "drive" ? "bg-card text-foreground ring-1 ring-border" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Car className="size-3.5" /> Drive
          </button>
        </div>

        <div className="ml-auto text-right">
          <div className="text-xl font-bold tabular-nums leading-none">{eta ? `${eta} min` : "--"}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {!isOnline && <span className="mr-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">Offline</span>}
            {statusText}
            {summary && !unavailableReason ? ` - fastest ${mode}${summary.source === "cache" ? " - saved" : ""}` : ""}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 pb-4 pt-0">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-foreground" />
          You
          <div className="hidden h-px flex-1 border-t border-dashed border-border min-[360px]:block" />
          <span className="size-2 rounded-full bg-foreground" />
          <span className="truncate">{spot.name}</span>
        </div>
        <button
          onClick={onStart}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-foreground/80"
        >
          <Navigation className="size-3.5" /> {isActive ? "Tracking" : "Start"}
        </button>
      </div>
    </div>
  );
};

export default RoutePanel;
