import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExplorePage from "@/components/ExplorePage";

const mockDestinations = [
  {
    id: "windhoek",
    city: "Windhoek",
    country: "Test Country",
    flag: "🇳🇦",
    map: { center: [17.0832, -22.5597] as [number, number], zoom: 12.6 },
    you: { top: "52%", left: "48%", lngLat: [17.0832, -22.5597] as [number, number] },
    spots: [
      { id: "spot-1", name: "Test Spot 1", category: "eat", top: "38%", left: "62%", lngLat: [17.0922, -22.5474] as [number, number], walkMin: 8, driveMin: 4, tip: "Tip 1", tag: "Tag 1", image: "/test.jpg" },
      { id: "spot-2", name: "Test Spot 2", category: "see", top: "44%", left: "50%", lngLat: [17.0877, -22.5675] as [number, number], walkMin: 12, driveMin: 5, tip: "Tip 2", tag: "Tag 2", image: "/test.jpg" },
    ],
  },
  {
    id: "swakopmund",
    city: "Swakopmund",
    country: "Test Country",
    flag: "🇳🇦",
    map: { center: [14.5266, -22.6784] as [number, number], zoom: 13.2 },
    you: { top: "52%", left: "48%", lngLat: [14.5266, -22.6784] as [number, number] },
    spots: [
      { id: "spot-3", name: "Test Spot 3", category: "eat", top: "61%", left: "49%", lngLat: [14.5247, -22.6821] as [number, number], walkMin: 7, driveMin: 3, tip: "Tip 3", tag: "Tag 3", image: "/test.jpg" },
    ],
  },
];

const testState = vi.hoisted(() => ({
  tripData: null as
    | null
    | {
        trip: { _id: string; title: string; status: "planning" | "active" | "completed"; routeMode: "walk" | "drive"; destinationId?: string };
        stops: Array<{ _id: string; spotId: string; position: number; status: string }>;
      },
  resumeTripData: null as
    | null
    | {
        trip: { _id: string; title: string; status: "planning" | "active" | "completed"; routeMode: "walk" | "drive"; destinationId?: string };
        stops: Array<{ _id: string; spotId: string; position: number; status: string }>;
  },
  mapProps: [] as Array<{
    nextStop?: { id: string };
    highlightedSpotId?: string | null;
    routeOpen: boolean;
    spots: Array<{ id: string; destinationCity?: string }>;
    routeStops?: Array<{ id: string }>;
  }>,
  mutationMocks: [] as Array<ReturnType<typeof vi.fn>>,
  authenticated: true,
  authDialogOpen: false,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@convex-dev/auth/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: testState.authenticated, isLoading: false }),
}));

vi.mock("next/dynamic", () => ({
  default: () => (props: {
    nextStop?: { id: string };
    highlightedSpotId?: string | null;
    routeOpen: boolean;
    spots: Array<{ id: string; destinationCity?: string }>;
    routeStops?: Array<{ id: string }>;
  }) => {
    testState.mapProps.push(props);
    return <div data-testid="map" />;
  },
}));

vi.mock("next/image", () => ({
  default: ({ alt, fill, priority, ...props }: { alt: string; fill?: boolean; priority?: boolean; [key: string]: unknown }) => (
    <img alt={alt} {...props} />
  ),
}));

vi.mock("convex/react", () => ({
  useMutation: () => {
    const mutation = vi.fn((args?: { tripId?: string }) =>
      Promise.resolve({
        applied: true,
        reason: null,
        trip: {
          _id: args?.tripId ?? "trip-1",
          title: "Your adventure",
          status: "active",
          routeMode: "walk",
          destinationId: "windhoek",
        },
        stops: testState.tripData?.stops ?? testState.resumeTripData?.stops ?? [],
        tripId: args?.tripId ?? "trip-1",
      }),
    );
    testState.mutationMocks.push(mutation);
    return mutation;
  },
  useQuery: (_query: unknown, args: unknown) => {
    const functionName = getFunctionName(_query as never);

    if (args === "skip") {
      return undefined;
    }

    if (functionName === "users:current") {
      return { name: "Test User", email: "test@example.com", onboardingCompleted: true, role: "traveler" };
    }

    if (functionName === "trips:resumeActive") {
      return testState.resumeTripData ?? testState.tripData;
    }

    if (functionName === "trips:getActiveForExplore") {
      return testState.tripData;
    }

    if (functionName === "content:listPublic") {
      return mockDestinations;
    }

    if (args && typeof args === "object" && "destinationId" in args) {
      return testState.tripData;
    }

    return null;
  },
}));

vi.mock("@/components/MapboxStreetsMap", () => ({
  default: (props: {
    nextStop?: { id: string };
    highlightedSpotId?: string | null;
    routeOpen: boolean;
    spots: Array<{ id: string; destinationCity?: string }>;
    routeStops?: Array<{ id: string }>;
  }) => {
    testState.mapProps.push(props);
    return <div data-testid="map" />;
  },
}));

