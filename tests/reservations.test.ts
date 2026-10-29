import { describe, expect, it } from "vitest";

import {
  prototypeAssets,
  prototypeRequests,
} from "@/lib/fixtures/prototype-data";
import { activationEvents } from "@/lib/fixtures/activation-events";
import {
  blocksAssetAvailability,
  deriveReservations,
  getOperationalWindow,
  getReservationConflicts,
  getReservationPhaseState,
  operationalWindowsOverlap,
  validateOperationalWindow,
} from "@/lib/domain/reservations";
import { getBoothUsageDays } from "@/lib/domain/events";
import { getRequestEligibility } from "@/lib/fixtures/request-eligibility";

const glowPavilion = prototypeAssets.find(
  (asset) => asset.id === "wardah-glow-pavilion",
)!;
const reservations = deriveReservations(
  prototypeRequests,
  prototypeAssets,
  activationEvents,
);

describe("operational reservation windows", () => {
  it("derives outbound and inbound timestamps without changing usage dates", () => {
    const fixture = prototypeRequests.find(
      (request) => request.id === "REQ-2026-022",
    )!;
    expect(getOperationalWindow(fixture)).toEqual({
      outboundAt: "2026-10-10T09:00",
      inboundAt: "2026-10-15T17:00",
    });
    expect(fixture.startDate).toBe("2026-10-12");
    expect(fixture.endDate).toBe("2026-10-14");
    expect(getBoothUsageDays(fixture.startDate, fixture.endDate)).toBe(3);
  });

  it("validates same-day operations and rejects invalid phase ordering", () => {
    expect(
      validateOperationalWindow("2026-10-12", "2026-10-14", {
        outboundAt: "2026-10-12T09:00",
        inboundAt: "2026-10-14T17:00",
      }).valid,
    ).toBe(true);
    expect(
      validateOperationalWindow("2026-10-12", "2026-10-14", {
        outboundAt: "2026-10-13T09:00",
        inboundAt: "2026-10-14T17:00",
      }).error,
    ).toMatch(/Outbound must be on or before/);
    expect(
      validateOperationalWindow("2026-10-12", "2026-10-14", {
        outboundAt: "2026-10-11T09:00",
        inboundAt: "2026-10-13T17:00",
      }).error,
    ).toMatch(/Inbound must be on or after/);
    expect(
      validateOperationalWindow("2026-10-12", "2026-10-14", {
        outboundAt: "2026-10-15T17:00",
        inboundAt: "2026-10-15T09:00",
      }).error,
    ).toMatch(/Inbound must not be before outbound/);
  });

  it("uses half-open timestamp overlap so adjacent windows are allowed", () => {
    expect(
      operationalWindowsOverlap(
        { outboundAt: "2026-10-10T09:00", inboundAt: "2026-10-15T17:00" },
        { outboundAt: "2026-10-15T17:00", inboundAt: "2026-10-16T09:00" },
      ),
    ).toBe(false);
    expect(
      operationalWindowsOverlap(
        { outboundAt: "2026-10-15T16:59", inboundAt: "2026-10-16T09:00" },
        { outboundAt: "2026-10-10T09:00", inboundAt: "2026-10-15T17:00" },
      ),
    ).toBe(true);
  });

  it("blocks conflicts per Asset, not for another Asset with the same dates", () => {
    const overlapping = getReservationConflicts(
      glowPavilion,
      { outboundAt: "2026-10-11T09:00", inboundAt: "2026-10-15T10:00" },
      reservations,
    );
    expect(overlapping.map((item) => item.requestId)).toContain("REQ-2026-022");

    const anotherAsset = { ...glowPavilion, id: "unreserved-asset" };
    expect(
      getReservationConflicts(
        anotherAsset,
        { outboundAt: "2026-10-11T09:00", inboundAt: "2026-10-15T10:00" },
        reservations,
      ),
    ).toEqual([]);
    expect(
      getReservationConflicts(
        glowPavilion,
        { outboundAt: "2026-10-16T09:00", inboundAt: "2026-10-18T10:00" },
        reservations,
      ),
    ).toEqual([]);
  });

  it("conflicts by individually tracked Asset ID even if quantity fields are present", () => {
    const misleadingCapacity = {
      ...glowPavilion,
      supportsQuantity: true,
      availableQuantity: 20,
      totalQuantity: 20,
      trackingType: "Individual" as const,
    };
    expect(
      getReservationConflicts(
        misleadingCapacity,
        { outboundAt: "2026-10-11T09:00", inboundAt: "2026-10-15T10:00" },
        reservations,
      ).map((item) => item.requestId),
    ).toContain("REQ-2026-022");
  });

  it("retains the pre-existing single-item fixture quantity limit without stock allocation", () => {
    const posm = prototypeAssets.find(
      (asset) => asset.id === "wardah-posm-kit",
    )!;
    const window = {
      outboundAt: "2026-11-01T09:00",
      inboundAt: "2026-11-03T17:00",
    };
    expect(
      getRequestEligibility(posm, "2026-11-01", "2026-11-03", 13, [], window)
        .eligible,
    ).toBe(false);
    expect(
      getRequestEligibility(posm, "2026-11-01", "2026-11-03", 2, [], window)
        .eligible,
    ).toBe(true);
    expect(
      getReservationConflicts(
        posm,
        { outboundAt: "2026-09-04T09:00", inboundAt: "2026-09-05T12:00" },
        reservations,
      ).map((item) => item.requestId),
    ).toContain("REQ-2026-018");
  });

  it("never equates Request or item lifecycle status with physical completion", () => {
    const prior = prototypeRequests.find(
      (request) => request.id === "REQ-2026-022",
    )!;
    for (const status of [
      "In use",
      "Return due",
      "Inspection pending",
      "Completed",
    ] as const) {
      const [reservation] = deriveReservations(
        [
          {
            ...prior,
            status,
            items: prior.items.map((item) => ({
              ...item,
              fulfillmentState: "Returned" as const,
            })),
          },
        ],
        prototypeAssets,
        activationEvents,
      );
      expect(
        getReservationPhaseState(reservation, "Outbound", "2026-10-16T09:00"),
      ).toBe("Awaiting confirmation");
      expect(
        getReservationPhaseState(reservation, "Inbound", "2026-10-16T09:00"),
      ).toBe("Late");
      expect(
        getReservationPhaseState(
          reservation,
          "Event usage",
          "2026-10-13T12:00",
        ),
      ).toBe("Planned usage window");
    }
  });

  it("marks planned dates due without fabricating actual departure or receipt", () => {
    const reservation = reservations.find(
      (item) => item.requestId === "REQ-2026-022",
    )!;
    expect(
      getReservationPhaseState(reservation, "Outbound", "2026-10-10T08:00"),
    ).toBe("Due");
    expect(
      getReservationPhaseState(reservation, "Inbound", "2026-10-15T12:00"),
    ).toBe("Due");
    expect(
      getReservationPhaseState(reservation, "Inbound", "2026-10-15T17:01"),
    ).toBe("Late");
    expect("actualOutboundAt" in reservation).toBe(false);
    expect("actualInboundAt" in reservation).toBe(false);
  });

  it("does not reserve Custom Booth without physical RequestItems", () => {
    const customBooth = {
      ...prototypeRequests[0],
      id: "REQ-CUSTOM-NO-ASSET",
      items: [],
      boothType: "Custom Booth" as const,
    };
    expect(
      deriveReservations([customBooth], prototypeAssets, activationEvents),
    ).toEqual([]);
    expect(
      deriveReservations(
        [
          {
            ...customBooth,
            items: [
              {
                id: "REQ-CUSTOM-NO-ASSET:item:1",
                assetId: "wardah-posm-kit",
                quantity: 2,
              },
            ],
          },
        ],
        prototypeAssets,
        activationEvents,
      ),
    ).toHaveLength(1);
  });

  it("releases rejected/cancelled/draft requests but not Completed physical items without receipt", () => {
    const prior = prototypeRequests.find(
      (request) => request.id === "REQ-2026-022",
    )!;
    const released = deriveReservations(
      [
        { ...prior, status: "Rejected" },
        { ...prior, id: "REQ-CANCELLED", status: "Cancelled" },
        { ...prior, id: "REQ-DONE", status: "Completed" },
        { ...prior, id: "REQ-DRAFT", status: "Draft" },
      ],
      prototypeAssets,
      activationEvents,
    );
    expect(
      released.filter(
        (reservation) => reservation.requestStatus === "Completed",
      ),
    ).toHaveLength(1);
    expect(
      released.find((reservation) => reservation.requestStatus === "Completed")
        ?.blocksAvailability,
    ).toBe(true);
    expect(
      released
        .filter((reservation) => reservation.requestStatus !== "Completed")
        .every((reservation) => !reservation.blocksAvailability),
    ).toBe(true);
  });

  it("uses only inclusive usage dates for the unchanged 30-day Booth policy", () => {
    const longLogisticsWindow = {
      outboundAt: "2026-07-25T08:00",
      inboundAt: "2026-09-05T18:00",
    };
    expect(
      validateOperationalWindow("2026-08-01", "2026-08-30", longLogisticsWindow)
        .valid,
    ).toBe(true);
    expect(getBoothUsageDays("2026-08-01", "2026-08-30")).toBe(30);
    expect(getBoothUsageDays("2026-08-01", "2026-08-31")).toBe(31);
  });

  it("blocks for active/planned lifecycle statuses but releases non-blocking history", () => {
    const prior = prototypeRequests.find(
      (request) => request.id === "REQ-2026-022",
    )!;
    const blockingStatuses = [
      "Pending approval",
      "Approved",
      "Ready",
      "Return due",
      "Inspection pending",
      "Overdue",
      "In use",
      "Needs update",
    ] as const;
    const blocking = deriveReservations(
      blockingStatuses.map((status) => ({ ...prior, id: status, status })),
      prototypeAssets,
      activationEvents,
    );
    expect(
      blocking.every((reservation) => reservation.blocksAvailability),
    ).toBe(true);
    expect(blocksAssetAvailability("Pending approval")).toBe(true);
    expect(blocksAssetAvailability("Completed")).toBe(true);
    for (const status of ["Draft", "Rejected", "Cancelled"] as const) {
      expect(blocksAssetAvailability(status)).toBe(false);
    }
  });
});
