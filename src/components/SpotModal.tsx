import { X, Footprints, Car, Navigation, MapPin, Plus, Check } from "lucide-react";
import { SpotImage } from "@/components/SpotImage";
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
      className="wandr-spot-modal fixed inset-0 z-50 flex items-end justify-center p-0 animate-in fade-in duration-200 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="spot-title"
    >
      <button
        className="absolute inset-0 bg-foreground/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close"
      />

      <div className="wandr-spot-panel relative flex w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-border bg-card animate-in slide-in-from-bottom-6 duration-300 sm:rounded-2xl sm:zoom-in-95">
        <div className="absolute left-1/2 top-2 z-10 h-1.5 w-12 -translate-x-1/2 rounded-full bg-background/75 sm:hidden" />
        {/* Image */}
        <div className="relative aspect-[5/3] w-full shrink-0">
          <SpotImage src={spot.image} alt={spot.name} className="object-cover" sizes="(min-width: 640px) 28rem, 100vw" fill />
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/45 via-transparent to-transparent" />

          <button
            onClick={onClose}
            className="absolute right-3 top-3 grid size-10 place-items-center rounded-full bg-background transition-colors hover:bg-secondary"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>

          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-xs font-medium">
            {spot.tag}
          </div>

          <div className="absolute bottom-3 left-4 right-4">
            <div className="text-sm font-medium text-background/80">
              {categoryLabel[spot.category]}
            </div>
            <h2 id="spot-title" className="mt-0.5 text-3xl font-bold leading-9 text-background">
              {spot.name}
            </h2>
          </div>
        </div>

        {/* Body */}
        <div className="wandr-spot-body flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-5">
          {/* ETA row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2.5 rounded-2xl bg-secondary px-4 py-3">
              <div className="size-8 grid place-items-center rounded-full bg-card">
                <Footprints className="size-4" />
              </div>
              <div>
                <div className="text-sm font-semibold tabular-nums leading-none">{spot.walkMin} min</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Walk</div>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-2xl bg-secondary px-4 py-3">
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
          <div className="rounded-2xl bg-secondary p-4">
            <div className="mb-1 text-sm font-medium text-muted-foreground">
              A local would tell you
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{spot.tip}</p>
          </div>

        </div>

        {/* Actions */}
        <div className="wandr-spot-actions grid shrink-0 grid-cols-2 gap-2 border-t border-border bg-card/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-md sm:border-0 sm:bg-transparent sm:p-5 sm:pt-0 sm:backdrop-blur-0">
          <button
            onClick={() => onAddToTrip(spot)}
            disabled={isInTrip}
            className={[
              "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
              isInTrip
                ? "bg-secondary text-muted-foreground cursor-default"
                : "bg-foreground text-background hover:bg-foreground/80",
            ].join(" ")}
          >
            {isInTrip ? <Check className="size-4" /> : <Plus className="size-4" />}
            {isInTrip ? "In trip" : "Add to trip"}
          </button>
          <button
            onClick={() => onSetNextStop(spot)}
            disabled={isNextStop}
            className={[
              "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
              isNextStop
                ? "bg-secondary text-muted-foreground cursor-default"
                : "bg-secondary hover:bg-muted",
            ].join(" ")}
          >
            <MapPin className="size-4" />
            {isNextStop ? "Next stop" : "Set next"}
          </button>
          <button
            onClick={() => onRoute(spot)}
            className="col-span-2 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-secondary px-4 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Navigation className="size-4" /> Route
          </button>
        </div>
      </div>
    </div>
  );
};

export default SpotModal;
