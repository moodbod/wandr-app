export type Spot = {
  _id?: string;
  id: string;
  slug?: string;
  name: string;
  category: string;
  typeId?: string;
  typeLabel?: string;
  typePluralLabel?: string;
  typeIcon?: string;
  isBookable?: boolean;
  city?: string;
  country?: string;
  destinationCity?: string;
  destinationCountry?: string;
  // Legacy percentage coordinates kept for compatibility with non-Mapbox fallbacks.
  top: string;
  left: string;
  lngLat: [number, number];
  walkMin: number;
  driveMin: number;
  tip: string;
  summary?: string;
  detail?: string;
  tag: string;
  tags?: string[];
  image: string;
  gallery?: string[];
  customFields?: Record<string, string | number | boolean | null>;
  typeFields?: Array<{
    key: string;
    label: string;
    kind: "text" | "textarea" | "select" | "number" | "url";
    required: boolean;
    showOnCard: boolean;
    showOnDetail: boolean;
    options?: string[];
  }>;
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

export type PoiType = {
  _id: string;
  slug: string;
  label: string;
  pluralLabel: string;
  icon: string;
  isBookable: boolean;
  status: "active" | "archived";
};

export type FeaturedTravelPlan = {
  _id: string;
  slug: string;
  title: string;
  summary: string;
  image: string;
  countries: string[];
  durationLabel: string;
  status: "draft" | "active" | "archived";
  stops: Array<{ poiId: string; position: number; note?: string }>;
};

export type WandrCatalog = {
  types: PoiType[];
  picks: Spot[];
  destinations: Destination[];
  featuredPlans: FeaturedTravelPlan[];
};

export const destinations: Destination[] = [];
