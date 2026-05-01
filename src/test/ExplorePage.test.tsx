import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExplorePage from "@/components/ExplorePage";
import { destinations } from "@/data/destinations";

const testState = vi.hoisted(() => ({
  tripData: null as
    | null
    | {
        trip: { _id: string; title: string; status: "planning" | "active"; routeMode: "walk" | "drive" };
        stops: Array<{ _id: string; spotId: string; position: number; status: string }>;
      },
  mapProps: [] as Array<{ nextStop?: { id: string }; highlightedSpotId?: string | null; routeOpen: boolean }>,
}));

vi.mock("@convex-dev/auth/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(() => Promise.resolve({ tripId: "trip-1" })),
  useQuery: (_query: unknown, args: unknown) => {
    if (args === "skip") {
      return undefined;
    }

    if (args && typeof args === "object" && "destinationId" in args) {
      return testState.tripData;
    }

    return { name: "Test User", email: "test@example.com", onboardingCompleted: true };
  },
}));

vi.mock("@/components/MapboxStreetsMap", () => ({
  default: (props: { nextStop?: { id: string }; highlightedSpotId?: string | null; routeOpen: boolean }) => {
    testState.mapProps.push(props);
    return <div data-testid="map" />;
  },
}));

vi.mock("@/components/AuthStatus", () => ({
  AuthStatus: () => <div data-testid="auth-status" />,
}));

vi.mock("@/components/DestinationPicker", () => ({
  default: () => <div data-testid="destination-picker" />,
}));

vi.mock("@/components/RoutePanel", () => ({
  default: () => <div data-testid="route-panel" />,
}));

vi.mock("@/components/TripPanel", () => ({
  default: () => <div data-testid="trip-panel" />,
}));

vi.mock("@/components/SpotModal", () => ({
  default: () => <div data-testid="spot-modal" />,
}));

vi.mock("@/components/AuthDialog", () => ({
  AuthDialog: () => null,
}));

vi.mock("@/components/OnboardingDialog", () => ({
  OnboardingDialog: () => null,
}));

const firstSpot = destinations[0].spots[0]!;
const secondSpot = destinations[0].spots[1]!;

describe("ExplorePage recommendation card", () => {
  beforeEach(() => {
    testState.tripData = null;
    testState.mapProps = [];
  });

  it("renders inactive recommendations as a showcase without highlighting the map marker", () => {
    render(<ExplorePage />);

    expect(screen.getByText("You might like this")).toBeInTheDocument();
    expect(screen.getByText(firstSpot.name)).toBeInTheDocument();
    expect(screen.getByText(firstSpot.tag)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view spot/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^route$/i })).toBeInTheDocument();

    expect(testState.mapProps.at(-1)).toMatchObject({
      nextStop: { id: firstSpot.id },
      highlightedSpotId: null,
      routeOpen: false,
    });
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

  it("keeps planning trip actions intact", () => {
    testState.tripData = {
      trip: { _id: "trip-1", title: "Your adventure", status: "planning", routeMode: "walk" },
      stops: [{ _id: "stop-1", spotId: secondSpot.id, position: 0, status: "planned" }],
    };

    render(<ExplorePage />);

    expect(screen.getByText("Ready to start")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start trip/i })).toBeInTheDocument();
    expect(testState.mapProps.at(-1)).toMatchObject({
      nextStop: { id: secondSpot.id },
      highlightedSpotId: secondSpot.id,
    });
  });
});
