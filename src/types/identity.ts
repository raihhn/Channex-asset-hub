export const userRoles = ["REQUESTER", "STORE_DEV", "BRAND", "VENDOR", "SUPER_ADMIN", "MANAGEMENT"] as const;
export type UserRole = (typeof userRoles)[number];
export type UserStatus = "ACTIVE" | "INACTIVE";

/** Organizational identity, not a physical handover PIC or authenticated session. */
export type Person = {
  id: string;
  name: string;
  email: string;
  roles: UserRole[];
  status: UserStatus;
  brandIds: string[];
  categoryIds: string[];
  areaIds: string[];
  dcIds: string[];
  vendorId?: string;
  createdAt: string;
  updatedAt: string;
};

export type PersonDraft = Omit<Person, "id" | "createdAt" | "updatedAt">;

/** A submitted prototype handover plan, not a confirmed physical movement. */
export type TransferPlan = {
  id: string;
  assetId: string;
  destinationId: string;
  responsibleParty: string;
  condition: "Good" | "Fair" | "Needs review";
  evidenceViews: string[];
  notes: string;
  submittedAt: string;
};

export type AuditEntityType = "USER" | "ASSET" | "REQUEST" | "REQUEST_ITEM" | "EVENT" | "TRANSFER" | "RETURN" | "INSPECTION" | "ISSUE" | "MAINTENANCE" | "FINANCIAL_REFERENCE";
export type AuditAction = "CREATE" | "UPDATE" | "ACTIVATE" | "INACTIVATE" | "STATUS_CHANGE" | "REQUEST_SUBMITTED" | "REVIEWER_ASSIGNED" | "REVIEWER_REASSIGNED" | "REVIEW_APPROVED" | "REVIEW_REJECTED" | "REVIEW_NEEDS_UPDATE" | "REQUEST_RESUBMITTED" | "RETURN_STARTED" | "RETURN_RECEIVED" | "INSPECTION_COMPLETED" | "ISSUE_CREATED" | "PHOTO_ADDED" | "TRANSFER_PLANNED" | "MAINTENANCE_CREATED" | "VENDOR_ASSIGNED" | "WORK_STARTED" | "WORK_COMPLETED" | "MAINTENANCE_ACCEPTED" | "MAINTENANCE_REWORK" | "MAINTENANCE_CANCELLED" | "FINANCIAL_REFERENCE_ADDED" | "FINANCIAL_REFERENCE_UPDATED" | "FINANCIAL_REFERENCE_REMOVED";

export type AuditChange = { field: string; before: string; after: string };

/** Append-only in the prototype UI; the server-side immutability guarantee is deferred. */
export type AuditEvent = Readonly<{
  id: string;
  timestamp: string;
  actorUserId: string;
  actorNameSnapshot: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  summary: string;
  changes?: readonly AuditChange[];
  related?: Readonly<{ requestId?: string; requestItemId?: string; assetId?: string; maintenanceId?: string; approvalAssignmentId?: string }>;
}>;
