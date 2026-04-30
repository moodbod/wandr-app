import spotImg from "@/assets/wandr-spot.jpg";

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
  map: { center: [number, number]; zoom: number };
  you: { top: string; left: string; lngLat: [number, number] };
  spots: Spot[];
};

const namibiaFlag = "\uD83C\uDDF3\uD83C\uDDE6";

export const destinations: Destination[] = [
  {
    id: "windhoek",
    city: "Windhoek",
    country: "Namibia",
    flag: namibiaFlag,
    map: { center: [17.0832, -22.5597], zoom: 12.6 },
    you: { top: "52%", left: "48%", lngLat: [17.0832, -22.5597] },
    spots: [
      { id: "joes-beerhouse", name: "Joe's Beerhouse", category: "eat", top: "38%", left: "62%", lngLat: [17.0922, -22.5474], walkMin: 8, driveMin: 4, tip: "Start with a relaxed dinner in Eros and try a Namibian grill plate if you are easing into the trip.", tag: "Local classic", image: spotImg.src },
      { id: "christuskirche", name: "Christuskirche", category: "see", top: "44%", left: "50%", lngLat: [17.0877, -22.5675], walkMin: 12, driveMin: 5, tip: "Pair it with a quick loop around Parliament Gardens for an easy first look at central Windhoek.", tag: "Landmark", image: spotImg.src },
      { id: "namibia-craft-centre", name: "Namibia Craft Centre", category: "gems", top: "58%", left: "43%", lngLat: [17.0833, -22.5684], walkMin: 10, driveMin: 4, tip: "Good for locally made gifts, coffee, and getting a feel for makers from different parts of Namibia.", tag: "Made local", image: spotImg.src },
      { id: "avis-dam", name: "Avis Dam Nature Reserve", category: "routes", top: "48%", left: "73%", lngLat: [17.1513, -22.5827], walkMin: 38, driveMin: 12, tip: "Go early for a short nature walk on Windhoek's eastern edge; carry water and keep an eye on the sun.", tag: "Morning route", image: spotImg.src },
    ],
  },
  {
    id: "swakopmund",
    city: "Swakopmund",
    country: "Namibia",
    flag: namibiaFlag,
    map: { center: [14.5266, -22.6784], zoom: 13.2 },
    you: { top: "52%", left: "48%", lngLat: [14.5266, -22.6784] },
    spots: [
      { id: "jetty-1905", name: "The Tug / Jetty 1905", category: "eat", top: "61%", left: "49%", lngLat: [14.5247, -22.6821], walkMin: 7, driveMin: 3, tip: "Book ahead for a sunset seafood meal on the jetty when the Atlantic light turns soft.", tag: "Seafood", image: spotImg.src },
      { id: "swakopmund-museum", name: "Swakopmund Museum", category: "see", top: "38%", left: "52%", lngLat: [14.5269, -22.6751], walkMin: 6, driveMin: 3, tip: "A useful stop before heading inland, especially for geology, coastal history, and desert context.", tag: "Town history", image: spotImg.src },
      { id: "woermannhaus", name: "Woermannhaus", category: "gems", top: "47%", left: "55%", lngLat: [14.5267, -22.6783], walkMin: 4, driveMin: 2, tip: "Climb the old tower if it is open for a compact view over town and the sea.", tag: "Old town", image: spotImg.src },
      { id: "moon-landscape", name: "Moon Landscape", category: "routes", top: "35%", left: "78%", lngLat: [14.821, -22.681], walkMin: 180, driveMin: 35, tip: "Use it as a half-day desert drive from Swakopmund; the road and viewpoints are the point.", tag: "Desert drive", image: spotImg.src },
    ],
  },
  {
    id: "walvis-bay",
    city: "Walvis Bay",
    country: "Namibia",
    flag: namibiaFlag,
    map: { center: [14.5077, -22.9576], zoom: 11.4 },
    you: { top: "50%", left: "50%", lngLat: [14.5077, -22.9576] },
    spots: [
      { id: "walvis-waterfront", name: "Walvis Bay Waterfront", category: "eat", top: "48%", left: "51%", lngLat: [14.5076, -22.9574], walkMin: 5, driveMin: 2, tip: "Easy harbour-side lunch before a lagoon cruise or a drive down toward the dunes.", tag: "Harbour lunch", image: spotImg.src },
      { id: "walvis-lagoon", name: "Walvis Bay Lagoon", category: "see", top: "55%", left: "48%", lngLat: [14.4886, -22.9766], walkMin: 18, driveMin: 6, tip: "Check for flamingos along the lagoon edge, especially when the wind is calm.", tag: "Birdlife", image: spotImg.src },
      { id: "dune-7", name: "Dune 7", category: "gems", top: "63%", left: "68%", lngLat: [14.646, -23.285], walkMin: 90, driveMin: 18, tip: "Go near golden hour and expect a steep climb; shoes beat sandals here.", tag: "Big dune", image: spotImg.src },
      { id: "pelican-point", name: "Pelican Point", category: "routes", top: "28%", left: "35%", lngLat: [14.442, -22.884], walkMin: 140, driveMin: 45, tip: "Best as a guided 4x4 or kayak outing; the peninsula changes mood quickly with the tide and fog.", tag: "Coastal route", image: spotImg.src },
    ],
  },
  {
    id: "luderitz",
    city: "Luderitz",
    country: "Namibia",
    flag: namibiaFlag,
    map: { center: [15.1594, -26.6481], zoom: 12.2 },
    you: { top: "52%", left: "50%", lngLat: [15.1594, -26.6481] },
    spots: [
      { id: "ritzis-seafood", name: "Ritzi's Seafood", category: "eat", top: "48%", left: "49%", lngLat: [15.1579, -26.6473], walkMin: 5, driveMin: 2, tip: "A straightforward seafood stop in town before exploring the peninsula roads.", tag: "Seafood", image: spotImg.src },
      { id: "kolmanskop", name: "Kolmanskop Ghost Town", category: "see", top: "62%", left: "72%", lngLat: [15.2327, -26.7047], walkMin: 110, driveMin: 12, tip: "Morning light is best for the sand-filled rooms; permits and tour times matter.", tag: "Iconic", image: spotImg.src },
      { id: "felsenkirche", name: "Felsenkirche", category: "gems", top: "45%", left: "55%", lngLat: [15.1588, -26.6504], walkMin: 8, driveMin: 3, tip: "Step up the hill for one of the cleanest views over Luderitz and the bay.", tag: "Town view", image: spotImg.src },
      { id: "diaz-point", name: "Diaz Point", category: "routes", top: "38%", left: "31%", lngLat: [15.0966, -26.6353], walkMin: 70, driveMin: 22, tip: "Make it a windy peninsula loop with stops at bays, rocks, and the old cross.", tag: "Peninsula route", image: spotImg.src },
    ],
  },
  {
    id: "etosha",
    city: "Etosha",
    country: "Namibia",
    flag: namibiaFlag,
    map: { center: [15.9167, -19.1775], zoom: 10.1 },
    you: { top: "50%", left: "50%", lngLat: [15.9167, -19.1775] },
    spots: [
      { id: "okaukuejo-camp", name: "Okaukuejo Camp Restaurant", category: "eat", top: "51%", left: "50%", lngLat: [15.9162, -19.1773], walkMin: 5, driveMin: 2, tip: "Fuel up before a drive and come back after dark for the floodlit waterhole.", tag: "Camp base", image: spotImg.src },
      { id: "okaukuejo-waterhole", name: "Okaukuejo Waterhole", category: "see", top: "49%", left: "51%", lngLat: [15.917, -19.1779], walkMin: 3, driveMin: 1, tip: "Stay patient after sunset; the waterhole often rewards people who simply sit still.", tag: "Wildlife", image: spotImg.src },
      { id: "etosha-pan-lookout", name: "Etosha Pan Lookout", category: "gems", top: "40%", left: "69%", lngLat: [16.123, -19.160], walkMin: 160, driveMin: 35, tip: "A stark, bright stop that helps the scale of the pan finally click. Sunglasses are not optional.", tag: "Salt pan", image: spotImg.src },
      { id: "okondeka", name: "Okondeka Waterhole Drive", category: "routes", top: "30%", left: "45%", lngLat: [15.801, -19.046], walkMin: 240, driveMin: 55, tip: "Plan this as a slow game-drive loop from Okaukuejo, not a quick point-to-point dash.", tag: "Game drive", image: spotImg.src },
    ],
  },
];
