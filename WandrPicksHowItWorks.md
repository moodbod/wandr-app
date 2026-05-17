# Wandr Picks: How It Works

## What It Is

Wandr Picks are the places users discover, save, route to, and build trips from.

The code uses `POI` / `pointsOfInterest` internally. The product UI calls them **Wandr Picks**.

## Admin Flow

1. Open `/admin`.
2. Create Pick Types, such as Restaurant, Stay, Landmark, Food, or Route.
3. Add fields for each type, like cuisine, amenities, best time, rules, or access notes.
4. Create Wandr Picks with location, image, summary, details, travel times, and type-specific fields.
5. Build Featured Plans by choosing ordered Picks across any city or country.
6. Manage stay requests from the Requests tab.

Admins control what appears on cards, detail pages, filters, featured plans, and stay request flows.

## User Flow

1. Users land on the map.
2. They filter by Pick type.
3. They open a Pick card for quick actions.
4. They can open the full Pick details page at `/picks/[slug]`.
5. They add Picks to a trip, route to them, or start a Featured Plan.
6. Starting a Featured Plan copies its stops into the user trip.
7. Users can reorder, add, remove, start, skip, and complete stops.
8. Stay Picks can accept simple booking requests.

Read-only discovery stays public. Trip and booking actions require sign-in.

## Offline Behavior

The app stores:

- the public Wandr Picks catalog;
- recently viewed Pick details;
- active trip state;
- queued trip actions.

When offline, users can keep viewing cached Picks and continue an active trip. Actions sync when the device comes back online.

Live map tiles and fresh directions may still need network access, so the trip panel remains the fallback guide.

## Main Backend Pieces

- `poiTypes`: admin-defined Pick templates.
- `pointsOfInterest`: Wandr Picks.
- `featuredTravelPlans`: reusable admin-created adventures.
- `featuredTravelPlanStops`: ordered Picks inside plans.
- `stayBookingRequests`: simple stay requests handled by admins.

## Main Screens

- `/`: map-first discovery and trip building.
- `/picks/[slug]`: public Pick details.
- `/admin`: admin suite.
