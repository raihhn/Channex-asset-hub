import { describe, expect, it } from "vitest";

import { prototypeAssets, prototypeRequests, prototypeReturnReceipts } from "@/lib/fixtures/prototype-data";
import {
  acceptMaintenance, addMaintenancePhoto, applyActiveMaintenanceToAsset,
  assignMaintenanceVendor, cancelMaintenance, completeVendorWork,
  createMaintenanceRecord, holdMaintenance, resumeMaintenance, startMaintenanceWork,
} from "@/lib/domain/maintenance";
import { isOperationallySelectable } from "@/lib/fixtures/request-eligibility";
import type { Asset, AssetPhoto } from "@/types/prototype";

const at = "2026-10-07T10:00:00+07:00";
const physical = prototypeAssets.find((item) => item.id === "wardah-glow-pavilion")!;
const photo = (id: string, purpose: "Before" | "After", maintenanceId: string): AssetPhoto => ({
  id, view: "Detail", required: true, caption: `${purpose} view`, mimeType: "image/png",
  dataUrl: "data:image/png;base64,aGVsbG8=", maintenancePurpose: purpose, maintenanceId,
});

function setup(asset: Asset = physical) {
  const draft = createMaintenanceRecord([], asset, { reason: "Repair surface" }, "Raihan", at);
  const assigned = assignMaintenanceVendor(draft, "vendor-prima", "Raihan", at);
  const before = photo("before-1", "Before", draft.id);
  const withBefore = addMaintenancePhoto(assigned, before, at);
  const started = startMaintenanceWork(withBefore, [before], at);
  const after = photo("after-1", "After", draft.id);
  const withAfter = addMaintenancePhoto(started, after, at);
  const completed = completeVendorWork(withAfter, [before, after], "Vendor representative", at);
  return { draft, assigned, before, withBefore, started, after, withAfter, completed };
}

