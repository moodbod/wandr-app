import { useState } from "react";
import { ChevronDown, MapPin, Check } from "lucide-react";
import { destinations, type Destination } from "@/data/destinations";

type Props = {
  value: Destination;
  onChange: (d: Destination) => void;
};

const DestinationPicker = ({ value, onChange }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors bg-card border border-border rounded-full pl-2 pr-2.5 py-1 shadow-sm"
        aria-expanded={open}
      >
        <MapPin className="size-3.5" />
        <span aria-hidden>{value.flag}</span>
        <span className="text-foreground">{value.city}</span>
        <span>· {value.country}</span>
        <ChevronDown className={`size-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-2xl shadow-lg overflow-hidden z-50">
            <div className="px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground border-b border-border">
              Choose a destination
            </div>
            <ul className="py-1 max-h-72 overflow-y-auto">
              {destinations.map((d) => {
                const active = d.id === value.id;
                return (
                  <li key={d.id}>
                    <button
                      onClick={() => { onChange(d); setOpen(false); }}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-secondary transition-colors ${active ? "bg-secondary/60" : ""}`}
                    >
                      <span className="text-base" aria-hidden>{d.flag}</span>
                      <div className="flex-1 text-left">
                        <div className="font-medium leading-tight">{d.city}</div>
                        <div className="text-xs text-muted-foreground">{d.country}</div>
                      </div>
                      {active && <Check className="size-4 text-accent" />}
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
