import { describe, expect, it } from "vitest";
import {
  dispatchOutbound,
  receiveOutbound,
  applyOutboundReceipt,
} from "@/lib/domain/outbound";
import {
  deriveReservations,
  getReservationPhaseState,
} from "@/lib/domain/reservations";
import {
  prototypeRequests,
  prototypeAssets,
} from "@/lib/fixtures/prototype-data";
import { peopleFixtures } from "@/lib/fixtures/people";

const request = prototypeRequests.find(
  (request) => request.id === "REQ-2026-014",
)!;
const actor = peopleFixtures.find((person) => person.status === "ACTIVE")!;
const letters = [
  {
    id: "loading-in",
    category: "Loading-in letter" as const,
    name: "loading-in.pdf",
    mimeType: "application/pdf",
    size: 100,
    dataUrl: "data:application/pdf;base64,JVBERg==",
  },
];
const input = {
  id: "dispatch-1",
  groupId: "outbound-default",
  itemIds: request.items.map((item) => item.id),
  senderPic: "Origin PIC",
  loadingInLetters: letters,
  at: "2026-08-22T08:00:00+07:00",
};
const dispatch = () =>
  dispatchOutbound([], request, prototypeAssets, [], actor, input);

describe("request outbound physical evidence", () => {
  it("dispatches approved items with source snapshots and one set of letters", () => {
    const record = dispatch();
    expect(record.items).toHaveLength(2);
    expect(record.loadingInLetters).toEqual(letters);
    expect(record.dispatchedByUserId).toBe(actor.id);
    expect(record.senderPic).toBe("Origin PIC");
    expect(record.items.every((item) => !item.receivedAt)).toBe(true);
    expect(record.items[0].sourceLocation).toBe(
      prototypeAssets.find((asset) => asset.id === request.items[0].assetId)!
        .location,
    );
  });
  it("blocks pending approval, inactive actors, missing letters, and wrong-group items", () => {
    expect(() =>
      dispatchOutbound(
        [],
        { ...request, status: "Pending approval" },
        prototypeAssets,
        [],
        actor,
        input,
      ),
    ).toThrow(/approved/);
    expect(() =>
      dispatchOutbound(
        [],
        request,
        prototypeAssets,
        [],
        { ...actor, status: "INACTIVE" },
        input,
      ),
    ).toThrow(/active/);
    expect(() =>
      dispatchOutbound([], request, prototypeAssets, [], actor, {
        ...input,
        loadingInLetters: [],
      }),
    ).toThrow(/letter/);
    expect(() =>
      dispatchOutbound([], request, prototypeAssets, [], actor, {
        ...input,
        itemIds: ["other-request-item"],
      }),
    ).toThrow(/belong/);
    expect(() =>
      dispatchOutbound([], request, prototypeAssets, [], actor, {
        ...input,
        loadingInLetters: [{ ...letters[0], size: 6 * 1024 * 1024 }],
      }),
    ).toThrow(/5 MB/);
  });
  it("blocks duplicate dispatch, returned items and assets with physical holds", () => {
    expect(() =>
      dispatchOutbound([dispatch()], request, prototypeAssets, [], actor, {
        ...input,
        id: "dispatch-2",
      }),
    ).toThrow(/already/);
    expect(() =>
      dispatchOutbound(
        [],
        request,
        prototypeAssets.map((asset) =>
          asset.id === request.items[0].assetId
            ? { ...asset, availability: "maintenance" }
            : asset,
        ),
        [],
        actor,
        input,
      ),
    ).toThrow(/ready/);
    expect(() =>
      dispatchOutbound(
        [],
        request,
        prototypeAssets,
        [
          {
            id: "return",
            requestId: request.id,
            requestItemId: request.items[0].id,
            assetId: request.items[0].assetId,
            initiatedAt: input.at,
            initiatedBy: "Holder",
          },
        ],
        actor,
        input,
      ),
    ).toThrow(/already/);
  });
  it("receives a subset and changes location/custody only with receipt evidence", () => {
    const record = dispatch();
    const asset = prototypeAssets.find(
      (asset) => asset.id === record.items[0].assetId,
    )!;
    expect(() =>
      applyOutboundReceipt(asset, record, record.items[0].requestItemId),
    ).toThrow(/receipt/);
    const received = receiveOutbound(record, actor, {
      itemIds: [record.items[0].requestItemId],
      receiverPic: "Site receiver",
      condition: "Fair",
      at: "2026-08-22T09:00:00+07:00",
    });
    expect(received.items[1].receivedAt).toBeUndefined();
    const moved = applyOutboundReceipt(
      asset,
      received,
      record.items[0].requestItemId,
    );
    expect(moved.location).toBe(request.destination);
    expect(moved.currentCustodian).toBe("Site receiver");
    expect(moved.condition).toBe("Fair");
    expect(moved.availability).toBe("in-use");
    expect(asset.location).toBe(record.items[0].sourceLocation);
    expect(() =>
      receiveOutbound(received, actor, {
        itemIds: [record.items[0].requestItemId],
        receiverPic: "Site receiver",
        condition: "Good",
        at: "2026-08-22T10:00:00+07:00",
      }),
    ).toThrow(/not been received/);
    expect(() =>
      receiveOutbound(record, actor, {
        itemIds: [record.items[0].requestItemId],
        receiverPic: "Site receiver",
        condition: "Good",
        at: "2026-08-21T10:00:00+07:00",
      }),
    ).toThrow(/after dispatch/);
  });
  it("calendar actual outbound and usage state derive from evidence, with planned windows unchanged", () => {
    const record = dispatch();
    const planned = deriveReservations([request], prototypeAssets, [], []);
    const after = deriveReservations(
      [request],
      prototypeAssets,
      [],
      [],
      [record],
    );
    expect(after[0].actualOutboundAt).toBe(record.dispatchedAt);
    expect(after[0].outboundAt).toBe(planned[0].outboundAt);
    expect(
      getReservationPhaseState(after[0], "Outbound", "2026-08-23T12:00"),
    ).toContain("Dispatched");
    expect(after[0].actualInboundAt).toBeUndefined();
  });
});
