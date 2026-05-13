export type Spot = {
  id: string;
  name: string;
  category: "eat" | "see" | "gems" | "routes";
  // Legacy percentage coordinates kept for compatibility with non-Mapbox fallbacks.
  top: string;
  left: string;
  lngLat: [number, number];
  walkMin: number;
  driveMin: number;
  tip: string;
  tag: string;
  image: string;
};

export type Destination = {
  id: string;
  city: string;
  country: string;
  flag: string;
  featuredSpotId?: string;
  map: { center: [number, number]; zoom: number };
  you: { top: string; left: string; lngLat: [number, number] };
  spots: Spot[];
};

export const destinations: Destination[] = [];