vi.mock("@/components/AuthStatus", () => ({
  AuthStatus: () => <div data-testid="auth-status" />,
}));

vi.mock("@/components/RoutePanel", () => ({
  default: () => <div data-testid="route-panel" />,
}));

vi.mock("@/components/TripPanel", () => ({
  default: (props: {
    spots: Array<{ id: string }>;
    tripData?: {
      trip: { routeMode: "walk" | "drive"; status: string };
      stops: Array<{ _id: string; status: string }>;
    } | null;
    onMarkDone: (tripStopId: string) => void;
    onSkipStop: (tripStopId: string) => void;
    onRouteStop: (spot: { id: string }) => void;
    onRouteModeChange: (tripId: string, mode: "walk" | "drive") => void;
  }) => {
    const currentStop = props.tripData?.stops.find((stop) => stop.status === "current");
    const swakopmundSpot = props.spots.find((spot) => spot.id === "spot-3");
    return (
      <div data-testid="trip-panel">
        {currentStop ? <button onClick={() => props.onMarkDone(currentStop._id)}>Done</button> : null}
        {swakopmundSpot ? <button onClick={() => props.onRouteStop(swakopmundSpot)}>Route Swakopmund</button> : null}
      </div>
    );
  },
}));

vi.mock("@/components/SpotModal", () => ({
  default: (props: { spot: { name: string } | null }) => (
    <div data-testid="spot-modal">{props.spot ? props.spot.name : null}</div>
  ),
}));

vi.mock("@/components/AuthDialog", () => ({
  AuthDialog: (props: { open: boolean }) => {
    testState.authDialogOpen = props.open;
    return props.open ? <div data-testid="auth-dialog" /> : null;
  },
}));

vi.mock("@/components/OnboardingDialog", () => ({
  OnboardingDialog: () => null,
}));

const firstSpot = mockDestinations[0].spots[0]!;
const secondSpot = mockDestinations[0].spots[1]!;
const swakopmundSpot = mockDestinations[1].spots[0]!;

