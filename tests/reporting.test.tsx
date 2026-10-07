import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ReactNode } from "react";

import { PrototypeProvider, usePrototype } from "@/features/prototype/prototype-provider";
import { authoritativeOccurrence, deriveOperationalReport, filterOperationalReport, reportCsv, validateReportDateRange, type ReportInput } from "@/lib/domain/reporting";
import { prototypeAssets, prototypeRequests, prototypeReturnReceipts, prototypeWbsReferences } from "@/lib/fixtures/prototype-data";
import { activationEvents } from "@/lib/fixtures/activation-events";
import { peopleFixtures } from "@/lib/fixtures/people";
import type { MaintenanceRecord } from "@/types/prototype";

const request = { ...prototypeRequests.find((item) => item.id === "REQ-2026-018")!, status: "Pending approval" as const, submittedByUserId: "dev-user", submittedAt: "Today", reviewHistory: [{ id: "submit-event", cycle: 1, timestamp: "2026-10-01T09:12:00+07:00", action: "Submitted" as const, actorUserId: "dev-user", actorNameSnapshot: "Raihan Pradana" }] };
const maintenance: MaintenanceRecord = {
  id: "MNT-REPORT", assetId: "emina-play-modular", reason: "Panel repair", status: "Accepted", sourceRequestId: request.id, sourceRequestItemId: request.items[0].id, vendorId: "vendor-prima", beforePhotoIds: [], afterPhotoIds: [], conditionBefore: "Good", availabilityBefore: "available", createdAt: "2026-10-04T09:00:00+07:00", createdBy: "Raihan Pradana", assignedAt: "2026-10-04T10:00:00+07:00", assignedBy: "Raihan Pradana", workStartedAt: "2026-10-04T11:00:00+07:00", workCompletedAt: "2026-10-05T16:00:00+07:00", workCompletedBy: "Vendor rep", acceptedAt: "2026-10-06T10:00:00+07:00", acceptedBy: "Raihan Pradana", updatedAt: "2026-10-06T10:00:00+07:00", activity: [
    { at: "2026-10-06T10:00:00+07:00", title: "Maintenance accepted", detail: "Raihan Pradana" },
    { at: "2026-10-05T16:00:00+07:00", title: "Vendor work completed", detail: "Vendor rep" },
    { at: "2026-10-04T11:00:00+07:00", title: "Work started", detail: "Vendor Prima" },
    { at: "2026-10-04T10:00:00+07:00", title: "Vendor assigned", detail: "Vendor Prima" },
    { at: "2026-10-04T09:00:00+07:00", title: "Maintenance created", detail: "Raihan Pradana" },
  ],
};
const data: ReportInput = {
  requests: [request, prototypeRequests.find((item) => item.id === "REQ-2026-004")!, prototypeRequests.find((item) => item.id === "REQ-2026-021")!],
  assets: prototypeAssets, events: activationEvents, people: peopleFixtures, wbsReferences: prototypeWbsReferences,
  financialReferences: [
    { id: "fin-pr", ownerType: "REQUEST", ownerId: request.id, type: "PR", value: "PR-100", createdAt: "2026-10-02T09:00:00+07:00", createdByUserId: "dev-user" },
    { id: "fin-po", ownerType: "MAINTENANCE", ownerId: maintenance.id, type: "PO", value: "PO-200", createdAt: "2026-10-04T09:00:00+07:00", createdByUserId: "dev-user" },
    { id: "fin-invoice", ownerType: "MAINTENANCE", ownerId: maintenance.id, type: "INVOICE", value: "INV-300", createdAt: "2026-10-04T09:00:00+07:00", createdByUserId: "dev-user" },
  ],
  approvalAssignments: [{ id: "review-report", requestId: request.id, cycle: 1, decision: "Approved", decidedAt: "2026-10-02T11:20:00+07:00", decidedByUserId: "user-storedev" }],
  transferPlans: [{ id: "transfer-report", assetId: "emina-play-modular", destinationId: "warehouse-jakarta-hub", responsibleParty: "Receiver", condition: "Good", evidenceViews: ["Front", "Left side", "Detail"], notes: "", submittedAt: "2026-10-03T08:00:00+07:00" }],
  returnReceipts: [{ ...prototypeReturnReceipts[0], requestId: request.id, requestItemId: request.items[0].id, assetId: "emina-play-modular" }],
  maintenanceRecords: [maintenance], auditEvents: [],
};

