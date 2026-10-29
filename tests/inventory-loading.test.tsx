import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import {
  PrototypeProvider,
  usePrototype,
} from "@/features/prototype/prototype-provider";
import { peopleFixtures } from "@/lib/fixtures/people";
vi.mock("@/components/shared/use-vendor-locations", () => ({
  useVendorLocations: () => ({
    vendorLocations: [],
    vendorLoading: false,
    vendorError: "",
  }),
}));
const wrapper = ({ children }: { children: ReactNode }) => (
  <PrototypeProvider>{children}</PrototypeProvider>
);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("Inventory loading state", () => {
  it("ends loading with a missing session and never fetches/fabricates catalog data", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn(async (url: string) =>
      url === "/api/actor/person"
        ? Response.json(
            { error: { code: "LOCAL_SESSION_REQUIRED" } },
            { status: 401 },
          )
        : Response.json([]),
    );
    vi.stubGlobal("fetch", fetch);
    const { result } = renderHook(() => usePrototype(), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.assetLoading).toBe(false);
    expect(result.current.assetError).toBe("LOCAL_SESSION_REQUIRED");
    expect(result.current.currentUser.id).toBe("");
    expect(result.current.catalogAssets).toEqual([]);
    expect(fetch.mock.calls.some(([url]) => url === "/api/assets")).toBe(false);
  });
  it("turns a stalled catalog fetch into a recoverable error instead of endless loading", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/actor/person")
          return Response.json(peopleFixtures[0]);
        if (url === "/api/assets") return new Promise<Response>(() => {});
        return Response.json([]);
      }),
    );
    const { result } = renderHook(() => usePrototype(), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.assetLoading).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    expect(result.current.assetLoading).toBe(false);
    expect(result.current.assetError).toBe("LOCAL_PREVIEW_TIMEOUT");
    expect(result.current.catalogAssets).toEqual([]);
  });
});