describe("ExplorePage recommendation card", () => {
  beforeEach(() => {
    testState.tripData = null;
    testState.resumeTripData = null;
    testState.mapProps = [];
    testState.mutationMocks = [];
    testState.authenticated = true;
    testState.authDialogOpen = false;
    window.localStorage.clear();
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(true);
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDestinations),
        }),
      ),
    );
  });

  it("renders inactive recommendations as a showcase without highlighting the map marker", () => {
    render(<ExplorePage />);

    expect(screen.queryByTestId("destination-picker")).not.toBeInTheDocument();
    expect(screen.getByText("You might like this")).toBeInTheDocument();
    expect(screen.getByText(firstSpot.name)).toBeInTheDocument();
    expect(screen.getByText(firstSpot.tag)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /view spot/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^route$/i })).toBeInTheDocument();

    expect(testState.mapProps.at(-1)).toMatchObject({
      nextStop: { id: firstSpot.id },
      highlightedSpotId: null,
      routeOpen: false,
    });
    expect(testState.mapProps.at(-1)?.spots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: firstSpot.id, destinationCity: "Windhoek" }),
        expect.objectContaining({ id: swakopmundSpot.id, destinationCity: "Swakopmund" }),
      ]),
    );
  });

  it("highlights the recommended marker only after routing starts", async () => {
    render(<ExplorePage />);

    fireEvent.click(screen.getByRole("button", { name: /^route$/i }));

    await waitFor(() => {
      expect(testState.mapProps.at(-1)).toMatchObject({
        highlightedSpotId: firstSpot.id,
        routeOpen: true,
      });
    });
  });

  it("lets signed-out visitors open spot details without prompting for auth", async () => {
    testState.authenticated = false;

    render(<ExplorePage />);

    fireEvent.click(screen.getByText(firstSpot.name));

    await waitFor(() => {
      expect(screen.getByTestId("spot-modal")).toHaveTextContent(firstSpot.name);
    });
    expect(screen.queryByTestId("auth-dialog")).not.toBeInTheDocument();
    expect(testState.authDialogOpen).toBe(false);
  });

  it("keeps planning trip actions intact", () => {
    testState.tripData = {
      trip: { _id: "trip-1", title: "Your adventure", status: "planning", routeMode: "walk" },
      stops: [{ _id: "stop-1", spotId: secondSpot.id, position: 0, status: "planned" }],
    };

    render(<ExplorePage />);

    expect(screen.getByRole("button", { name: /route swakopmund/i })).toBeInTheDocument();
    expect(testState.mapProps.at(-1)).toMatchObject({
      highlightedSpotId: secondSpot.id,
    });
  });

  it("resumes the last viewed active trip from local storage", () => {
    window.localStorage.setItem(
      "wandr.activeTrip.snapshot.v1",
      JSON.stringify({
        destinationId: "windhoek",
        routeOpen: true,
        routedSpotId: secondSpot.id,
        lastViewedAt: Date.now(),
        trip: { _id: "trip-1", title: "Your adventure", status: "active", routeMode: "walk" },
        stops: [
          { _id: "stop-1", spotId: firstSpot.id, position: 0, status: "done" },
          { _id: "stop-2", spotId: secondSpot.id, position: 1, status: "current" },
        ],
      }),
    );

    render(<ExplorePage />);

    expect(testState.mapProps.at(-1)).toMatchObject({
      nextStop: { id: secondSpot.id },
      highlightedSpotId: secondSpot.id,
      routeOpen: true,
    });
  });

  it("ignores an explicit destination URL and keeps the multi-destination catalog", () => {
    window.localStorage.setItem(
      "wandr.activeTrip.snapshot.v1",
      JSON.stringify({
        destinationId: "swakopmund",
        routeOpen: true,
        routedSpotId: mockDestinations[1].spots[0]!.id,
        lastViewedAt: Date.now(),
        trip: { _id: "trip-1", title: "Your adventure", status: "active", routeMode: "walk" },
        stops: [{ _id: "stop-1", spotId: mockDestinations[1].spots[0]!.id, position: 0, status: "current" }],
      }),
    );

    render(<ExplorePage initialDestinationId="windhoek" />);

    expect(testState.mapProps.at(-1)).toMatchObject({
      nextStop: { id: swakopmundSpot.id },
    });
    expect(testState.mapProps.at(-1)?.spots).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: swakopmundSpot.id, destinationCity: "Swakopmund" })]),
    );
  });

  it("routes a trip stop from another destination in the same Explore trip", async () => {
    testState.tripData = {
      trip: { _id: "trip-1", title: "Your adventure", status: "planning", routeMode: "walk", destinationId: "catalog" },
      stops: [{ _id: "stop-1", spotId: firstSpot.id, position: 0, status: "planned" }],
    };

    render(<ExplorePage />);
    screen.getAllByRole("button", { name: /route swakopmund/i }).forEach((button) => fireEvent.click(button));

    await waitFor(() => {
      expect(testState.mapProps).toEqual(expect.arrayContaining([expect.objectContaining({
        routeOpen: true,
      })]));
    });
  });

  it("queues offline progress and advances the local active trip", async () => {
    vi.spyOn(window.navigator, "onLine", "get").mockReturnValue(false);
    window.localStorage.setItem(
      "wandr.activeTrip.snapshot.v1",
      JSON.stringify({
        destinationId: "windhoek",
        routeOpen: true,
        routedSpotId: firstSpot.id,
        lastViewedAt: Date.now(),
        trip: { _id: "trip-1", title: "Your adventure", status: "active", routeMode: "walk" },
        stops: [
          { _id: "stop-1", spotId: firstSpot.id, position: 0, status: "current" },
          { _id: "stop-2", spotId: secondSpot.id, position: 1, status: "planned" },
        ],
      }),
    );

    render(<ExplorePage />);
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    await waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem("wandr.activeTrip.offlineQueue.v1") ?? "[]")).toHaveLength(1);
      expect(testState.mapProps.at(-1)).toMatchObject({
        nextStop: { id: secondSpot.id },
      });
    });

    const snapshot = JSON.parse(window.localStorage.getItem("wandr.activeTrip.snapshot.v1") ?? "{}");
    expect(snapshot.stops).toMatchObject([
      { _id: "stop-1", status: "done" },
      { _id: "stop-2", status: "current" },
    ]);
  });

  it("replays queued offline actions when the app is online again", async () => {
    window.localStorage.setItem(
      "wandr.activeTrip.snapshot.v1",
      JSON.stringify({
        destinationId: "windhoek",
        routeOpen: true,
        routedSpotId: firstSpot.id,
        lastViewedAt: Date.now(),
        trip: { _id: "trip-1", title: "Your adventure", status: "active", routeMode: "walk" },
        stops: [{ _id: "stop-1", spotId: firstSpot.id, position: 0, status: "current" }],
      }),
    );
    window.localStorage.setItem(
      "wandr.activeTrip.offlineQueue.v1",
      JSON.stringify([
        {
          id: "queued-1",
          tripId: "trip-1",
          createdAt: Date.now(),
          type: "markDone",
          tripStopId: "stop-1",
        },
      ]),
    );

    render(<ExplorePage />);

    await waitFor(() => {
      expect(
        testState.mutationMocks.some((mutation) =>
          JSON.stringify(mutation.mock.calls).includes(
            JSON.stringify({
              tripId: "trip-1",
              action: { type: "markDone", tripStopId: "stop-1" },
            }),
          ),
        ),
      ).toBe(true);
    });
  });
});
