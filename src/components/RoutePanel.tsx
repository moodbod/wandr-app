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
  const eta = summary ? formatMinutes(summary.durationSeconds) : null;
  const distance = summary ? formatDistance(summary.distanceMeters) : "Calculating route";

  return (
    <div className="overflow-hidden rounded-[1.5rem] bg-card">
      <div className="flex items-center justify-between px-3 pb-2 pt-4">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Route</div>
          <h3 className="mt-1 truncate text-base font-semibold leading-tight">to {spot.name}</h3>
        </div>
        <button
          onClick={onClose}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          aria-label="Close route"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 px-3 pb-5">
        <div className="flex rounded-full bg-secondary p-1 text-xs font-medium">
          <button
            onClick={() => onModeChange("walk")}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors ${mode === "walk" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Footprints className="size-3.5" /> Walk
          </button>
          <button
            onClick={() => onModeChange("drive")}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors ${mode === "drive" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Car className="size-3.5" /> Drive
          </button>
        </div>

        <div className="ml-auto text-right">
          <div className="text-lg font-semibold tabular-nums leading-none">{eta ? `${eta} min` : "--"}</div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            {!isOnline && <span className="mr-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium">Offline</span>}
            {distance}
            {summary ? ` · fastest ${mode}` : ""}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 px-3 pb-3 pt-0">
        <div className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-accent" />
          You
          <div className="hidden h-px flex-1 border-t border-dashed border-border min-[360px]:block" />
          <span className="size-2 rounded-full bg-foreground" />
          <span className="truncate">{spot.name}</span>
        </div>
        <button
          onClick={onStart}
          className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background shadow-sm transition-colors hover:bg-foreground/90"
        >
          <Navigation className="size-3.5" /> {isActive ? "Tracking" : "Start"}
        </button>
      </div>
    </div>
  );
};

export default RoutePanel;