describe("Maintenance workflow", () => {
  it("creates one record for one physical Asset, retains history, and blocks a duplicate active record", () => {
    const { draft } = setup();
    expect(draft.assetId).toBe(physical.id);
    expect(draft.status).toBe("Draft");
    expect(() => createMaintenanceRecord([draft], physical, { reason: "Again" }, "Raihan", at)).toThrow(/already has active/);
    const accepted = acceptMaintenance(setup().completed, physical, { conditionAfter: "Good", resolveLinkedIssue: false, clearInspection: false }, "Reviewer", at);
    expect(createMaintenanceRecord([accepted.record], accepted.asset, { reason: "Later work" }, "Raihan", at).status).toBe("Draft");
  });

  it("requires reason or a valid linked Issue and rejects unknown Vendor", () => {
    expect(() => createMaintenanceRecord([], physical, { reason: "" }, "Raihan", at)).toThrow(/reason or link/);
    expect(() => createMaintenanceRecord([], physical, { reason: "Repair", issueId: "wrong" }, "Raihan", at)).toThrow(/does not belong/);
    expect(() => assignMaintenanceVendor(setup().draft, "unknown", "Raihan", at)).toThrow(/registered Vendor/);
  });

  it("prevents work start without Vendor and actual linked Before Photo", () => {
    const { draft, assigned, before, withBefore } = setup();
    expect(() => startMaintenanceWork(draft, [before], at)).toThrow(/Assign a Vendor/);
    expect(() => startMaintenanceWork(assigned, [], at)).toThrow(/Before Photo/);
    expect(() => startMaintenanceWork(withBefore, [photo("wrong", "Before", draft.id)], at)).toThrow(/Before Photo/);
    expect(startMaintenanceWork(withBefore, [before], at).status).toBe("In progress");
  });

  it("requires valid image evidence and After Photo before work completion", () => {
    const { draft, started, after, withAfter } = setup();
    expect(() => addMaintenancePhoto(started, { ...after, dataUrl: undefined }, at)).toThrow(/valid image/);
    expect(() => completeVendorWork(started, [], "Vendor", at)).toThrow(/After Photo/);
    expect(() => completeVendorWork(withAfter, [after], "", at)).toThrow(/who reported/);
    expect(completeVendorWork(withAfter, [after], "Vendor", at).status).toBe("Work completed");
    expect(() => addMaintenancePhoto(draft, after, at)).toThrow(/After Photo belongs/);
  });

  it("keeps Asset unavailable after Vendor completion; internal acceptance is separate", () => {
    const { completed } = setup();
    const blocked = applyActiveMaintenanceToAsset(physical, completed);
    expect(blocked.availability).toBe("maintenance");
    expect(isOperationallySelectable(blocked)).toBe(false);
    const result = acceptMaintenance(completed, blocked, { conditionAfter: "Good", resolveLinkedIssue: false, clearInspection: false }, "Internal reviewer", at);
    expect(result.record.status).toBe("Accepted");
    expect(result.record.acceptedBy).toBe("Internal reviewer");
    expect(result.asset.availability).toBe("available");
  });

  it("supports send-back and requires fresh After Photo for rework", () => {
    const { completed, before } = setup();
    const held = holdMaintenance(completed, "Poor finish", at);
    expect(held.status).toBe("On hold");
    expect(() => acceptMaintenance(held, physical, { conditionAfter: "Good", resolveLinkedIssue: false, clearInspection: false }, "Raihan", at)).toThrow(/Vendor work must be completed/);
    const resumed = resumeMaintenance(held, at);
    expect(resumed.afterPhotoIds).toEqual([]);
    expect(() => completeVendorWork(resumed, [before], "Vendor", at)).toThrow(/After Photo/);
  });

  it("cancellation retains a blocked Asset and history", () => {
    const { draft } = setup();
    expect(() => cancelMaintenance(draft, "", at)).toThrow(/why/);
    const cancelled = cancelMaintenance(draft, "Not repairable", at);
    expect(cancelled.status).toBe("Cancelled");
    expect(cancelled.activity[0].title).toBe("Maintenance cancelled");
  });

  it("does not resolve unrelated Issues or clear inspection without explicit action", () => {
    const { completed } = setup();
    const asset: Asset = { ...physical, inspectionState: "On hold", issues: [
      { id: "issue-linked", type: "Damage", severity: "High", area: "Front", notes: "A", status: "Open", blocksUsage: true },
      { id: "issue-other", type: "Damage", severity: "High", area: "Side", notes: "B", status: "Open", blocksUsage: true },
    ] };
    const linked = { ...completed, issueId: "issue-linked" };
    const result = acceptMaintenance(linked, asset, { conditionAfter: "Good", resolveLinkedIssue: true, clearInspection: false }, "Reviewer", at);
    expect(result.asset.issues[0].status).toBe("Resolved");
    expect(result.asset.issues[1].status).toBe("Open");
    expect(result.asset.inspectionState).toBe("On hold");
    expect(result.asset.availability).toBe("unavailable");
  });

  it("requires confirmed receipt for Return-linked Maintenance and rejects mismatched linkage", () => {
    const request = prototypeRequests.find((item) => item.id === "REQ-2026-030")!;
    const asset = prototypeAssets.find((item) => item.id === "return-demo-pavilion")!;
    const item = request.items.find((entry) => entry.assetId === asset.id)!;
    const receipt = prototypeReturnReceipts.find((entry) => entry.requestItemId === item.id)!;
    expect(createMaintenanceRecord([], asset, { reason: "Inspect", sourceRequestId: request.id, sourceRequestItemId: item.id }, "Raihan", at, request, receipt).sourceRequestItemId).toBe(item.id);
    expect(() => createMaintenanceRecord([], asset, { reason: "Inspect", sourceRequestId: request.id, sourceRequestItemId: item.id }, "Raihan", at, request)).toThrow(/confirmed receipt/);
  });
});
