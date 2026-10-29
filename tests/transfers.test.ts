import { describe, expect, it } from "vitest";
import {
  dispatchTransfer,
  receiveTransfer,
  applyTransferReceipt,
} from "@/lib/domain/transfers";
import { prototypeAssets } from "@/lib/fixtures/prototype-data";
import { peopleFixtures } from "@/lib/fixtures/people";
import type { TransferPlan } from "@/types/identity";
const asset = {
  ...prototypeAssets.find((asset) => asset.id === "wardah-curved-counter")!,
  inspectionState: "Clear" as const,
};
const plan: TransferPlan = {
  id: "transfer",
  assetId: asset.id,
  sourceLocation: asset.location,
  destinationId: "vendor-abc-cakung",
  responsibleParty: "Planned receiver",
  condition: "Good",
  evidenceViews: ["Front", "Left side", "Detail"],
  notes: "",
  submittedAt: "2026-10-13T08:00:00+07:00",
};
const actor = peopleFixtures[0];
const send = () =>
  dispatchTransfer(plan, asset, actor, "Sender", "2026-10-13T09:00:00+07:00");
describe("transfer execution evidence", () => {
  it("uses a database destination snapshot for dispatch and physical receipt", () => {
    const databasePlan = {
      ...plan,
      destinationId: "70000000-0000-4000-8000-000000000101",
      destinationSnapshot: {
        id: "70000000-0000-4000-8000-000000000101",
        type: "Vendor warehouse" as const,
        name: "Ofsorts — Jakarta",
        address: "Kapuk Kamal",
        city: "Jakarta",
        vendorId: "70000000-0000-4000-8000-000000000001",
        vendorName: "Ofsorts",
      },
    };
    const dispatched = dispatchTransfer(
      databasePlan,
      asset,
      actor,
      "Sender",
      "2026-10-13T09:00:00+07:00",
    );
    const received = receiveTransfer(
      dispatched,
      actor,
      "Laura",
      "Good",
      "2026-10-13T10:00:00+07:00",
    );
    expect(applyTransferReceipt(asset, received)).toMatchObject({
      location: "Ofsorts — Jakarta",
      locationType: "Vendor warehouse",
      currentCustodian: "Laura",
    });
  });

  it("requires a plan source that still matches and operationally clear assets", () => {
    expect(() =>
      dispatchTransfer(
        plan,
        { ...asset, location: "Moved elsewhere" },
        actor,
        "Sender",
        "2026-10-13T09:00:00+07:00",
      ),
    ).toThrow(/moved/);
    expect(() =>
      dispatchTransfer(
        plan,
        { ...asset, availability: "in-use" },
        actor,
        "Sender",
        "2026-10-13T09:00:00+07:00",
      ),
    ).toThrow(/clearance/);
    expect(() =>
      dispatchTransfer(
        plan,
        { ...asset, locationType: "Event venue" },
        actor,
        "Sender",
        "2026-10-13T09:00:00+07:00",
      ),
    ).toThrow(/booking/);
  });
  it("requires dispatch before receipt and only receipt updates location and custody", () => {
    expect(() =>
      receiveTransfer(
        plan,
        actor,
        "Receiver",
        "Good",
        "2026-10-13T10:00:00+07:00",
      ),
    ).toThrow(/dispatch/);
    const dispatched = send();
    expect(dispatched.receiverPic).toBeUndefined();
    expect(() => applyTransferReceipt(asset, dispatched)).toThrow(/receipt/);
    const receipt = receiveTransfer(
      dispatched,
      actor,
      "Actual receiver",
      "Fair",
      "2026-10-13T10:00:00+07:00",
    );
    const moved = applyTransferReceipt(asset, receipt);
    expect(moved.location).toBe("Cakung Production Workshop");
    expect(moved.currentCustodian).toBe("Actual receiver");
    expect(moved.condition).toBe("Fair");
    expect(moved.availability).toBe(asset.availability);
  });
  it("blocks duplicate or reversed confirmations and holds assets needing review", () => {
    const dispatched = send();
    expect(() =>
      dispatchTransfer(
        dispatched,
        asset,
        actor,
        "Sender",
        "2026-10-13T10:00:00+07:00",
      ),
    ).toThrow(/already/);
    expect(() =>
      receiveTransfer(
        dispatched,
        actor,
        "Receiver",
        "Good",
        "2026-10-13T08:00:00+07:00",
      ),
    ).toThrow(/precede/);
    const receipt = receiveTransfer(
      dispatched,
      actor,
      "Receiver",
      "Needs review",
      "2026-10-13T10:00:00+07:00",
    );
    expect(() =>
      receiveTransfer(
        receipt,
        actor,
        "Receiver",
        "Good",
        "2026-10-13T11:00:00+07:00",
      ),
    ).toThrow(/twice/);
    expect(applyTransferReceipt(asset, receipt).inspectionState).toBe(
      "On hold",
    );
  });
});
