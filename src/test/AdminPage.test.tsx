import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminPage from "@/app/admin/page";

const testState = vi.hoisted(() => ({
  authenticated: true,
  role: "admin" as "traveler" | "admin",
  adminData: {
    destinations: [
      {
        _id: "destination-1",
        id: "windhoek",
        city: "Windhoek",
        country: "Namibia",
        flag: "NA",
        status: "active",
      },
    ],
    spots: [
      {
        _id: "spot-1",
        destinationId: "destination-1",
        slug: "joes-beerhouse",
        name: "Joe's Beerhouse",
        category: "eat",
        top: "38%",
        left: "62%",
        lngLat: [17.0922, -22.5474],
        walkMin: 8,
        driveMin: 4,
        tip: "A local classic.",
        tag: "Local classic",
        image: "/placeholder.svg",
        status: "active",
      },
    ],
  },
}));

vi.mock("@convex-dev/auth/react", () => ({
  useConvexAuth: () => ({ isAuthenticated: testState.authenticated, isLoading: false }),
}));

vi.mock("convex/react", () => ({
  useQuery: (query: unknown, args: unknown) => {
    if (args === "skip") {
      return undefined;
    }

    const functionName = getFunctionName(query as never);

    if (functionName === "users:current") {
      return testState.authenticated
        ? { name: "Test User", email: "test@example.com", onboardingCompleted: true, role: testState.role }
        : null;
    }

    if (functionName === "content:adminList") {
      return testState.adminData;
    }

    return null;
  },
  useMutation: (mutation: unknown) => {
    const functionName = getFunctionName(mutation as never);

    return vi.fn(async (args?: { spotId?: string }) => {
      if (functionName === "content:archiveSpot" && args?.spotId) {
        testState.adminData.spots = testState.adminData.spots.map((spot) =>
          spot._id === args.spotId ? { ...spot, status: "archived" } : spot,
        );
      }

      if (functionName === "content:restoreSpot" && args?.spotId) {
        testState.adminData.spots = testState.adminData.spots.map((spot) =>
          spot._id === args.spotId ? { ...spot, status: "active" } : spot,
        );
      }

      if (functionName === "content:seedNamibiaDefaults") {
        return { insertedDestinations: 0, insertedSpots: 0, updatedSpots: 0 };
      }

      return "spot-2";
    });
  },
}));

vi.mock("@/components/AuthDialog", () => ({
  AuthDialog: () => null,
}));

describe("AdminPage", () => {
  beforeEach(() => {
    testState.authenticated = true;
    testState.role = "admin";
    testState.adminData.spots = [
      {
        _id: "spot-1",
        destinationId: "destination-1",
        slug: "joes-beerhouse",
        name: "Joe's Beerhouse",
        category: "eat",
        top: "38%",
        left: "62%",
        lngLat: [17.0922, -22.5474],
        walkMin: 8,
        driveMin: 4,
        tip: "A local classic.",
        tag: "Local classic",
        image: "/placeholder.svg",
        status: "active",
      },
    ];
  });

  it("blocks non-admin travelers", () => {
    testState.role = "traveler";

    render(<AdminPage />);

    expect(screen.getByText("Unauthorized")).toBeInTheDocument();
    expect(screen.queryByText("Platform spots")).not.toBeInTheDocument();
  });

  it("renders management controls for admins", () => {
    render(<AdminPage />);

    expect(screen.getByText("Platform spots")).toBeInTheDocument();
    expect(screen.getByText("Joe's Beerhouse")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /archive joe's beerhouse/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add spot/i })).toBeInTheDocument();
  });

  it("removes archived spots from the active admin list", async () => {
    render(<AdminPage />);

    fireEvent.click(screen.getByRole("button", { name: /archive joe's beerhouse/i }));

    await waitFor(() => {
      expect(screen.queryByText("Joe's Beerhouse")).not.toBeInTheDocument();
    });
  });
});
