import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLocalIdentity } from "@/features/prototype/use-local-identity";
import { readLocalApi } from "@/lib/actor-client";
import { saveDurableBooking } from "@/lib/booking-client";
import { peopleFixtures } from "@/lib/fixtures/people";
import type { RequestDraft } from "@/types/prototype";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("M1-D cookie transport and deliberate identity selection", () => {
  it("does not create a default session or fall back to fixture admin when bootstrap fails", async () => {
    const fetch = vi.fn(async () =>
      Response.json(
        { error: { code: "LOCAL_SESSION_REQUIRED" } },
        { status: 401 },
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const callback = vi.fn();
    const { result } = renderHook(() => useLocalIdentity(callback));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.person).toBeNull();
    expect(result.current.error).toBe("LOCAL_SESSION_REQUIRED");
    expect(fetch.mock.calls).toHaveLength(2);
    expect(
      fetch.mock.calls.every(
        (call) =>
          !(call as unknown[])[1] ||
          ((call as unknown[])[1] as RequestInit).method !== "POST",
      ),
    ).toBe(true);
  });
  it("selects explicitly and clears actor state if another selection fails", async () => {
    let selected = false;
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/development/session" && init?.method === "POST") {
        const { personId } = JSON.parse(String(init.body));
        if (personId === "user-vendor")
          return Response.json(
            { error: { code: "CANONICAL_PERSON_UNAVAILABLE" } },
            { status: 401 },
          );
        selected = true;
        return Response.json({ person: { id: "dev-user" } });
      }
      if (url === "/api/development/session")
        return Response.json(
          peopleFixtures.map(({ id, name, status, roles }) => ({
            id,
            name,
            status,
            roles,
          })),
        );
      return selected
        ? Response.json(peopleFixtures[0])
        : Response.json(
            { error: { code: "LOCAL_SESSION_REQUIRED" } },
            { status: 401 },
          );
    });
    vi.stubGlobal("fetch", fetch);
    const callback = vi.fn();
    const { result } = renderHook(() => useLocalIdentity(callback));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.select("dev-user");
    });
    await waitFor(() => expect(result.current.person?.id).toBe("dev-user"));
    await act(async () => {
      await expect(result.current.select("user-vendor")).rejects.toThrow(
        "CANONICAL_PERSON_UNAVAILABLE",
      );
    });
    expect(result.current.person).toBeNull();
    expect(
      fetch.mock.calls.every(([, init]) => init?.credentials === "same-origin"),
    ).toBe(true);
  });
  it("keeps booking payload and command key unchanged without actor headers", async () => {
    const fetch = vi.fn(async () => Response.json({ id: "REQ-TEST" }));
    vi.stubGlobal("fetch", fetch);
    const draft = {
      items: [],
      startDate: "2090-01-01",
      endDate: "2090-01-01",
    } as unknown as RequestDraft;
    await saveDurableBooking(
      draft,
      "forged-browser-admin",
      "stable-command-key",
    );
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/booking/requests");
    expect(init.credentials).toBe("same-origin");
    expect(init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(init.body))).toEqual({
      draft,
      commandKey: "stable-command-key",
    });
  });
});

describe("Inventory identity/loading recovery", () => {
  it("settles missing identity without waiting for selector discovery", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === "/api/actor/person"
          ? Response.json(
              { error: { code: "LOCAL_SESSION_REQUIRED" } },
              { status: 401 },
            )
          : new Promise<Response>(() => {}),
      ),
    );
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useLocalIdentity(callback));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.person).toBeNull();
    expect(result.current.error).toBe("LOCAL_SESSION_REQUIRED");
    expect(callback).toHaveBeenCalledWith(null);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });
    unmount();
  });
  it.each(["/api/actor/person", "/api/assets"])(
    "bounds a stalled %s read and aborts the network request",
    async (path) => {
      vi.useFakeTimers();
      let signal: AbortSignal | undefined;
      vi.stubGlobal(
        "fetch",
        vi.fn((_url: string, init: RequestInit) => {
          signal = init.signal as AbortSignal;
          return new Promise<Response>(() => {});
        }),
      );
      const pending = readLocalApi(path);
      const rejected = expect(pending).rejects.toThrow("LOCAL_PREVIEW_TIMEOUT");
      await vi.advanceTimersByTimeAsync(15000);
      await rejected;
      expect(signal?.aborted).toBe(true);
    },
  );
});
