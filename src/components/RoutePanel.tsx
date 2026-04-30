import { Footprints, Car, X, Navigation } from "lucide-react";
import type { Spot } from "@/data/destinations";

type Props = {
  spot: Spot;
  mode: "walk" | "drive";
  onModeChange: (m: "walk" | "drive") => void;
  onClose: () => void;
  onStart: () => void;
};

// Rough estimates. Walking ~5 km/h, driving ~25 km/h in city.
const distanceKm = (spot: Spot) => +(spot.walkMin / 12).toFixed(1);

const RoutePanel = ({ spot, mode, onModeChange, onClose, onStart }: Props) => {
  const eta = mode === "walk" ? spot.walkMin : spot.driveMin;
  const km = distanceKm(spot);

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
          <div className="text-base font-semibold tabular-nums leading-none">{eta} min</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{km} km · {mode === "walk" ? "easy walk" : "short drive"}</div>
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
          <Navigation className="size-3.5" /> Start
        </button>
      </div>
    </div>
  );
};

export default RoutePanel;
