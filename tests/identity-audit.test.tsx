import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";

import { PrototypeProvider, usePrototype } from "@/features/prototype/prototype-provider";
import { createAuditEvent } from "@/lib/domain/audit";
import { roleLabels, scopeWarnings, userHasRole, userVendor, validatePersonDraft } from "@/lib/domain/people";
import { areas, brandReferences, categoryReferences, distributionCenters } from "@/lib/fixtures/organization";
import { peopleFixtures } from "@/lib/fixtures/people";
import { registeredLocations } from "@/lib/fixtures/registered-locations";
import type { PersonDraft } from "@/types/identity";

const wrapper = ({ children }: { children: ReactNode }) => <PrototypeProvider>{children}</PrototypeProvider>;
const draft: PersonDraft = { name: "New Operator", email: "new.operator@example.com", roles: ["REQUESTER", "STORE_DEV"], status: "ACTIVE", brandIds: ["WRD", "KHF"], categoryIds: ["BOOTH", "POSM"], areaIds: ["area-jabodetabek"], dcIds: ["dc-jakarta"] };

describe("canonical People and organizational scope", () => {
  it("allows multiple roles and StoreDev multi-Brand/category scope without routing", () => {
    validatePersonDraft(draft);
    expect(peopleFixtures.find((person) => person.id === "user-storedev")?.brandIds).toHaveLength(2);
    expect(peopleFixtures.find((person) => person.id === "user-storedev")?.categoryIds).toHaveLength(3);
    expect(roleLabels.STORE_DEV).toBe("StoreDev");
    expect(userHasRole(peopleFixtures[0], "SUPER_ADMIN")).toBe(true);
    expect(scopeWarnings({ ...draft, brandIds: [], categoryIds: [] })).toHaveLength(1);
  });

  it("requires registered Vendor and canonical scope IDs, but no corporate email domain", () => {
    expect(() => validatePersonDraft({ ...draft, name: "" })).toThrow(/Name/);
    expect(() => validatePersonDraft({ ...draft, roles: [] })).toThrow(/role/);
    expect(() => validatePersonDraft({ ...draft, roles: ["VENDOR"], vendorId: undefined })).toThrow(/registered Vendor/);
    expect(() => validatePersonDraft({ ...draft, brandIds: ["Other"] })).toThrow(/Brand scope/);
    expect(() => validatePersonDraft({ ...draft, categoryIds: ["Other"] })).toThrow(/Category scope/);
    expect(() => validatePersonDraft({ ...draft, areaIds: ["warehouse-jakarta-hub"] })).toThrow(/Area scope/);
    expect(() => validatePersonDraft({ ...draft, dcIds: ["warehouse-jakarta-hub"] })).toThrow(/DC scope/);
    expect(userVendor(peopleFixtures.find((person) => person.id === "user-vendor"))?.id).toBe("vendor-abc-production");
  });

  it("keeps DC/Area and HO concepts separate from physical Locations", () => {
    expect(areas.length).toBeGreaterThan(0);
    expect(distributionCenters.length).toBeGreaterThan(0);
    expect(distributionCenters.every((dc) => !registeredLocations.some((location) => location.id === dc.id))).toBe(true);
    expect(registeredLocations.some((location) => location.name === "Head Office")).toBe(false);
    expect(brandReferences.some((brand) => brand.id === draft.brandIds[0])).toBe(true);
    expect(categoryReferences.some((category) => category.id === draft.categoryIds[0])).toBe(true);
  });
});

