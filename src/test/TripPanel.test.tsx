import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TripPanel, { type TripPanelData } from "@/components/TripPanel";
import { destinations } from "@/data/destinations";

const destination = destinations[0];
const spots = destination.spots.map((spot) => ({
  ...spot,
  destinationId: destination.id,
  destinationCity: destination.city,
  destinationCountry: destination.country,
}));
const firstSpot = spots[0]!;
const secondSpot = spots[1]!;

function renderTripPanel(tripData: TripPanelData | undefined, selectedSpot = firstSpot) {
  const handlers = {
    onAddSpot: vi.fn(),
    onRemoveStop: vi.fn(),
    onMoveStop: vi.fn(),
    onStartTrip: vi.fn(),
    onRouteStop: vi.fn(),
    onMarkDone: vi.fn(),
    onSkipStop: vi.fn(),
    onRouteModeChange: vi.fn(),
  };

  render(<TripPanel title="Your trip" spots={spots} tripData={tripData} selectedSpot={selectedSpot} {...handlers} />);

  return handlers;
}

describe("TripPanel", () => {
  it("renders an empty adventure state", () => {
    renderTripPanel(null);

    expect(screen.getByText("Start with a spot")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Add ${firstSpot.name}` })).toBeInTheDocument();
  });

  it("adds the selected spot from the empty state", () => {
    const handlers = renderTripPanel(null);

    fireEvent.click(screen.getByRole("button", { name: `Add ${firstSpot.name}` }));

    expect(handlers.onAddSpot).toHaveBeenCalledWith(firstSpot);
  });

  it("shows planning controls with correct reorder bounds", () => {
    renderTripPanel({
      trip: { _id: "trip-1", title: "Your adventure", status: "planning", routeMode: "walk" },
      stops: [
        { _id: "stop-1", spotId: firstSpot.id, position: 0, status: "planned" },
        { _id: "stop-2", spotId: secondSpot.id, position: 1, status: "planned" },
      ],
    });

    expect(screen.getByRole("button", { name: "Start trip" })).toBeEnabled();
    expect(screen.getByRole("button", { name: `Move ${firstSpot.name} up` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Move ${secondSpot.name} down` })).toBeDisabled();
    expect(screen.getByRole("button", { name: `Remove ${firstSpot.name}` })).toBeInTheDocument();
  });

  it("emphasizes active trip progress and current stop actions", () => {
    renderTripPanel({
      trip: { _id: "trip-1", title: "Your adventure", status: "active", routeMode: "drive" },
      stops: [
        { _id: "stop-1", spotId: firstSpot.id, position: 0, status: "done" },
        { _id: "stop-2", spotId: secondSpot.id, position: 1, status: "current" },
      ],
    });

    expect(screen.getByText("1/2 complete")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: secondSpot.name })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Done" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
  });
});