describe("operational report projection", () => {
  it("derives business events from canonical sources, sorted newest first", () => {
    const rows = deriveOperationalReport(data);
    expect(rows.map((row) => row.type)).toContain("Request submitted");
    expect(rows.map((row) => row.type)).toContain("Request approved");
    expect(rows.map((row) => row.type)).toContain("Transfer planned");
    expect(rows.map((row) => row.type)).toContain("Return received");
    expect(rows.map((row) => row.type)).toContain("Vendor work completed");
    expect(rows.map((row) => row.type)).toContain("Maintenance accepted");
    expect(rows.findIndex((row) => row.type === "Maintenance accepted")).toBeLessThan(rows.findIndex((row) => row.type === "Vendor work completed"));
    expect(rows.some((row) => row.type === "Transfer received")).toBe(false);
    expect(rows.some((row) => row.requestId === "REQ-2026-004" && row.type === "Return received")).toBe(false);
    expect(rows.some((row) => row.requestId === "REQ-2026-021" && row.type === "Request submitted")).toBe(false);
  });

  it("requires a bounded valid occurrence range and preserves date-only legacy precision", () => {
    expect(() => validateReportDateRange("", "2026-10-31")).toThrow();
    expect(() => validateReportDateRange("2026-11-01", "2026-10-31")).toThrow();
    expect(authoritativeOccurrence("01 Oct 2026")).toBe("2026-10-01");
    expect(authoritativeOccurrence("Today")).toBeUndefined();
    expect(authoritativeOccurrence("2026-02-31")).toBeUndefined();
    expect(authoritativeOccurrence("2026-02-31T10:00:00+07:00")).toBeUndefined();
    expect(filterOperationalReport(deriveOperationalReport(data), { from: "2026-10-05", to: "2026-10-06" }).map((row) => row.type)).toEqual(["Maintenance accepted", "Vendor work completed"]);
  });

  it("filters a registered Event by canonical ID and an ad-hoc Custom Booth by activity context without a fake Asset", () => {
    const registered = prototypeRequests.find((item) => item.id === "REQ-2026-022")!;
    const adHoc = { ...prototypeRequests.find((item) => item.id === "REQ-2026-021")!, status: "Pending approval" as const };
    const rows = deriveOperationalReport({ ...data, requests: [registered, adHoc] });
    const registeredRows = filterOperationalReport(rows, { from: "2026-10-01", to: "2026-10-01", eventKey: "EVT-WRD-030" });
    expect(registeredRows).toHaveLength(1);
    expect(registeredRows[0]).toMatchObject({ eventKey: "EVT-WRD-030", requestId: registered.id });
    const adHocRows = filterOperationalReport(rows, { from: "2026-08-12", to: "2026-08-12", eventKey: `activity:${adHoc.id}` });
    expect(adHocRows).toHaveLength(1);
    expect(adHocRows[0]).toMatchObject({ requestId: adHoc.id, assetIds: [] });
    expect(rows.some((row) => row.requestId === adHoc.id && ["Transfer", "Return", "Inspection"].includes(row.category))).toBe(false);
  });

  it("intersects Brand, activity, Request, Asset, Vendor, WBS, type, status, and reference filters", () => {
    const rows = deriveOperationalReport(data);
    const common = { from: "2026-10-01", to: "2026-10-31", brandId: "EMN", requestId: request.id, assetId: "emina-play-modular", wbsReferenceId: "wbs-activity-alpha" };
    expect(filterOperationalReport(rows, common).length).toBeGreaterThan(1);
    expect(filterOperationalReport(rows, { ...common, vendorId: "vendor-prima", category: "Maintenance", status: "Maintenance accepted", referenceQuery: "INV-300" })).toHaveLength(1);
    expect(filterOperationalReport(rows, { ...common, vendorId: "vendor-karya" })).toHaveLength(0);
    expect(filterOperationalReport(rows, { ...common, eventKey: "activity:wrong" })).toHaveLength(0);
    expect(filterOperationalReport(rows, { ...common, wbsReferenceId: "wbs-activity-beta" }).length).toBeGreaterThan(0);
    expect(filterOperationalReport(rows, { ...common, search: "PO-200" }, data.wbsReferences, data.assets).length).toBeGreaterThan(0);
  });

  it("exports only passed filtered rows with readable values", () => {
    const rows = filterOperationalReport(deriveOperationalReport(data), { from: "2026-10-06", to: "2026-10-06" });
    const csv = reportCsv(rows, data);
    expect(csv).toContain("Maintenance accepted");
    expect(csv).toContain("PO-200");
    expect(csv).not.toContain("Request submitted");
  });
});

const wrapper = ({ children }: { children: ReactNode }) => <PrototypeProvider>{children}</PrototypeProvider>;

describe("manual financial reference mutations", () => {
  it("supports multiple PR, PO, and Invoice references with add/edit/remove audit and no validation state", () => {
    const { result } = renderHook(() => usePrototype(), { wrapper });
    const ownerId = "REQ-2026-022";
    expect(() => result.current.addFinancialReference("REQUEST", ownerId, "PR", " ")).toThrow(/reference number/);
    let id = "";
    act(() => { id = result.current.addFinancialReference("REQUEST", ownerId, "PR", " PR-001 ").id; });
    act(() => { result.current.addFinancialReference("REQUEST", ownerId, "PR", "PR-002"); result.current.addFinancialReference("REQUEST", ownerId, "PO", "PO-123"); result.current.addFinancialReference("REQUEST", ownerId, "INVOICE", "INV-456"); });
    expect(result.current.financialReferences).toHaveLength(4);
    expect(result.current.financialReferences[0]).toMatchObject({ value: "PR-001", createdByUserId: "dev-user" });
    expect(result.current.financialReferences[0]).not.toHaveProperty("verified");
    expect(result.current.auditEvents[0].action).toBe("FINANCIAL_REFERENCE_ADDED");
    act(() => result.current.updateFinancialReference(id, "PR-EDIT"));
    expect(result.current.auditEvents[0]).toMatchObject({ action: "FINANCIAL_REFERENCE_UPDATED", actorUserId: "dev-user" });
    act(() => result.current.removeFinancialReference(id));
    expect(result.current.auditEvents[0].action).toBe("FINANCIAL_REFERENCE_REMOVED");
    expect(result.current.financialReferences).toHaveLength(3);
    act(() => result.current.setCurrentUserId("user-storedev"));
    expect(() => result.current.addFinancialReference("REQUEST", ownerId, "PO", "PO-999")).toThrow(/Super Admin/);
  });
});
