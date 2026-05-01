import { Car, Footprints, Navigation, X } from "lucide-react";
import type { Spot } from "@/data/destinations";
import type { RouteSummary } from "@/components/MapboxStreetsMap";

type Props = {
  spot: Spot;
  mode: "walk" | "drive";
  summary: RouteSummary | null;
  isActive: boolean;
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

const RoutePanel = ({ spot, mode, summary, isActive, onModeChange, onClose, onStart }: Props) => {
  const eta = summary ? formatMinutes(summary.durationSeconds) : null;
  const distance = summary ? formatDistance(summary.distanceMeters) : "Calculating route";

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-accent">Route</div>
          <h3 className="text-base font-semibold leading-tight mt-0.5">to {spot.name}</h3>
        </div>
        <button onClick={onClose} className="size-7 grid place-items-center rounded-full hover:bg-secondary text-muted-foreground" aria-label="Close route">
          <X className="size-4" />
        </button>
      </div>

      <div className="px-4 pb-3 flex items-center gap-2">
        <div className="bg-secondary rounded-full p-0.5 flex text-xs font-medium">
          <button
            onClick={() => onModeChange("walk")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${mode === "walk" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            <Footprints className="size-3.5" /> Walk
          </button>
          <button
            onClick={() => onModeChange("drive")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${mode === "drive" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            <Car className="size-3.5" /> Drive
          </button>
        </div>

        <div className="ml-auto text-right">
          <div className="text-base font-semibold tabular-nums leading-none">{eta ? `${eta} min` : "--"}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {distance}
            {summary ? ` · ${mode === "walk" ? "fastest walk" : "fastest drive"}` : ""}
          </div>
        </div>
      </div>

      <div className="border-t border-border px-4 py-3 flex items-center gap-3">
        <div className="flex-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2 rounded-full bg-accent" />
          You
          <div className="flex-1 h-px border-t border-dashed border-border" />
          <span className="size-2 rounded-full bg-foreground" />
          {spot.name}
        </div>
        <button
          onClick={onStart}
          className="inline-flex items-center gap-1.5 bg-foreground text-background rounded-full px-3 py-1.5 text-xs font-medium hover:bg-foreground/90 transition-colors"
        >
          <Navigation className="size-3.5" /> {isActive ? "Tracking" : "Start"}
        </button>
      </div>
    </div>
  );
};

export default RoutePanel;
