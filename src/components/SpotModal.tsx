import { X, Footprints, Car, Navigation, MapPin, Sparkles, Plus, Check } from "lucide-react";
import type { Spot } from "@/data/destinations";

type Props = {
  spot: Spot | null;
  isNextStop: boolean;
  onClose: () => void;
  onSetNextStop: (spot: Spot) => void;
  onRoute: (spot: Spot) => void;
  onAddToTrip: (spot: Spot) => void;
  isInTrip: boolean;
};

const categoryLabel: Record<Spot["category"], string> = {
  eat: "Eat",
  see: "See",
  gems: "Hidden gem",
  routes: "Route",
};

const SpotModal = ({ spot, isNextStop, onClose, onSetNextStop, onRoute, onAddToTrip, isInTrip }: Props) => {
  if (!spot) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="spot-title"
    >
      <button
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close"
      />

      <div className="relative w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl border border-border shadow-xl overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-300">
        {/* Image */}
        <div className="relative aspect-[5/3] w-full">
          <img src={spot.image} alt={spot.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 via-transparent to-transparent" />

          <button
            onClick={onClose}
            className="absolute top-3 right-3 size-9 grid place-items-center rounded-full bg-background/90 backdrop-blur-sm hover:bg-background transition-colors"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>

          <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-background/90 backdrop-blur-sm rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider">
            <Sparkles className="size-3 text-accent" />
            {spot.tag}
          </div>

          <div className="absolute bottom-3 left-4 right-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-background/80">
              {categoryLabel[spot.category]}
            </div>
            <h2 id="spot-title" className="text-2xl font-semibold text-background leading-tight mt-0.5">
              {spot.name}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4">
          {/* ETA row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2.5 bg-secondary rounded-2xl px-3 py-2.5">
              <div className="size-8 grid place-items-center rounded-full bg-card">
                <Footprints className="size-4" />
              </div>
              <div>
                <div className="text-sm font-semibold tabular-nums leading-none">{spot.walkMin} min</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Walk</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 bg-secondary rounded-2xl px-3 py-2.5">
              <div className="size-8 grid place-items-center rounded-full bg-card">
                <Car className="size-4" />
              </div>
              <div>
                <div className="text-sm font-semibold tabular-nums leading-none">{spot.driveMin} min</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Drive</div>
              </div>
            </div>
          </div>

          {/* Tip */}
          <div className="rounded-2xl bg-accent/10 border border-accent/20 p-4">
            <div className="text-[11px] font-medium uppercase tracking-wider text-accent mb-1">
              A local would tell you
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{spot.tip}</p>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onAddToTrip(spot)}
              disabled={isInTrip}
              className={[
                "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
                isInTrip
                  ? "bg-secondary text-muted-foreground cursor-default"
                  : "bg-foreground text-background hover:bg-foreground/90",
              ].join(" ")}
            >
              {isInTrip ? <Check className="size-4" /> : <Plus className="size-4" />}
              {isInTrip ? "In trip" : "Add to trip"}
            </button>
            <button
              onClick={() => onSetNextStop(spot)}
              disabled={isNextStop}
              className={[
                "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
                isNextStop
                  ? "bg-secondary text-muted-foreground cursor-default"
                  : "border border-border hover:bg-secondary",
              ].join(" ")}
            >
              <MapPin className="size-4" />
              {isNextStop ? "Next stop" : "Set next"}
            </button>
            <button
              onClick={() => onRoute(spot)}
              className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium border border-border hover:bg-secondary transition-colors"
            >
              <Navigation className="size-4" /> Route
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpotModal;
