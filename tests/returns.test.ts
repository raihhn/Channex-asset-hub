import { describe, expect, it } from "vitest";

import { activationEvents } from "@/lib/fixtures/activation-events";
import {
  prototypeAssets,
  prototypeRequests,
  prototypeReturnReceipts,
} from "@/lib/fixtures/prototype-data";
import { getRegisteredLocation } from "@/lib/fixtures/registered-locations";
import {
  deriveReservations,
  getReservationConflicts,
  getReservationPhaseState,
} from "@/lib/domain/reservations";
import {
  applyInspectionToAsset,
  applyReceiptToAsset,
  completeReturnInspection,
  confirmReturnReceived,
  findReturnReceipt,
  getReturnProgress,
  initiateReturn,
  normalizeLegacyReturnReceipts,
} from "@/lib/domain/returns";
import { getRequestEligibility } from "@/lib/fixtures/request-eligibility";

const partialRequest = prototypeRequests.find(
  (item) => item.id === "REQ-2026-030",
)!;
const receivedAsset = prototypeAssets.find(
  (item) => item.id === "return-demo-pavilion",
)!;
const outstandingAsset = prototypeAssets.find(
  (item) => item.id === "return-demo-display",
)!;
const jakartaHub = getRegisteredLocation("warehouse-jakarta-hub")!;

