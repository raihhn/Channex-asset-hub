import { brandReferences } from "@/lib/fixtures/organization";
import { vendors } from "@/lib/fixtures/vendors";
import { getRegisteredLocation } from "@/lib/fixtures/registered-locations";
import type { AuditEvent, Person, TransferPlan } from "@/types/identity";
import type { ActivationEvent, Asset, FinancialReference, MaintenanceRecord, PrototypeRequest, ReturnReceipt, WbsReference } from "@/types/prototype";

export type ReportCategory = "Request" | "Approval" | "Transfer" | "Return" | "Inspection" | "Issue" | "Maintenance" | "Financial reference";
export type ReportReferenceNumbers = { PR: string[]; PO: string[]; INVOICE: string[] };

/** Read-only business projection. None of these rows owns an operational transition. */
export type ReportEntry = {
  id: string;
  occurredAt: string;
  category: ReportCategory;
  type: string;
  summary: string;
  status: string;
  sourceEntityType: string;
  sourceEntityId: string;
  requestId?: string;
  requestItemId?: string;
  assetIds: string[];
  eventKey?: string;
  eventName?: string;
  brandId?: string;
  vendorId?: string;
  wbsReferenceIds: string[];
  referenceNumbers: ReportReferenceNumbers;
  actorUserId?: string;
  actorName?: string;
  location?: string;
  maintenanceId?: string;
};

export type ReportInput = {
  requests: PrototypeRequest[];
  assets: Asset[];
  events: ActivationEvent[];
  people: Person[];
  wbsReferences: WbsReference[];
  financialReferences: FinancialReference[];
  approvalAssignments: Array<{ id: string; requestId: string; cycle: number; decision?: string; decidedAt?: string; decidedByUserId?: string; note?: string }>;
  transferPlans: TransferPlan[];
  returnReceipts: ReturnReceipt[];
  maintenanceRecords: MaintenanceRecord[];
  auditEvents: AuditEvent[];
};

