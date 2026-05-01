import { useState } from "react";
import { Check, ChevronDown, MapPin } from "lucide-react";
import { destinations, type Destination } from "@/data/destinations";

type Props = {
  value: Destination;
  onChange: (d: Destination) => void;
};

const DestinationPicker = ({ value, onChange }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-full max-w-full items-center justify-center gap-1.5 rounded-full border border-border bg-card py-1 pl-3 pr-2 text-xs font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground sm:h-auto sm:w-auto sm:justify-start sm:pl-2 sm:pr-2.5"
        aria-expanded={open}
      >
        <MapPin className="size-3.5 shrink-0" />
        <span className="hidden sm:inline" aria-hidden>{value.flag}</span>
        <span className="min-w-0 truncate text-foreground">{value.city}</span>
        <span className="hidden sm:inline">- {value.country}</span>
        <ChevronDown className={`size-3.5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-card shadow-lg">
            <div className="border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Choose a destination
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              {destinations.map((d) => {
                const active = d.id === value.id;
                return (
                  <li key={d.id}>
                    <button
                      onClick={() => {
                        onChange(d);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-secondary ${active ? "bg-secondary/60" : ""}`}
                    >
                      <span className="text-base" aria-hidden>{d.flag}</span>
                      <div className="flex-1 text-left">
                        <div className="font-medium leading-tight">{d.city}</div>
                        <div className="text-xs text-muted-foreground">{d.country}</div>
                      </div>
                      {active ? <Check className="size-4 text-accent" /> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default DestinationPicker;