describe("central prototype audit", () => {
  it("records User create, role/scope edit, and inactivation with canonical actor and immutable UI history", () => {
    const { result } = renderHook(() => usePrototype(), { wrapper });
    let id = "";
    act(() => { id = result.current.createPerson(draft).id; });
    expect(result.current.auditEvents[0]).toMatchObject({ actorUserId: "dev-user", actorNameSnapshot: "Raihan Pradana", entityType: "USER", entityId: id, action: "CREATE" });
    expect(Number.isFinite(Date.parse(result.current.auditEvents[0].timestamp))).toBe(true);
    act(() => result.current.updatePerson(id, { ...draft, roles: ["STORE_DEV", "BRAND"], brandIds: ["EMN"] }));
    expect(result.current.auditEvents[0].action).toBe("UPDATE");
    expect(result.current.auditEvents[0].changes?.map((change) => change.field)).toEqual(expect.arrayContaining(["roles", "brandIds"]));
    act(() => result.current.setPersonStatus(id, "INACTIVE"));
    expect(result.current.auditEvents[0].action).toBe("INACTIVATE");
    expect(result.current.people.find((person) => person.id === id)?.status).toBe("INACTIVE");
    expect(result.current.auditEvents[2].actorNameSnapshot).toBe("Raihan Pradana");
    expect(result.current.auditEvents).toHaveLength(3);
  });

  it("audits Return initiation and receipt while actual inbound remains receipt-driven", () => {
    const { result } = renderHook(() => usePrototype(), { wrapper });
    const itemId = "REQ-2026-009:item:1";
    act(() => result.current.startReturn("REQ-2026-009", itemId));
    expect(result.current.auditEvents[0]).toMatchObject({ action: "RETURN_STARTED", entityId: itemId, related: { requestId: "REQ-2026-009", requestItemId: itemId } });
    expect(result.current.returnReceipts.find((receipt) => receipt.requestItemId === itemId)?.receivedAt).toBeUndefined();
    act(() => result.current.confirmReceived("REQ-2026-009", itemId, { receivedBy: "Physical Receiver", receivingLocationId: "warehouse-jakarta-hub", conditionAtReceipt: "Good" }));
    expect(result.current.auditEvents[0]).toMatchObject({ action: "RETURN_RECEIVED", actorUserId: "dev-user", entityId: itemId, related: { assetId: "kahf-mountain-booth" } });
    expect(result.current.returnReceipts.find((receipt) => receipt.requestItemId === itemId)?.receivedAt).toBeDefined();
    expect(result.current.returnReceipts.find((receipt) => receipt.requestItemId === itemId)?.receivedBy).toBe("Physical Receiver");
  });

  it("audits Maintenance Vendor assignment, Work Completed, and Acceptance without storing media bytes", () => {
    const { result } = renderHook(() => usePrototype(), { wrapper });
    let id = "";
    act(() => { id = result.current.createMaintenance("wardah-glow-pavilion", { reason: "Repair" }).id; });
    act(() => result.current.assignMaintenanceVendor(id, "vendor-prima"));
    expect(result.current.auditEvents[0].action).toBe("VENDOR_ASSIGNED");
    const image = { dataUrl: "data:image/png;base64,aGVsbG8=", mimeType: "image/png", name: "before.png" };
    act(() => result.current.addMaintenanceEvidence(id, "Before", image));
    act(() => result.current.startMaintenanceWork(id));
    act(() => result.current.addMaintenanceEvidence(id, "After", { ...image, name: "after.png" }));
    act(() => result.current.completeVendorWork(id, "Vendor representative"));
    expect(result.current.auditEvents[0].action).toBe("WORK_COMPLETED");
    act(() => result.current.acceptMaintenance(id, { conditionAfter: "Good", resolveLinkedIssue: false, clearInspection: false }));
    expect(result.current.auditEvents[0]).toMatchObject({ action: "MAINTENANCE_ACCEPTED", actorUserId: "dev-user", entityId: id });
    expect(JSON.stringify(result.current.auditEvents)).not.toContain("data:image/png");
  });

  it("audits the existing Transfer submission as a plan, without moving the Asset or assigning actor as PIC", () => {
    const { result } = renderHook(() => usePrototype(), { wrapper });
    const before = result.current.assets.find((asset) => asset.id === "wardah-glow-pavilion")!.location;
    act(() => result.current.planTransfer({ assetId: "wardah-glow-pavilion", destinationId: "warehouse-jakarta-hub", responsibleParty: "Actual Receiver", condition: "Good", evidence: ["Front", "Left side", "Detail"], notes: "" }));
    expect(result.current.auditEvents[0]).toMatchObject({ action: "TRANSFER_PLANNED", actorUserId: "dev-user", entityType: "TRANSFER" });
    expect(result.current.transferPlans[0]).toMatchObject({ id: result.current.auditEvents[0].entityId, responsibleParty: "Actual Receiver" });
    expect(result.current.auditEvents[0].summary).toContain("Actual Receiver");
    expect(result.current.assets.find((asset) => asset.id === "wardah-glow-pavilion")!.location).toBe(before);
  });

  it("retains actor name snapshot when the person later becomes inactive", () => {
    const inactive = { ...peopleFixtures[0], status: "INACTIVE" as const, name: "Renamed User" };
    const event = createAuditEvent({ actor: peopleFixtures[0], action: "UPDATE", entityType: "USER", entityId: "user-brand", summary: "Changed scope", timestamp: "2026-10-07T10:00:00Z" });
    expect(event.actorUserId).toBe(inactive.id);
    expect(event.actorNameSnapshot).toBe("Raihan Pradana");
  });
});
