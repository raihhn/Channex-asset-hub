"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  prototypeAssets,
  prototypeRequests,
  prototypeReturnReceipts,
  prototypeWbsReferences,
} from "@/lib/fixtures/prototype-data";
import { uniqueWbsCodes } from "@/lib/domain/wbs-references";
import { normalizeGroupItemIds, preserveRequestItemIds } from "@/lib/domain/request-item-identity";
import { durableBookingEnabled, fetchDurableBookings, saveDurableBooking, saveDurableReview } from "@/lib/booking-client";
import { normalizeFinancialReferenceValue, validateFinancialReferenceEditor } from "@/lib/domain/financial-references";
import { isValidEventParent } from "@/lib/domain/events";
import { activationEvents } from "@/lib/fixtures/activation-events";
import { defaultCurrentUserId, peopleFixtures } from "@/lib/fixtures/people";
import { createAuditEvent, appendAuditEvent } from "@/lib/domain/audit";
import { activeReviewAssignment, appendReviewHistory, reviewCycle, reviewHistoryEntry, validateReviewDecision, validateReviewerAssignment } from "@/lib/domain/approvals";
import { personChanges, validatePersonDraft } from "@/lib/domain/people";
import { getRegisteredLocation } from "@/lib/fixtures/registered-locations";
import {
  applyInspectionToAsset,
  applyReceiptToAsset,
  completeReturnInspection,
  confirmReturnReceived,
  initiateReturn,
  type ConfirmReceiptInput,
} from "@/lib/domain/returns";
import {
  acceptMaintenance,
  addMaintenancePhoto,
  applyActiveMaintenanceToAsset,
  applyCancelledMaintenanceToAsset,
  assignMaintenanceVendor,
  cancelMaintenance,
  completeVendorWork,
  createMaintenanceRecord,
  holdMaintenance,
  resumeMaintenance,
  startMaintenanceWork,
  type MaintenanceAcceptance,
  type MaintenanceOrigin,
} from "@/lib/domain/maintenance";
import type {
  Asset,
  AssetIssue,
  IssueDraft,
  PrototypeRequest,
  PrototypeRole,
  RequestDraft,
  WbsReference,
  ActivationEvent,
  EventDraft,
  ReturnReceipt,
  MaintenanceRecord,
  ApprovalAssignment,
  ApprovalDecision,
  FinancialReference,
} from "@/types/prototype";
import type { AuditAction, AuditChange, AuditEntityType, AuditEvent, Person, PersonDraft, TransferPlan } from "@/types/identity";

type PrototypeContextValue = {
  people: Person[];
  currentUser: Person;
  setCurrentUserId: (id: string) => void;
  auditEvents: AuditEvent[];
  approvalAssignments: ApprovalAssignment[];
  financialReferences: FinancialReference[];
  addFinancialReference: (ownerType: FinancialReference["ownerType"], ownerId: string, type: FinancialReference["type"], value: string) => FinancialReference;
  updateFinancialReference: (id: string, value: string) => void;
  removeFinancialReference: (id: string) => void;
  transferPlans: TransferPlan[];
  createPerson: (draft: PersonDraft) => Person;
  updatePerson: (id: string, draft: PersonDraft) => void;
  setPersonStatus: (id: string, status: Person["status"]) => void;
  planTransfer: (input: { assetId: string; destinationId: string; responsibleParty: string; condition: Asset["condition"]; evidence: string[]; notes: string }) => TransferPlan;
  requests: PrototypeRequest[];
  assets: Asset[];
  wbsReferences: WbsReference[];
  events: ActivationEvent[];
  returnReceipts: ReturnReceipt[];
  maintenanceRecords: MaintenanceRecord[];
  createMaintenance: (assetId: string, origin: MaintenanceOrigin) => MaintenanceRecord;
  assignMaintenanceVendor: (maintenanceId: string, vendorId: string) => void;
  addMaintenanceEvidence: (maintenanceId: string, purpose: "Before" | "After", image: { dataUrl: string; mimeType: string; name: string }) => void;
  startMaintenanceWork: (maintenanceId: string) => void;
  completeVendorWork: (maintenanceId: string, reportedBy: string) => void;
  acceptMaintenance: (maintenanceId: string, input: MaintenanceAcceptance) => void;
  holdMaintenance: (maintenanceId: string, reason: string) => void;
  resumeMaintenance: (maintenanceId: string) => void;
  cancelMaintenance: (maintenanceId: string, reason: string) => void;
  startReturn: (requestId: string, requestItemId: string) => void;
  confirmReceived: (
    requestId: string,
    requestItemId: string,
    input: ConfirmReceiptInput,
  ) => void;
  completeInspection: (
    requestId: string,
    requestItemId: string,
    outcome: "Clear" | "On hold",
  ) => void;
  saveEvent: (draft: EventDraft) => boolean;
  createRequest: (draft: RequestDraft) => PrototypeRequest;
  savePersistedRequest: (draft: RequestDraft, revision?: PrototypeRequest, commandKey?: string) => Promise<PrototypeRequest>;
  bookingLoading: boolean;
  bookingError: string;
  assignRequestReviewer: (requestId: string, reviewerUserId: string) => ApprovalAssignment;
  decideRequestReview: (requestId: string, decision: ApprovalDecision, note: string) => void;
  savePersistedReview: (request: PrototypeRequest, command: { action: "assign"; reviewerId: string } | { action: "decide"; decision: ApprovalDecision; note: string }) => Promise<void>;
  resubmitRequest: (requestId: string, draft: RequestDraft) => PrototypeRequest;
  reportIssue: (assetId: string, draft: IssueDraft) => void;
  documentPhoto: (
    assetId: string,
    view: Asset["photos"][number]["view"],
  ) => void;
  role: PrototypeRole;
  setRole: (role: PrototypeRole) => void;
};