describe("authoritative per-item return", () => {
  it("starts explicitly without receipt, actual inbound, or location/custody mutation", () => {
    const started = initiateReturn(
      [],
      partialRequest,
      partialRequest.items[1].id,
      "Holder",
      "2026-10-03T10:00:00+07:00",
    );
    expect(started).toHaveLength(1);
    expect(started[0].requestItemId).toBe(partialRequest.items[1].id);
    expect(started[0].assetId).toBe(outstandingAsset.id);
    expect(started[0].receivedAt).toBeUndefined();
    expect(started[0].receivedBy).toBeUndefined();
    expect(started[0].receivingLocationId).toBeUndefined();
    expect(outstandingAsset.location).toBe("Jakarta Hub");
    expect(outstandingAsset.currentCustodian).toBeUndefined();
    expect(() =>
      initiateReturn(
        started,
        partialRequest,
        partialRequest.items[1].id,
        "Holder",
        "2026-10-03T11:00:00+07:00",
      ),
    ).toThrow(/already been initiated/);
  });

  it("creates actual inbound only from Confirm Received and captures distinct condition, PIC, and location", () => {
    const started = initiateReturn(
      [],
      partialRequest,
      partialRequest.items[1].id,
      "Holder",
      "2026-10-03T10:00:00+07:00",
    );
    const received = confirmReturnReceived(
      started,
      partialRequest,
      partialRequest.items[1].id,
      {
        receivedBy: "Receiver A",
        receivingLocationId: jakartaHub.id,
        conditionAtReceipt: "Fair",
        notes: "Surface scuff",
      },
      "2026-10-03T14:32:00+07:00",
    );
    const receipt = received[0];
    expect(receipt.receivedAt).toBe("2026-10-03T14:32:00+07:00");
    expect(receipt.receivedBy).toBe("Receiver A");
    expect(receipt.conditionAtReceipt).toBe("Fair");
    const updated = applyReceiptToAsset(outstandingAsset, receipt, jakartaHub);
    expect(updated.location).toBe(jakartaHub.name);
    expect(updated.currentCustodian).toBe("Receiver A");
    expect(updated.inspectionState).toBe("Inspection pending");
    expect(updated.availability).toBe("unavailable");
    expect(updated.issues).toEqual(outstandingAsset.issues);
    expect(() =>
      confirmReturnReceived(
        received,
        partialRequest,
        partialRequest.items[1].id,
        {
          receivedBy: "Other",
          receivingLocationId: jakartaHub.id,
          conditionAtReceipt: "Good",
        },
        "2026-10-04T09:00:00+07:00",
      ),
    ).toThrow(/already received/);
  });

  it("keeps a two-Asset Request partial: received item completed, other late and outstanding", () => {
    const reservations = deriveReservations(
      [partialRequest],
      prototypeAssets,
      activationEvents,
      prototypeReturnReceipts,
    );
    const received = reservations.find(
      (item) => item.assetId === receivedAsset.id,
    )!;
    const outstanding = reservations.find(
      (item) => item.assetId === outstandingAsset.id,
    )!;
    expect(
      getReservationPhaseState(received, "Inbound", "2026-10-07T12:00"),
    ).toBe("Completed");
    expect(received.actualInboundAt).toBe(
      prototypeReturnReceipts[0].receivedAt,
    );
    expect(
      getReservationPhaseState(outstanding, "Inbound", "2026-10-07T12:00"),
    ).toBe("Late");
    expect(outstanding.actualInboundAt).toBeUndefined();
    expect(
      getReturnProgress(undefined, outstanding.inboundAt, "2026-10-07T12:00"),
    ).toBe("Overdue");
    expect(partialRequest.status).toBe("Return due");
    const future = {
      outboundAt: "2026-10-08T09:00",
      inboundAt: "2026-10-09T17:00",
    };
    expect(
      getReservationConflicts(
        receivedAsset,
        future,
        reservations,
        "2026-10-07T12:00",
      ),
    ).toEqual([]);
    expect(
      getReservationConflicts(
        outstandingAsset,
        future,
        reservations,
        "2026-10-07T12:00",
      ),
    ).toHaveLength(1);
  });

  it("uses early receipt as the effective reservation endpoint while inspection still blocks eligibility", () => {
    const request = prototypeRequests.find(
      (item) => item.id === "REQ-2026-031",
    )!;
    const asset = prototypeAssets.find(
      (item) => item.id === "return-demo-counter",
    )!;
    const [reservation] = deriveReservations(
      [request],
      prototypeAssets,
      activationEvents,
      prototypeReturnReceipts,
    );
    expect(reservation.actualInboundAt).toBe("2026-10-04T16:00:00+07:00");
    expect(reservation.inboundAt).toBe("2026-10-12T16:00");
    const future = {
      outboundAt: "2026-10-05T09:00",
      inboundAt: "2026-10-06T17:00",
    };
    expect(
      getReservationConflicts(asset, future, [reservation], "2026-10-07T12:00"),
    ).toEqual([]);
    const receipt = findReturnReceipt(
      prototypeReturnReceipts,
      request.items[0].id,
    )!;
    const afterReceipt = applyReceiptToAsset(asset, receipt, jakartaHub);
    expect(
      getRequestEligibility(
        afterReceipt,
        "2026-10-05",
        "2026-10-06",
        1,
        [reservation],
        future,
      ).eligible,
    ).toBe(false);
    expect(afterReceipt.inspectionState).toBe("Inspection pending");
  });

  it("keeps condition separate from issue and records manual inspection Clear or Hold", () => {
    const request = prototypeRequests.find(
      (item) => item.id === "REQ-2026-032",
    )!;
    const asset = prototypeAssets.find(
      (item) => item.id === "return-demo-kit",
    )!;
    const receipt = findReturnReceipt(
      prototypeReturnReceipts,
      request.items[0].id,
    )!;
    const received = applyReceiptToAsset(asset, receipt, jakartaHub);
    expect(received.condition).toBe("Needs review");
    expect(received.issues).toHaveLength(1);
    const inspected = completeReturnInspection(
      prototypeReturnReceipts,
      request,
      request.items[0].id,
      "On hold",
      "2026-10-03T09:00:00+07:00",
    );
    expect(
      findReturnReceipt(inspected, request.items[0].id)?.inspectionOutcome,
    ).toBe("On hold");
    const held = applyInspectionToAsset(
      received,
      "On hold",
      "2026-10-03T09:00:00+07:00",
    );
    expect(held.inspectionState).toBe("On hold");
    expect(held.availability).toBe("unavailable");
    expect(
      applyInspectionToAsset(received, "Clear", "2026-10-03T09:00:00+07:00")
        .availability,
    ).toBe("unavailable");
  });

  it("does not create receipt from planned dates or a Completed Request label", () => {
    const request = prototypeRequests.find(
      (item) => item.id === "REQ-2026-004",
    )!;
    const [reservation] = deriveReservations(
      [request],
      prototypeAssets,
      activationEvents,
      prototypeReturnReceipts,
    );
    expect(request.status).toBe("Completed");
    expect(
      findReturnReceipt(prototypeReturnReceipts, request.items[0].id),
    ).toBeUndefined();
    expect(reservation.actualInboundAt).toBeUndefined();
    expect(reservation.blocksAvailability).toBe(true);
    expect(
      getReservationPhaseState(reservation, "Inbound", "2026-10-07T12:00"),
    ).toBe("Late");
    const asset = prototypeAssets.find(
      (item) => item.id === request.items[0].assetId,
    )!;
    expect(
      getReservationConflicts(
        asset,
        {
          outboundAt: "2026-10-08T09:00",
          inboundAt: "2026-10-09T17:00",
        },
        [reservation],
        "2026-10-07T12:00",
      ),
    ).toHaveLength(1);

    const started = initiateReturn(
      [],
      request,
      request.items[0].id,
      "Holder",
      "2026-07-10T10:00:00+07:00",
    );
    const received = confirmReturnReceived(
      started,
      request,
      request.items[0].id,
      {
        receivedBy: "Receiver",
        receivingLocationId: jakartaHub.id,
        conditionAtReceipt: "Good",
      },
      "2026-07-10T16:00:00+07:00",
    );
    const [confirmed] = deriveReservations(
      [request],
      prototypeAssets,
      activationEvents,
      received,
    );
    expect(confirmed.actualInboundAt).toBe(received[0].receivedAt);
    expect(
      getReservationPhaseState(confirmed, "Inbound", "2026-10-07T12:00"),
    ).toBe("Completed");
    expect(
      getReservationConflicts(
        asset,
        {
          outboundAt: "2026-10-08T09:00",
          inboundAt: "2026-10-09T17:00",
        },
        [confirmed],
        "2026-10-07T12:00",
      ),
    ).toEqual([]);
  });

  it("keeps two item instances of the same Asset independent by requestItemId", () => {
    const request = {
      ...partialRequest,
      id: "REQ-DUPLICATE-ASSET",
      items: [
        {
          id: "REQ-DUPLICATE-ASSET:item:1",
          assetId: receivedAsset.id,
          quantity: 1,
        },
        {
          id: "REQ-DUPLICATE-ASSET:item:2",
          assetId: receivedAsset.id,
          quantity: 1,
        },
      ],
    };
    const started = initiateReturn(
      [],
      request,
      request.items[0].id,
      "Holder",
      "2026-10-03T09:00:00+07:00",
    );
    const received = confirmReturnReceived(
      started,
      request,
      request.items[0].id,
      {
        receivedBy: "Receiver",
        receivingLocationId: jakartaHub.id,
        conditionAtReceipt: "Good",
      },
      "2026-10-03T13:00:00+07:00",
    );
    expect(
      findReturnReceipt(received, request.items[0].id)?.receivedAt,
    ).toBeDefined();
    expect(findReturnReceipt(received, request.items[1].id)).toBeUndefined();
    const reservations = deriveReservations(
      [request],
      prototypeAssets,
      activationEvents,
      received,
    );
    expect(reservations[0].actualInboundAt).toBeDefined();
    expect(reservations[1].actualInboundAt).toBeUndefined();
    expect(reservations[0].requestItemId).toBe(request.items[0].id);
    expect(reservations[1].requestItemId).toBe(request.items[1].id);
    expect(
      getReservationPhaseState(reservations[1], "Inbound", "2026-10-07T12:00"),
    ).toBe("Late");
  });

  it("normalizes legacy receipts only with an unambiguous item match", () => {
    const { requestItemId: _unused, ...legacy } = prototypeReturnReceipts[0];
    const unique = normalizeLegacyReturnReceipts([legacy], [partialRequest]);
    expect(unique.unresolved).toEqual([]);
    expect(unique.receipts[0].requestItemId).toBe(partialRequest.items[0].id);

    const ambiguousRequest = {
      ...partialRequest,
      items: [
        partialRequest.items[0],
        { ...partialRequest.items[0], id: "REQ-2026-030:item:duplicate" },
      ],
    };
    const ambiguous = normalizeLegacyReturnReceipts(
      [legacy],
      [ambiguousRequest],
    );
    expect(ambiguous.receipts).toEqual([]);
    expect(ambiguous.unresolved).toEqual([legacy]);
  });
});