export type ReportFilters = {
  from: string;
  to: string;
  brandId?: string;
  eventKey?: string;
  requestId?: string;
  assetId?: string;
  vendorId?: string;
  wbsReferenceId?: string;
  category?: ReportCategory;
  status?: string;
  referenceQuery?: string;
  search?: string;
};

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Preserve fixture date precision: an undated legacy string is never assigned an invented time. */
export function authoritativeOccurrence(value?: string): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return month >= 1 && month <= 12 && day >= 1 && day <= new Date(year, month, 0).getDate() ? value : undefined;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return authoritativeOccurrence(value.slice(0, 10)) && Number.isFinite(Date.parse(value)) ? value : undefined;
  const legacy = /^(\d{1,2}) ([A-Z][a-z]{2}) (\d{4})$/.exec(value);
  if (!legacy) return undefined;
  const month = months.indexOf(legacy[2]) + 1;
  const day = Number(legacy[1]);
  if (!month || day < 1 || day > new Date(Number(legacy[3]), month, 0).getDate()) return undefined;
  return `${legacy[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function canonicalBrandId(name?: string) {
  return brandReferences.find((brand) => brand.name === name)?.id;
}

function referenceNumbers(references: FinancialReference[]): ReportReferenceNumbers {
  return {
    PR: references.filter((item) => item.type === "PR").map((item) => item.value),
    PO: references.filter((item) => item.type === "PO").map((item) => item.value),
    INVOICE: references.filter((item) => item.type === "INVOICE").map((item) => item.value),
  };
}

export function deriveOperationalReport(input: ReportInput): ReportEntry[] {
  const rows: ReportEntry[] = [];
  const requestById = new Map(input.requests.map((request) => [request.id, request]));
  const assetById = new Map(input.assets.map((asset) => [asset.id, asset]));
  const eventById = new Map(input.events.map((event) => [event.id, event]));
  const personById = new Map(input.people.map((person) => [person.id, person]));
  const maintenanceById = new Map(input.maintenanceRecords.map((record) => [record.id, record]));
  const wbsById = new Set(input.wbsReferences.map((reference) => reference.id));

  const requestContext = (request?: PrototypeRequest) => {
    const event = request?.eventId ? eventById.get(request.eventId) : undefined;
    const firstAsset = request?.items.length ? assetById.get(request.items[0].assetId) : undefined;
    const refs = input.financialReferences.filter((item) => item.ownerType === "REQUEST" && item.ownerId === request?.id);
    return {
      requestId: request?.id,
      assetIds: request?.items.map((item) => item.assetId).filter((id) => assetById.has(id)) ?? [],
      eventKey: event?.id ?? (request?.eventMode === "Ad-hoc Event" || request?.usageType === "Ad-hoc" ? `activity:${request.id}` : undefined),
      eventName: event?.name ?? request?.activityName ?? request?.projectName ?? request?.purpose,
      brandId: canonicalBrandId(request?.brand ?? event?.brand ?? firstAsset?.brand),
      vendorId: request?.destinationVendorId,
      wbsReferenceIds: (request?.wbsReferenceIds ?? []).filter((id) => wbsById.has(id)),
      referenceNumbers: referenceNumbers(refs),
      location: request?.destination,
    };
  };
  const add = (row: ReportEntry) => { if (authoritativeOccurrence(row.occurredAt)) rows.push(row); };

  for (const request of input.requests) {
    const context = requestContext(request);
    const history = request.reviewHistory?.filter((item) => item.action === "Submitted" || item.action === "Resubmitted") ?? [];
    if (history.length) {
      for (const item of history) add({ ...context, id: `request:${item.id}`, occurredAt: item.timestamp, category: "Request", type: item.action === "Resubmitted" ? "Request resubmitted" : "Request submitted", summary: request.projectName ?? request.purpose, status: "Pending review", sourceEntityType: "REQUEST", sourceEntityId: request.id, actorUserId: item.actorUserId, actorName: item.actorNameSnapshot });
    } else if (request.status !== "Draft") {
      const occurredAt = authoritativeOccurrence(request.submittedAt);
      if (occurredAt) add({ ...context, id: `request:legacy:${request.id}`, occurredAt, category: "Request", type: "Request submitted", summary: request.projectName ?? request.purpose, status: "Recorded", sourceEntityType: "REQUEST", sourceEntityId: request.id });
    }
  }

  for (const assignment of input.approvalAssignments) {
    if (!assignment.decision || !assignment.decidedAt) continue;
    const request = requestById.get(assignment.requestId);
    const actor = personById.get(assignment.decidedByUserId ?? "");
    const snapshot = request?.reviewHistory?.find((item) => item.assignmentId === assignment.id && item.action === assignment.decision)?.actorNameSnapshot;
    add({ ...requestContext(request), id: `review:${assignment.id}`, occurredAt: assignment.decidedAt, category: "Approval", type: assignment.decision === "Needs update" ? "Needs update" : `Request ${assignment.decision.toLowerCase()}`, summary: assignment.note || request?.projectName || assignment.requestId, status: assignment.decision, sourceEntityType: "APPROVAL_ASSIGNMENT", sourceEntityId: assignment.id, actorUserId: assignment.decidedByUserId, actorName: snapshot ?? actor?.name });
  }

  for (const plan of input.transferPlans) {
    const asset = assetById.get(plan.assetId);
    add({ id: `transfer:${plan.id}`, occurredAt: plan.submittedAt, category: "Transfer", type: "Transfer planned", summary: `${asset?.name ?? plan.assetId} · handover plan submitted`, status: "Planned only", sourceEntityType: "TRANSFER_PLAN", sourceEntityId: plan.id, assetIds: asset ? [asset.id] : [], brandId: canonicalBrandId(asset?.brand), wbsReferenceIds: [], referenceNumbers: referenceNumbers([]), location: getRegisteredLocation(plan.destinationId)?.name ?? plan.destinationId });
  }

  for (const receipt of input.returnReceipts) {
    const request = requestById.get(receipt.requestId);
    const context = requestContext(request);
    const asset = assetById.get(receipt.assetId);
    const base = { ...context, requestItemId: receipt.requestItemId, assetIds: asset ? [asset.id] : [], sourceEntityType: "RETURN_RECEIPT", sourceEntityId: receipt.id };
    add({ ...base, id: `return:start:${receipt.id}`, occurredAt: receipt.initiatedAt, category: "Return", type: "Return started", summary: `${asset?.name ?? receipt.assetId} · initiated by ${receipt.initiatedBy}`, status: "Awaiting receipt" });
    if (receipt.receivedAt) add({ ...base, id: `return:received:${receipt.id}`, occurredAt: receipt.receivedAt, category: "Return", type: "Return received", summary: `${asset?.name ?? receipt.assetId} · confirmed at ${getRegisteredLocation(receipt.receivingLocationId)?.name ?? receipt.receivingLocationId ?? "registered location"} by ${receipt.receivedBy ?? "receiver"}`, status: "Received", location: getRegisteredLocation(receipt.receivingLocationId)?.name ?? receipt.receivingLocationId });
    if (receipt.inspectedAt && receipt.inspectionOutcome) add({ ...base, id: `inspection:${receipt.id}`, occurredAt: receipt.inspectedAt, category: "Inspection", type: "Return inspected", summary: `${asset?.name ?? receipt.assetId} · ${receipt.inspectionOutcome}`, status: receipt.inspectionOutcome });
  }

  for (const record of input.maintenanceRecords) {
    const asset = assetById.get(record.assetId);
    const request = requestById.get(record.sourceRequestId ?? "");
    const context = requestContext(request);
    const ownRefs = input.financialReferences.filter((item) => item.ownerType === "MAINTENANCE" && item.ownerId === record.id);
    const combinedRefs = { PR: [...context.referenceNumbers.PR, ...referenceNumbers(ownRefs).PR], PO: [...context.referenceNumbers.PO, ...referenceNumbers(ownRefs).PO], INVOICE: [...context.referenceNumbers.INVOICE, ...referenceNumbers(ownRefs).INVOICE] };
    for (const [index, activity] of record.activity.entries()) {
      const significant: Record<string, string> = { "Maintenance created": "Maintenance created", "Vendor assigned": "Vendor assigned", "Work started": "Vendor work started", "Vendor work completed": "Vendor work completed", "Maintenance accepted": "Maintenance accepted", "Maintenance sent back": "Maintenance sent back", "Rework started": "Rework started", "Maintenance cancelled": "Maintenance cancelled" };
      const type = significant[activity.title];
      if (!type) continue;
      const assignedVendorId = activity.title === "Vendor assigned" ? vendors.find((vendor) => vendor.name === activity.detail)?.id : record.vendorId;
      add({ ...context, id: `maintenance:${record.id}:${index}:${activity.at}`, occurredAt: activity.at, category: "Maintenance", type, summary: `${asset?.name ?? record.assetId} · ${activity.detail}`, status: type, sourceEntityType: "MAINTENANCE", sourceEntityId: record.id, maintenanceId: record.id, assetIds: asset ? [asset.id] : [], brandId: context.brandId ?? canonicalBrandId(asset?.brand), vendorId: assignedVendorId, referenceNumbers: combinedRefs, actorName: activity.title === "Maintenance created" || activity.title === "Maintenance accepted" ? activity.detail : undefined });
    }
  }

  for (const audit of input.auditEvents) {
    if (audit.action !== "ISSUE_CREATED" && !(audit.action === "STATUS_CHANGE" && audit.entityType === "ISSUE") && !audit.action.startsWith("FINANCIAL_REFERENCE_")) continue;
    const maintenance = maintenanceById.get(audit.related?.maintenanceId ?? "");
    const request = requestById.get(audit.related?.requestId ?? maintenance?.sourceRequestId ?? "");
    const context = requestContext(request);
    const assetId = audit.related?.assetId ?? maintenance?.assetId;
    const asset = assetById.get(assetId ?? "");
    const refType = audit.changes?.find((change) => change.field === "type")?.after;
    const refValue = audit.changes?.find((change) => change.field === "value");
    const isFinancial = audit.action.startsWith("FINANCIAL_REFERENCE_");
    const actionLabel = audit.action === "FINANCIAL_REFERENCE_ADDED" ? "added" : audit.action === "FINANCIAL_REFERENCE_UPDATED" ? "updated" : "removed";
    add({ ...context, id: `audit-business:${audit.id}`, occurredAt: audit.timestamp, category: isFinancial ? "Financial reference" : "Issue", type: isFinancial ? `${refType ?? "Financial"} Number ${actionLabel}` : audit.action === "ISSUE_CREATED" ? "Issue reported" : "Issue resolved", summary: isFinancial ? `${refType ?? "Reference"} ${refValue?.after || refValue?.before || ""} · ${audit.summary}` : audit.summary, status: isFinancial ? "Manual · unverified" : audit.action === "ISSUE_CREATED" ? "Open" : "Resolved", sourceEntityType: audit.entityType, sourceEntityId: audit.entityId, assetIds: asset ? [asset.id] : context.assetIds, brandId: context.brandId ?? canonicalBrandId(asset?.brand), vendorId: maintenance?.vendorId ?? context.vendorId, maintenanceId: maintenance?.id, actorUserId: audit.actorUserId, actorName: audit.actorNameSnapshot, referenceNumbers: isFinancial && refType && refValue ? { ...context.referenceNumbers, [refType]: [refValue.after || refValue.before] } : context.referenceNumbers });
  }

  return rows.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || a.id.localeCompare(b.id));
}

export function validateReportDateRange(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || !authoritativeOccurrence(from) || !authoritativeOccurrence(to)) throw new Error("Choose both From Date and To Date.");
  if (from > to) throw new Error("From Date must be on or before To Date.");
}

export function filterOperationalReport(entries: ReportEntry[], filters: ReportFilters, wbsReferences: WbsReference[] = [], assets: Asset[] = []): ReportEntry[] {
  validateReportDateRange(filters.from, filters.to);
  const needle = filters.search?.trim().toLocaleLowerCase() ?? "";
  const referenceNeedle = filters.referenceQuery?.trim().toLocaleLowerCase() ?? "";
  const wbsById = new Map(wbsReferences.map((item) => [item.id, item.code]));
  const assetById = new Map(assets.map((item) => [item.id, item.name]));
  return entries.filter((entry) => {
    if (entry.occurredAt.slice(0, 10) < filters.from || entry.occurredAt.slice(0, 10) > filters.to) return false;
    if (filters.brandId && entry.brandId !== filters.brandId) return false;
    if (filters.eventKey && entry.eventKey !== filters.eventKey) return false;
    if (filters.requestId && entry.requestId !== filters.requestId) return false;
    if (filters.assetId && !entry.assetIds.includes(filters.assetId)) return false;
    if (filters.vendorId && entry.vendorId !== filters.vendorId) return false;
    if (filters.wbsReferenceId && !entry.wbsReferenceIds.includes(filters.wbsReferenceId)) return false;
    if (filters.category && entry.category !== filters.category) return false;
    if (filters.status && entry.status !== filters.status) return false;
    const referenceValues = [...entry.referenceNumbers.PR, ...entry.referenceNumbers.PO, ...entry.referenceNumbers.INVOICE];
    if (referenceNeedle && !referenceValues.some((value) => value.toLocaleLowerCase().includes(referenceNeedle))) return false;
    if (needle && ![entry.summary, entry.type, entry.requestId, entry.eventName, ...entry.assetIds, ...entry.assetIds.map((id) => assetById.get(id)), entry.vendorId, vendors.find((vendor) => vendor.id === entry.vendorId)?.name, ...entry.wbsReferenceIds.map((id) => wbsById.get(id)), ...referenceValues].filter(Boolean).some((value) => value!.toLocaleLowerCase().includes(needle))) return false;
    return true;
  });
}

function csvCell(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function reportCsv(entries: ReportEntry[], input: Pick<ReportInput, "assets" | "events" | "wbsReferences">) {
  const assetById = new Map(input.assets.map((asset) => [asset.id, asset]));
  const brandById = new Map<string, string>(brandReferences.map((brand) => [brand.id, brand.name]));
  const vendorById = new Map<string, string>(vendors.map((vendor) => [vendor.id, vendor.name]));
  const wbsById = new Map(input.wbsReferences.map((reference) => [reference.id, reference.code]));
  const headings = ["Occurred At", "Type", "Description", "Brand", "Event / Activity", "Request ID", "Asset", "Vendor", "WBS", "PR", "PO", "Invoice", "Status", "Actor"];
  const lines = entries.map((entry) => [entry.occurredAt, entry.type, entry.summary, brandById.get(entry.brandId ?? "") ?? "", entry.eventName ?? "", entry.requestId ?? "", entry.assetIds.map((id) => assetById.get(id)?.name ?? id).join(" | "), vendorById.get(entry.vendorId ?? "") ?? "", entry.wbsReferenceIds.map((id) => wbsById.get(id) ?? id).join(" | "), entry.referenceNumbers.PR.join(" | "), entry.referenceNumbers.PO.join(" | "), entry.referenceNumbers.INVOICE.join(" | "), entry.status, entry.actorName ?? ""].map(csvCell).join(","));
  return [headings.map(csvCell).join(","), ...lines].join("\r\n") + "\r\n";
}