const PrototypeContext = createContext<PrototypeContextValue | null>(null);

export function PrototypeProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState(prototypeRequests);
  const [bookingLoading, setBookingLoading] = useState(durableBookingEnabled);
  const [bookingError, setBookingError] = useState("");
  const [assets, setAssets] = useState<Asset[]>(() =>
    prototypeReturnReceipts.reduce((current, receipt) => {
      const location = getRegisteredLocation(receipt.receivingLocationId);
      if (!receipt.receivedAt || !location) return current;
      return current.map((asset) => {
        if (asset.id !== receipt.assetId) return asset;
        const received = applyReceiptToAsset(asset, receipt, location);
        return receipt.inspectionOutcome && receipt.inspectedAt
          ? applyInspectionToAsset(
              received,
              receipt.inspectionOutcome,
              receipt.inspectedAt,
            )
          : received;
      });
    }, prototypeAssets),
  );
  const [returnReceipts, setReturnReceipts] = useState(prototypeReturnReceipts);
  const [maintenanceRecords, setMaintenanceRecords] = useState<MaintenanceRecord[]>([]);
  const [wbsReferences, setWbsReferences] = useState(prototypeWbsReferences);
  const [events, setEvents] = useState(activationEvents);
  const [role, setRole] = useState<PrototypeRole>("Requester");
  const [people, setPeople] = useState<Person[]>(peopleFixtures);
  const [currentUserId, setCurrentUserIdState] = useState(defaultCurrentUserId);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [approvalAssignments, setApprovalAssignments] = useState<ApprovalAssignment[]>([]);
  const [financialReferences, setFinancialReferences] = useState<FinancialReference[]>([]);
  const [transferPlans, setTransferPlans] = useState<TransferPlan[]>([]);
  const currentUser = people.find((person) => person.id === currentUserId) ?? people[0];

  useEffect(() => {
    if (!durableBookingEnabled) return;
    let active = true;
    fetchDurableBookings().then((loaded) => {
      if (!active) return;
      setRequests([...loaded.requests, ...prototypeRequests]);
      setWbsReferences([...loaded.wbsReferences, ...prototypeWbsReferences]);
      setApprovalAssignments(loaded.assignments);
      setAuditEvents(loaded.auditEvents);
      setBookingError("");
    }).catch((error: unknown) => {
      if (active) setBookingError(error instanceof Error ? error.message : "Could not load persisted Requests.");
    }).finally(() => { if (active) setBookingLoading(false); });
    return () => { active = false; };
  }, []);

  /** Store mutation authority owns business state and its compact audit event. */
  const audit = useCallback((action: AuditAction, entityType: AuditEntityType, entityId: string, summary: string, changes?: AuditChange[], related?: AuditEvent["related"]) => {
    const event = createAuditEvent({ actor: currentUser, action, entityType, entityId, summary, timestamp: new Date().toISOString(), changes, related });
    setAuditEvents((current) => appendAuditEvent(current, event));
  }, [currentUser]);

  const value = useMemo<PrototypeContextValue>(
    () => ({
      people,
      currentUser,
      setCurrentUserId: (id) => {
        const person = people.find((candidate) => candidate.id === id && candidate.status === "ACTIVE");
        if (!person) throw new Error("Choose an active prototype user.");
        setCurrentUserIdState(id);
      },
      auditEvents,
      approvalAssignments,
      financialReferences,
      addFinancialReference: (ownerType, ownerId, type, value) => {
        validateFinancialReferenceEditor(currentUser);
        if (ownerType === "REQUEST" ? !requests.some((item) => item.id === ownerId) : !maintenanceRecords.some((item) => item.id === ownerId)) throw new Error("Source record not found.");
        const reference: FinancialReference = { id: `fin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ownerType, ownerId, type, value: normalizeFinancialReferenceValue(value), createdAt: new Date().toISOString(), createdByUserId: currentUser.id };
        setFinancialReferences((current) => [...current, reference]);
        audit("FINANCIAL_REFERENCE_ADDED", "FINANCIAL_REFERENCE", reference.id, `${type} Number added to ${ownerType} ${ownerId}`, [{ field: "type", before: "", after: type }, { field: "value", before: "", after: reference.value }], ownerType === "REQUEST" ? { requestId: ownerId } : { maintenanceId: ownerId });
        return reference;
      },
      updateFinancialReference: (id, value) => {
        validateFinancialReferenceEditor(currentUser);
        const reference = financialReferences.find((item) => item.id === id);
        if (!reference) throw new Error("Financial reference not found.");
        const normalized = normalizeFinancialReferenceValue(value);
        if (normalized === reference.value) return;
        setFinancialReferences((current) => current.map((item) => item.id === id ? { ...item, value: normalized, updatedAt: new Date().toISOString() } : item));
        audit("FINANCIAL_REFERENCE_UPDATED", "FINANCIAL_REFERENCE", id, `${reference.type} Number updated on ${reference.ownerType} ${reference.ownerId}`, [{ field: "type", before: reference.type, after: reference.type }, { field: "value", before: reference.value, after: normalized }], reference.ownerType === "REQUEST" ? { requestId: reference.ownerId } : { maintenanceId: reference.ownerId });
      },
      removeFinancialReference: (id) => {
        validateFinancialReferenceEditor(currentUser);
        const reference = financialReferences.find((item) => item.id === id);
        if (!reference) throw new Error("Financial reference not found.");
        setFinancialReferences((current) => current.filter((item) => item.id !== id));
        audit("FINANCIAL_REFERENCE_REMOVED", "FINANCIAL_REFERENCE", id, `${reference.type} Number removed from ${reference.ownerType} ${reference.ownerId}`, [{ field: "type", before: reference.type, after: reference.type }, { field: "value", before: reference.value, after: "" }], reference.ownerType === "REQUEST" ? { requestId: reference.ownerId } : { maintenanceId: reference.ownerId });
      },
      transferPlans,
      createPerson: (draft) => {
        validatePersonDraft(draft);
        if (people.some((person) => person.email.toLowerCase() === draft.email.trim().toLowerCase())) throw new Error("This email is already registered.");
        const timestamp = new Date().toISOString();
        const person: Person = { ...draft, id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: draft.name.trim(), email: draft.email.trim(), createdAt: timestamp, updatedAt: timestamp };
        setPeople((current) => [...current, person]);
        audit("CREATE", "USER", person.id, `Created ${person.name} with ${person.roles.join(", ")}`);
        return person;
      },
      updatePerson: (id, draft) => {
        validatePersonDraft(draft);
        const previous = people.find((person) => person.id === id);
        if (!previous) throw new Error("User not found.");
        if (people.some((person) => person.id !== id && person.email.toLowerCase() === draft.email.trim().toLowerCase())) throw new Error("This email is already registered.");
        const changes = personChanges(previous, draft);
        if (!changes.length) return;
        setPeople((current) => current.map((person) => person.id === id ? { ...person, ...draft, name: draft.name.trim(), email: draft.email.trim(), updatedAt: new Date().toISOString() } : person));
        audit("UPDATE", "USER", id, `Updated ${previous.name}: ${changes.map((change) => change.field).join(", ")}`, changes);
      },
      setPersonStatus: (id, status) => {
        const previous = people.find((person) => person.id === id);
        if (!previous) throw new Error("User not found.");
        if (previous.id === currentUser.id && status === "INACTIVE") throw new Error("Switch prototype user before inactivating the current user.");
        if (previous.status === status) return;
        setPeople((current) => current.map((person) => person.id === id ? { ...person, status, updatedAt: new Date().toISOString() } : person));
        audit(status === "ACTIVE" ? "ACTIVATE" : "INACTIVATE", "USER", id, `${status === "ACTIVE" ? "Activated" : "Inactivated"} ${previous.name}`, [{ field: "status", before: previous.status, after: status }]);
      },
      planTransfer: (input) => {
        const asset = assets.find((item) => item.id === input.assetId);
        const destination = getRegisteredLocation(input.destinationId);
        if (!asset || !destination || !input.responsibleParty.trim() || input.evidence.length < 3) throw new Error("Complete Asset, destination, receiving party, and required evidence.");
        const plan: TransferPlan = { id: `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, assetId: asset.id, destinationId: destination.id, responsibleParty: input.responsibleParty.trim(), condition: input.condition, evidenceViews: [...input.evidence], notes: input.notes.trim(), submittedAt: new Date().toISOString() };
        setTransferPlans((current) => [plan, ...current]);
        audit("TRANSFER_PLANNED", "TRANSFER", plan.id, `Submitted ${asset.name} handover plan to ${destination.name}; receiving party ${plan.responsibleParty}`, undefined, { assetId: asset.id });
        return plan;
      },
      requests,
      assets,
      wbsReferences,
      events,
      bookingLoading,
      bookingError,
      savePersistedRequest: async (draft, revision, commandKey = crypto.randomUUID()) => {
        if (bookingLoading) throw new Error("Wait for persisted Requests to load.");
        if (bookingError) throw new Error(bookingError);
        const saved = await saveDurableBooking(draft, currentUser.id, commandKey, revision);
        setRequests((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        const loaded = await fetchDurableBookings();
        setWbsReferences([...loaded.wbsReferences, ...prototypeWbsReferences]);
        setAuditEvents((current) => [...loaded.auditEvents, ...current.filter((event) => !loaded.auditEvents.some((savedEvent) => savedEvent.id === event.id))]);
        return saved;
      },
      savePersistedReview: async (request, command) => {
        if (!request.canonicalId) throw new Error("This Request is not persisted.");
        const loaded = await saveDurableReview(request, currentUser.id, command);
        setRequests([...loaded.requests, ...requests.filter((item) => !item.canonicalId)]);
        setApprovalAssignments(loaded.assignments);
        setWbsReferences([...loaded.wbsReferences, ...prototypeWbsReferences]);
        setAuditEvents((current) => [...loaded.auditEvents, ...current.filter((event) => !loaded.auditEvents.some((savedEvent) => savedEvent.id === event.id))]);
      },
      returnReceipts,
      maintenanceRecords,
      createMaintenance: (assetId, origin) => {
        const asset = assets.find((item) => item.id === assetId);
        if (!asset) throw new Error("Asset not found.");
        const request = requests.find((item) => item.id === origin.sourceRequestId);
        const receipt = returnReceipts.find((item) => item.requestItemId === origin.sourceRequestItemId);
        const record = createMaintenanceRecord(maintenanceRecords, asset, origin, currentUser.name, new Date().toISOString(), request, receipt);
        setMaintenanceRecords((current) => [...current, record]);
        setAssets((current) => current.map((item) => item.id === assetId ? applyActiveMaintenanceToAsset(item, record) : item));
        audit("MAINTENANCE_CREATED", "MAINTENANCE", record.id, `Created maintenance for ${asset.name}`, undefined, { assetId, requestId: origin.sourceRequestId, requestItemId: origin.sourceRequestItemId });
        return record;
      },
      assignMaintenanceVendor: (maintenanceId, vendorId) => {
        const record = maintenanceRecords.find((item) => item.id === maintenanceId);
        if (!record) throw new Error("Maintenance not found.");
        const next = assignMaintenanceVendor(record, vendorId, currentUser.name, new Date().toISOString());
        setMaintenanceRecords((current) => current.map((item) => item.id === maintenanceId ? next : item));
        setAssets((current) => current.map((item) => item.id === record.assetId ? applyActiveMaintenanceToAsset(item, next) : item));
        audit("VENDOR_ASSIGNED", "MAINTENANCE", maintenanceId, `Assigned Vendor ${vendorId}`, [{ field: "vendorId", before: record.vendorId ?? "", after: vendorId }], { assetId: record.assetId });
      },
      addMaintenanceEvidence: (maintenanceId, purpose, image) => {
        const record = maintenanceRecords.find((item) => item.id === maintenanceId);
        if (!record) throw new Error("Maintenance not found.");
        if (!image.mimeType.startsWith("image/") || !image.dataUrl.startsWith(`data:${image.mimeType};base64,`))
          throw new Error("Choose a valid image file.");
        const photo: Asset["photos"][number] = {
          id: `maintenance-photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          view: "Detail", required: true, caption: image.name,
          mimeType: image.mimeType, dataUrl: image.dataUrl,
          maintenancePurpose: purpose, maintenanceId,
        };
        const next = addMaintenancePhoto(record, photo, new Date().toISOString());
        setMaintenanceRecords((current) => current.map((item) => item.id === maintenanceId ? next : item));
        setAssets((current) => current.map((item) => item.id === record.assetId ? {
          ...item, photos: [...item.photos, photo],
          history: [{ date: next.updatedAt, title: `${purpose} maintenance photo added`, detail: image.name, kind: "Maintenance" }, ...item.history],
        } : item));
        audit("PHOTO_ADDED", "MAINTENANCE", maintenanceId, `${purpose} evidence added (${photo.id})`, undefined, { assetId: record.assetId });
      },
      startMaintenanceWork: (maintenanceId) => {
        const record = maintenanceRecords.find((item) => item.id === maintenanceId);
        const asset = assets.find((item) => item.id === record?.assetId);
        if (!record || !asset) throw new Error("Maintenance or Asset not found.");
        const next = startMaintenanceWork(record, asset.photos, new Date().toISOString());
        setMaintenanceRecords((current) => current.map((item) => item.id === maintenanceId ? next : item));
        setAssets((current) => current.map((item) => item.id === asset.id ? applyActiveMaintenanceToAsset(item, next) : item));
        audit("WORK_STARTED", "MAINTENANCE", maintenanceId, "Vendor work started", [{ field: "status", before: record.status, after: next.status }], { assetId: asset.id });
      },
      completeVendorWork: (maintenanceId, reportedBy) => {
        const record = maintenanceRecords.find((item) => item.id === maintenanceId);
        const asset = assets.find((item) => item.id === record?.assetId);
        if (!record || !asset) throw new Error("Maintenance or Asset not found.");
        const next = completeVendorWork(record, asset.photos, reportedBy, new Date().toISOString());
        setMaintenanceRecords((current) => current.map((item) => item.id === maintenanceId ? next : item));
        setAssets((current) => current.map((item) => item.id === asset.id ? applyActiveMaintenanceToAsset(item, next) : item));
        audit("WORK_COMPLETED", "MAINTENANCE", maintenanceId, `Vendor work reported complete by ${reportedBy.trim()}`, [{ field: "status", before: record.status, after: next.status }], { assetId: asset.id });
      },
      acceptMaintenance: (maintenanceId, input) => {
        const record = maintenanceRecords.find((item) => item.id === maintenanceId);
        const asset = assets.find((item) => item.id === record?.assetId);
        if (!record || !asset) throw new Error("Maintenance or Asset not found.");
        const result = acceptMaintenance(record, asset, input, currentUser.name, new Date().toISOString());
        setMaintenanceRecords((current) => current.map((item) => item.id === maintenanceId ? result.record : item));
        setAssets((current) => current.map((item) => item.id === asset.id ? result.asset : item));
        audit("MAINTENANCE_ACCEPTED", "MAINTENANCE", maintenanceId, `Accepted maintenance; condition ${input.conditionAfter}`, [{ field: "status", before: record.status, after: result.record.status }, { field: "condition", before: asset.condition, after: input.conditionAfter }], { assetId: asset.id });
        if (input.resolveLinkedIssue && record.issueId) audit("STATUS_CHANGE", "ISSUE", record.issueId, `Resolved linked Issue from maintenance ${maintenanceId}`, [{ field: "status", before: asset.issues.find((issue) => issue.id === record.issueId)?.status ?? "", after: "Resolved" }], { assetId: asset.id });
      },
      holdMaintenance: (maintenanceId, reason) => {
        const record = maintenanceRecords.find((item) => item.id === maintenanceId);
        if (!record) throw new Error("Maintenance not found.");
        const next = holdMaintenance(record, reason, new Date().toISOString());
        setMaintenanceRecords((current) => current.map((item) => item.id === maintenanceId ? next : item));
        setAssets((current) => current.map((item) => item.id === record.assetId ? applyActiveMaintenanceToAsset(item, next) : item));
        audit("MAINTENANCE_REWORK", "MAINTENANCE", maintenanceId, `Sent back for rework: ${reason.trim()}`, [{ field: "status", before: record.status, after: next.status }], { assetId: record.assetId });
      },
      resumeMaintenance: (maintenanceId) => {
        const record = maintenanceRecords.find((item) => item.id === maintenanceId);
        if (!record) throw new Error("Maintenance not found.");
        const next = resumeMaintenance(record, new Date().toISOString());
        setMaintenanceRecords((current) => current.map((item) => item.id === maintenanceId ? next : item));
        setAssets((current) => current.map((item) => item.id === record.assetId ? applyActiveMaintenanceToAsset(item, next) : item));
        audit("MAINTENANCE_REWORK", "MAINTENANCE", maintenanceId, "Resumed corrective work", [{ field: "status", before: record.status, after: next.status }], { assetId: record.assetId });
      },
      cancelMaintenance: (maintenanceId, reason) => {
        const record = maintenanceRecords.find((item) => item.id === maintenanceId);
        if (!record) throw new Error("Maintenance not found.");
        const next = cancelMaintenance(record, reason, new Date().toISOString());
        setMaintenanceRecords((current) => current.map((item) => item.id === maintenanceId ? next : item));
        setAssets((current) => current.map((item) => item.id === record.assetId ? applyCancelledMaintenanceToAsset(item, next) : item));
        audit("MAINTENANCE_CANCELLED", "MAINTENANCE", maintenanceId, `Cancelled maintenance: ${reason.trim()}`, [{ field: "status", before: record.status, after: next.status }], { assetId: record.assetId });
      },
      startReturn: (requestId, requestItemId) => {
        const request = requests.find((item) => item.id === requestId);
        if (!request) throw new Error("Request not found.");
        const next = initiateReturn(
          returnReceipts,
          request,
          requestItemId,
          currentUser.name,
          new Date().toISOString(),
        );
        setReturnReceipts(next);
        setRequests((current) =>
          current.map((item) =>
            item.id === requestId
              ? {
                  ...item,
                  items: item.items.map((entry) =>
                    entry.id === requestItemId
                      ? { ...entry, fulfillmentState: "Return pending" }
                      : entry,
                  ),
                  activity: [
                    {
                      date: next.at(-1)!.initiatedAt,
                      title: "Return initiated",
                      detail: requestItemId,
                    },
                    ...(item.activity ?? []),
                  ],
                }
              : item,
          ),
        );
        const returnItem = request.items.find((item) => item.id === requestItemId);
        audit("RETURN_STARTED", "REQUEST_ITEM", requestItemId, `Started return for ${requestItemId}`, undefined, { requestId, requestItemId, assetId: returnItem?.assetId });
      },
      confirmReceived: (requestId, requestItemId, input) => {
        const request = requests.find((item) => item.id === requestId);
        const location = getRegisteredLocation(input.receivingLocationId);
        if (!request) throw new Error("Request not found.");
        if (!location)
          throw new Error("Choose a registered receiving location.");
        const next = confirmReturnReceived(
          returnReceipts,
          request,
          requestItemId,
          input,
          new Date().toISOString(),
        );
        const receipt = next.find(
          (item) => item.requestItemId === requestItemId,
        )!;
        setReturnReceipts(next);
        setAssets((current) =>
          current.map((asset) =>
            asset.id === receipt.assetId
              ? applyReceiptToAsset(asset, receipt, location)
              : asset,
          ),
        );
        setRequests((current) =>
          current.map((item) =>
            item.id === requestId
              ? {
                  ...item,
                  items: item.items.map((entry) =>
                    entry.id === requestItemId
                      ? { ...entry, fulfillmentState: "Inspection pending" }
                      : entry,
                  ),
                  activity: [
                    {
                      date: receipt.receivedAt!,
                      title: "Asset received",
                      detail: `${requestItemId} · ${location.name} · ${receipt.receivedBy}`,
                    },
                    ...(item.activity ?? []),
                  ],
                }
              : item,
          ),
        );
        audit("RETURN_RECEIVED", "REQUEST_ITEM", requestItemId, `Confirmed receipt of ${receipt.assetId} at ${location.name}; receiving PIC ${receipt.receivedBy}`, undefined, { requestId, requestItemId, assetId: receipt.assetId });
      },
      completeInspection: (requestId, requestItemId, outcome) => {
        const request = requests.find((item) => item.id === requestId);
        if (!request) throw new Error("Request not found.");
        const inspectedAt = new Date().toISOString();
        const next = completeReturnInspection(
          returnReceipts,
          request,
          requestItemId,
          outcome,
          inspectedAt,
        );
        setReturnReceipts(next);
        const requestItem = request.items.find(
          (item) => item.id === requestItemId,
        )!;
        setAssets((current) =>
          current.map((asset) =>
            asset.id === requestItem.assetId
              ? applyInspectionToAsset(asset, outcome, inspectedAt)
              : asset,
          ),
        );
        setRequests((current) =>
          current.map((item) =>
            item.id === requestId
              ? {
                  ...item,
                  items: item.items.map((entry) =>
                    entry.id === requestItemId && outcome === "Clear"
                      ? { ...entry, fulfillmentState: "Returned" }
                      : entry,
                  ),
                  activity: [
                    {
                      date: inspectedAt,
                      title: "Return inspection completed",
                      detail: `${requestItemId} · ${outcome}`,
                    },
                    ...(item.activity ?? []),
                  ],
                }
              : item,
          ),
        );
        audit("INSPECTION_COMPLETED", "INSPECTION", `${requestItemId}:inspection`, `Inspection ${outcome} for ${requestItemId}`, [{ field: "outcome", before: "Inspection pending", after: outcome }], { requestId, requestItemId, assetId: requestItem.assetId });
      },
      saveEvent: (draft) => {
        const id = draft.id ?? `EVT-CUSTOM-${Date.now()}`;
        if (!isValidEventParent(events, id, draft.parentEventId)) return false;
        const previous = events.find((item) => item.id === id);
        const event: ActivationEvent = { ...draft, id };
        setEvents((current) =>
          current.some((item) => item.id === id)
            ? current.map((item) => (item.id === id ? event : item))
            : [...current, event],
        );
        audit(previous ? "UPDATE" : "CREATE", "EVENT", id, `${previous ? "Updated" : "Created"} event ${event.name}`, previous ? [{ field: "name", before: previous.name, after: event.name }, { field: "status", before: previous.status, after: event.status }, { field: "parentEventId", before: previous.parentEventId ?? "", after: event.parentEventId ?? "" }].filter((change) => change.before !== change.after) : undefined);
        return true;
      },
      createRequest: (draft) => {
        const { wbsCodes = [], items, ...requestDraft } = draft;
        const normalizedCodes = uniqueWbsCodes(wbsCodes);
        const addedReferences = normalizedCodes
          .filter(
            (code) =>
              !wbsReferences.some((reference) => reference.code === code),
          )
          .map((code, index): WbsReference => ({
            id: `wbs-${Date.now()}-${index}`,
            code,
            createdAt: new Date().toISOString().slice(0, 10),
          }));
        const allReferences = [...wbsReferences, ...addedReferences];
        const wbsReferenceIds = normalizedCodes
          .map(
            (code) =>
              allReferences.find((reference) => reference.code === code)?.id,
          )
          .filter((id): id is string => Boolean(id));
        const requestId = `REQ-2026-${String(Math.max(...requests.map((item) => Number(item.id.match(/\d+$/)?.[0] ?? 0))) + 1).padStart(3, "0")}`;
        const request: PrototypeRequest = {
          ...requestDraft,
          id: requestId,
          submittedByUserId: currentUser.id,
          reviewRound: 1,
          items: items.map((item, index) => ({
            ...item,
            id: `${requestId}:item:${index + 1}`,
          })),
          wbsReferenceIds,
          status: "Pending approval",
          submittedAt: "Today",
        };
        request.fulfillmentGroups = normalizeGroupItemIds(request.fulfillmentGroups, request.items);
        request.returnGroups = normalizeGroupItemIds(request.returnGroups, request.items);
        request.reviewHistory = [reviewHistoryEntry({ cycle: 1, timestamp: new Date().toISOString(), action: "Submitted", actor: currentUser })];
        if (addedReferences.length) setWbsReferences(allReferences);
        setRequests((current) => [request, ...current]);
        audit("REQUEST_SUBMITTED", "REQUEST", request.id, `Submitted ${request.items.length}-item request ${request.id}; reviewer assignment required`, undefined, { requestId: request.id });
        return request;
      },
      assignRequestReviewer: (requestId, reviewerUserId) => {
        const request = requests.find((item) => item.id === requestId);
        const reviewer = people.find((item) => item.id === reviewerUserId);
        const prior = validateReviewerAssignment(request, reviewer, currentUser, approvalAssignments);
        const now = new Date().toISOString();
        const assignment: ApprovalAssignment = {
          id: `review-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          requestId, cycle: reviewCycle(request!), sequence: 1, reviewerUserId,
          status: "Pending", assignedAt: now, assignedByUserId: currentUser.id,
        };
        setApprovalAssignments((current) => [assignment, ...current.map((item) => item.id === prior?.id ? { ...item, status: "Superseded" as const } : item)]);
        const event = reviewHistoryEntry({ cycle: assignment.cycle, timestamp: now, action: prior ? "Reassigned" : "Assigned", actor: currentUser, reviewerUserId, assignmentId: assignment.id, note: prior ? `Previous reviewer: ${people.find((item) => item.id === prior.reviewerUserId)?.name ?? prior.reviewerUserId}` : undefined });
        setRequests((current) => current.map((item) => item.id === requestId ? appendReviewHistory(item, event) : item));
        audit(prior ? "REVIEWER_REASSIGNED" : "REVIEWER_ASSIGNED", "REQUEST", requestId, `${prior ? "Reassigned" : "Assigned"} reviewer ${reviewer!.name} for ${requestId}`, prior ? [{ field: "reviewerUserId", before: prior.reviewerUserId, after: reviewerUserId }] : undefined, { requestId, approvalAssignmentId: assignment.id });
        return assignment;
      },
      decideRequestReview: (requestId, decision, note) => {
        const request = requests.find((item) => item.id === requestId);
        const assignment = activeReviewAssignment(approvalAssignments, requestId);
        validateReviewDecision(request, assignment, currentUser, decision, note);
        const now = new Date().toISOString();
        setApprovalAssignments((current) => current.map((item) => item.id === assignment!.id ? { ...item, status: decision, decision, note: note.trim() || undefined, decidedAt: now, decidedByUserId: currentUser.id } : item));
        const event = reviewHistoryEntry({ cycle: assignment!.cycle, timestamp: now, action: decision, actor: currentUser, reviewerUserId: assignment!.reviewerUserId, assignmentId: assignment!.id, note: note.trim() || undefined });
        setRequests((current) => current.map((item) => item.id === requestId ? appendReviewHistory({ ...item, status: decision, approvalComment: note.trim() || undefined, approver: currentUser.name }, event) : item));
        const action = decision === "Approved" ? "REVIEW_APPROVED" : decision === "Rejected" ? "REVIEW_REJECTED" : "REVIEW_NEEDS_UPDATE";
        audit(action, "REQUEST", requestId, `${decision} ${requestId} by ${currentUser.name}`, [{ field: "status", before: request!.status, after: decision }, ...(note.trim() ? [{ field: "decisionNote", before: "", after: note.trim() }] : [])], { requestId, approvalAssignmentId: assignment!.id });
      },
      resubmitRequest: (requestId, draft) => {
        const request = requests.find((item) => item.id === requestId);
        if (!request || request.status !== "Needs update") throw new Error("Only a Request needing an update can be resubmitted.");
        if (request.submittedByUserId && request.submittedByUserId !== currentUser.id && !currentUser.roles.includes("SUPER_ADMIN")) throw new Error("Only the requester or prototype Super Admin can resubmit this Request.");
        const { wbsCodes = [], items, ...fields } = draft;
        const normalizedCodes = uniqueWbsCodes(wbsCodes);
        const addedReferences = normalizedCodes.filter((code) => !wbsReferences.some((reference) => reference.code === code)).map((code, index): WbsReference => ({ id: `wbs-${Date.now()}-${index}`, code, createdAt: new Date().toISOString().slice(0, 10) }));
        const allReferences = [...wbsReferences, ...addedReferences];
        const wbsReferenceIds = normalizedCodes.map((code) => allReferences.find((reference) => reference.code === code)?.id).filter((id): id is string => Boolean(id));
        const cycle = reviewCycle(request) + 1;
        const event = reviewHistoryEntry({ cycle, timestamp: new Date().toISOString(), action: "Resubmitted", actor: currentUser });
        let nextItemIndex = Math.max(0, ...request.items.map((item) => Number(item.id.match(/:item:(\d+)$/)?.[1] ?? 0)));
        const revisedItems = preserveRequestItemIds(request.items, items, () => `${requestId}:item:${++nextItemIndex}`);
        const revised: PrototypeRequest = appendReviewHistory({ ...request, ...fields, id: requestId, items: revisedItems, wbsReferenceIds, status: "Pending approval", reviewRound: cycle, submittedAt: "Today", approvalComment: undefined }, event);
        revised.fulfillmentGroups = normalizeGroupItemIds(revised.fulfillmentGroups, revised.items);
        revised.returnGroups = normalizeGroupItemIds(revised.returnGroups, revised.items);
        if (addedReferences.length) setWbsReferences(allReferences);
        setRequests((current) => current.map((item) => item.id === requestId ? revised : item));
        audit("REQUEST_RESUBMITTED", "REQUEST", requestId, `Resubmitted ${requestId} for review cycle ${cycle}; reviewer assignment required`, [{ field: "status", before: request.status, after: "Pending approval" }], { requestId });
        return revised;
      },
      reportIssue: (assetId, draft) => {
        if (!assets.some((asset) => asset.id === assetId)) throw new Error("Asset not found.");
        const issue: AssetIssue = {
          id: `ISS-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          ...draft,
          evidencePhotoIds: ["detail"],
          reportedAt: new Date().toISOString(),
          reportedBy: currentUser.name,
          status: "Open",
        };
        setAssets((current) =>
          current.map((asset) =>
            asset.id === assetId
              ? {
                  ...asset,
                  issues: [issue, ...asset.issues],
                  history: [
                    {
                      date: issue.reportedAt,
                      title: "Issue reported",
                      detail: `${issue.area}: ${issue.type.toLowerCase()}`,
                      tone: "issue",
                    },
                    ...asset.history,
                  ],
                }
              : asset,
          ),
        );
        audit("ISSUE_CREATED", "ISSUE", issue.id, `Reported ${issue.type} on ${assetId}`, undefined, { assetId });
      },
      documentPhoto: (assetId, view) => {
        const asset = assets.find((item) => item.id === assetId);
        if (!asset || asset.photos.some((photo) => photo.view === view)) return;
        setAssets((current) =>
          current.map((asset) => {
            if (
              asset.id !== assetId ||
              asset.photos.some((photo) => photo.view === view)
            )
              return asset;
            const photo = {
              id: `${view.toLowerCase().replaceAll(" ", "-")}-${Date.now()}`,
              view,
              required: ["Front", "Left side", "Right side"].includes(view),
              caption: `${view} documentation captured in this prototype session`,
            } as Asset["photos"][number];
            return {
              ...asset,
              photos: [...asset.photos, photo],
              history: [
                {
                  date: "12 Aug 2026",
                  title: "Photo documentation added",
                  detail: view,
                },
                ...asset.history,
              ],
            };
          }),
        );
        audit("PHOTO_ADDED", "ASSET", assetId, `Documented ${view} view`, undefined, { assetId });
      },
      role,
      setRole,
    }),
    [approvalAssignments, assets, audit, auditEvents, bookingError, bookingLoading, currentUser, events, financialReferences, maintenanceRecords, people, requests, returnReceipts, role, transferPlans, wbsReferences],
  );

  return (
    <PrototypeContext.Provider value={value}>
      {children}
    </PrototypeContext.Provider>
  );
}

export function usePrototype() {
  const context = useContext(PrototypeContext);
  if (!context)
    throw new Error("usePrototype must be used inside PrototypeProvider");
  return context;
}

export function usePrototypeOptional() {
  return useContext(PrototypeContext);
}

export { prototypeAssets };
