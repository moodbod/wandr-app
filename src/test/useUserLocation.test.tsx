import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUserLocation } from "@/hooks/useUserLocation";

const preferenceKey = "wandr.liveLocation.preference.v1";
const positionKey = "wandr.lastPosition.v1";

function setGeolocationMocks({
  permissionState,
  getCurrentPosition,
  watchPosition,
}: {
  permissionState: PermissionState;
  getCurrentPosition?: PositionCallback;
  watchPosition?: PositionCallback;
}) {
  const getCurrentPositionMock = vi.fn((success: PositionCallback, error: PositionErrorCallback) => {
    if (getCurrentPosition) {
      getCurrentPosition(success as never);
      return;
    }

    error({ code: 1, message: "User denied Geolocation" } as GeolocationPositionError);
  });
  const watchPositionMock = vi.fn((success: PositionCallback, error: PositionErrorCallback) => {
    if (watchPosition) {
      watchPosition(success as never);
    } else {
      error({ code: 1, message: "User denied Geolocation" } as GeolocationPositionError);
    }

    return 7;
  });
  const clearWatchMock = vi.fn();

  Object.defineProperty(window.navigator, "permissions", {
    configurable: true,
    value: {
      query: vi.fn(() => Promise.resolve({ state: permissionState })),
    },
  });

  Object.defineProperty(window.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition: getCurrentPositionMock,
      watchPosition: watchPositionMock,
      clearWatch: clearWatchMock,
    },
  });

  return { getCurrentPositionMock, watchPositionMock, clearWatchMock };
}

describe("useUserLocation", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it("does not ask again after the app already prompted and browser permission is still prompt", async () => {
    window.localStorage.setItem(preferenceKey, JSON.stringify({ enabled: true, prompted: true }));
    const { getCurrentPositionMock, watchPositionMock } = setGeolocationMocks({ permissionState: "prompt" });

    renderHook(() => useUserLocation());

    await waitFor(() => {
      expect(window.navigator.permissions.query).toHaveBeenCalledWith({ name: "geolocation" });
    });
    expect(getCurrentPositionMock).not.toHaveBeenCalled();
    expect(watchPositionMock).not.toHaveBeenCalled();
  });

  it("keeps live location off when the saved toggle is disabled", () => {
    window.localStorage.setItem(preferenceKey, JSON.stringify({ enabled: false, prompted: true }));
    window.localStorage.setItem(
      positionKey,
      JSON.stringify({ lngLat: [17.0832, -22.5597], accuracy: 10, heading: null, timestamp: 1 }),
    );
    const { getCurrentPositionMock, watchPositionMock } = setGeolocationMocks({ permissionState: "granted" });

    const { result } = renderHook(() => useUserLocation());

    expect(result.current.position).toBeNull();
    expect(getCurrentPositionMock).not.toHaveBeenCalled();
    expect(watchPositionMock).not.toHaveBeenCalled();
  });

  it("saves a denied first prompt so the app stops requesting location", async () => {
    const { getCurrentPositionMock } = setGeolocationMocks({ permissionState: "prompt" });

    renderHook(() => useUserLocation());

    await waitFor(() => {
      expect(getCurrentPositionMock).toHaveBeenCalled();
      expect(JSON.parse(window.localStorage.getItem(preferenceKey) ?? "{}")).toEqual({
        enabled: false,
        prompted: true,
      });
    });
  });
});
