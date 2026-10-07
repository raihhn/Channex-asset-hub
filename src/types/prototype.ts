export type AssetAvailability =
  "available" | "reserved" | "in-use" | "maintenance" | "unavailable";

export type AssetCondition = "Good" | "Fair" | "Needs review";
export type AssetClassification = "ASSET" | "INVENTORY";

export type WbsReference = {
  id: string;
  code: string;
  label?: string;
  notes?: string;
  createdAt: string;
};

/** Manual reference to an external financial record; never a validation or ledger entry. */
export type FinancialReference = {
  id: string;
  type: "PR" | "PO" | "INVOICE";
  value: string;
  ownerType: "REQUEST" | "MAINTENANCE";
  ownerId: string;
  createdAt: string;
  createdByUserId: string;
  updatedAt?: string;
};

export type AssetArtworkTone =
  "teal" | "rose" | "gold" | "violet" | "ocean" | "lime";

export type AssetPhotoView =
  | "Front"
  | "Left side"
  | "Right side"
  | "Rear"
  | "Detail"
  | "Installed"
  | "Other";
export type IssueType =
  | "Scratch"
  | "Dent"
  | "Broken"
  | "Missing part"
  | "Stain"
  | "Structural issue"
  | "Other";
export type IssueSeverity = "Minor" | "Moderate" | "Major";
export type AssetPhoto = {
  id: string;
  view: AssetPhotoView;
  required: boolean;
  caption: string;
  /** In-memory image evidence; maintenance uses the existing Asset media list. */
  dataUrl?: string;
  mimeType?: string;
  maintenancePurpose?: "Before" | "After";
  maintenanceId?: string;
};
export type AssetIssue = {
  id: string;
  type: IssueType;
  area: string;
  severity: IssueSeverity;
  notes: string;
  evidencePhotoIds: string[];
  reportedAt: string;
  reportedBy: string;
  status: "Open" | "Under Review" | "Resolved";
  blocksUsage?: boolean;
};
export type AssetHistoryEntry = {
  date: string;
  title: string;
  detail: string;
  tone?: "issue" | "default";
  kind?: "Usage" | "Movement" | "Condition" | "Issues" | "Maintenance";
};

export type Asset = {
  id: string;
  code: string;
  name: string;
  brand: string;
  category: "Booth" | "Display" | "POSM" | "Supporting asset";
  /** Optional only for compatibility with older fixture records. */
  classification?: AssetClassification;
  type: string;
  location: string;
  locationType:
    | "Internal warehouse"
    | "Vendor storage"
    | "Vendor warehouse"
    | "Vendor workshop"
    | "Store";
  availability: AssetAvailability;
  condition: AssetCondition;
  producedAt: string;
  ageLabel: string;
  lastUsed: string;
  /** ISO date used only when the source provides a reliable last-use date. */
  lastUsedAt?: string;
  lastUsedContext: string;
  lifecycleNote?: string;
  description: string;
  artwork: "pavilion" | "modular" | "display" | "posm" | "counter" | "kit";
  tone: AssetArtworkTone;
  photos: AssetPhoto[];
  issues: AssetIssue[];
  history: AssetHistoryEntry[];
  blockedRanges?: Array<{ start: string; end: string; label: string }>;
  supportsQuantity?: boolean;
  availableQuantity?: number;
  totalQuantity?: number;
  trackingType?: "Individual" | "Quantity-based";
  maintenance?: {
    reason: string;
    type: string;
    status: "Open" | "In progress" | "Completed";
    expectedCompletion?: string;
  };
  inspectionState?: "Clear" | "Inspection pending" | "On hold";
  storageZone?: string;
  responsiblePic?: string;
  /** Physical holder; distinct from the long-term responsible Asset PIC. */
  currentCustodian?: string;
  locationDetail?: string;
  handlingProfile?: "Portable" | "Delivery only" | "Coordinated delivery";
};

export type PrototypeRole =
  "Viewer" | "Requester" | "Asset Ops" | "Approver" | "System Admin";

export type RequestStatus =
  | "Pending approval"
  | "Approved"
  | "Rejected"
  | "Cancelled"
  | "Draft"
  | "Ready"
  | "Return due"
  | "Inspection pending"
  | "Overdue"
  | "In use"
  | "Completed"
  | "Needs update";

export type FulfillmentGroup = {
  id: string;
  method: "Pickup" | "Delivery";
  source: string;
  sourceDetail?: string;
  destination: string;
  destinationType?:
    | "Event venue"
    | "Internal warehouse"
    | "Vendor warehouse"
    | "Vendor workshop"
    | "Other";
  destinationDetail?: string;
  destinationVendorId?: string;
  destinationLocationId?: string;
  window: string;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  contact: string;
  itemIds: string[];
  state?: "Planned" | "Partial" | "Complete";
};

export type ReturnGroup = {
  id: string;
  method: "User return" | "Vendor collection";
  from: string;
  to: string;
  window: string;
  itemIds: string[];
};

/** Canonical receipt relationship is RequestItem.id; assetId is context. */
export type ReturnReceipt = {
  id: string;
  requestId: string;
  requestItemId: string;
  assetId: string;
  initiatedAt: string;
  initiatedBy: string;
  receivedAt?: string;
  receivedBy?: string;
  receivingLocationId?: string;
  conditionAtReceipt?: AssetCondition;
  notes?: string;
  inspectedAt?: string;
  inspectionOutcome?: "Clear" | "On hold";
};

export type MaintenanceStatus =
  | "Draft"
  | "Vendor assigned"
  | "In progress"
  | "Work completed"
  | "On hold"
  | "Accepted"
  | "Cancelled";

export type MaintenanceRecord = {
  id: string;
  assetId: string;
  reason: string;
  status: MaintenanceStatus;
  sourceRequestId?: string;
  sourceRequestItemId?: string;
  issueId?: string;
  vendorId?: string;
  beforePhotoIds: string[];
  afterPhotoIds: string[];
  conditionBefore: AssetCondition;
  availabilityBefore: AssetAvailability;
  conditionAfter?: AssetCondition;
  createdAt: string;
  createdBy: string;
  assignedAt?: string;
  assignedBy?: string;
  workStartedAt?: string;
  workCompletedAt?: string;
  workCompletedBy?: string;
  acceptedAt?: string;
  acceptedBy?: string;
  notes?: string;
  updatedAt: string;
  activity: Array<{ at: string; title: string; detail: string }>;
};

export type RequestDocumentCategory =
  "Floor plan / venue layout" | "Loading-in letter" | "Loading-out letter";

export type RequestDocument = {
  id: string;
  category: RequestDocumentCategory;
  name: string;
  mimeType: string;
  size: number;
  /** Local data URL for the reviewable, frontend-only prototype. */
  dataUrl?: string;
};

export type TransferDraft = {
  assetId: string;
  destinationLocationId: string;
  responsibleParty: string;
  purpose: string;
  condition: AssetCondition;
  evidencePhotoViews: Array<"Front" | "Left side" | "Detail">;
  notes?: string;
};

export type PrototypeRequest = {
  id: string;
  /** Present only for a database-backed Request; id remains the display number. */
  canonicalId?: string;
  version?: number;
  /** Canonical actor for new submissions; legacy fixtures may only have a PIC snapshot. */
  submittedByUserId?: string;
  reviewRound?: number;
  reviewHistory?: RequestReviewHistoryEntry[];
  items: RequestItem[];
  /** Many-to-many-ready link to reusable manual WBS references. */
  wbsReferenceIds?: string[];
  status: RequestStatus;
  startDate: string;
  endDate: string;
  destination: string;
  purpose: string;
  contact: string;
  pickupDate?: string;
  pickupTime?: string;
  returnDate?: string;
  returnTime?: string;
  notes?: string;
  approvalComment?: string;
  submittedAt: string;
  usageType?: "Registered event" | "Vendor workshop" | "Ad-hoc";
  eventMode?: "Registered Event" | "Ad-hoc Event";
  eventId?: string;
  activityName?: string;
  projectName?: string;
  projectAddress?: string;
  siteContact?: string;
  spaceLength?: string;
  spaceWidth?: string;
  spaceHeight?: string;
  projectDetails?: string;
  budgetCode?: string;
  supportingDocuments?: RequestDocument[];
  adHocPurpose?: "Photoshoot" | "Training" | "Internal testing";
  adHocLocationType?: "Store" | "Outside Store";
  adHocPlace?: string;
  boothType?: "Regular Booth" | "Custom Booth";
  brand?: string;
  campaign?: string;
  destinationType?: FulfillmentGroup["destinationType"];
  destinationVendorId?: string;
  destinationLocationId?: string;
  fulfillmentGroups?: FulfillmentGroup[];
  returnGroups?: ReturnGroup[];
  approver?: string;
  activity?: Array<{ date: string; title: string; detail: string }>;
};

export type ApprovalDecision = "Approved" | "Rejected" | "Needs update";
export type ApprovalAssignmentStatus = "Pending" | "Approved" | "Rejected" | "Needs update" | "Superseded";
/** One review step in one cycle; old steps are retained after reassignment or revision. */
export type ApprovalAssignment = {
  id: string;
  requestId: string;
  cycle: number;
  sequence: number;
  reviewerUserId: string;
  status: ApprovalAssignmentStatus;
  assignedAt: string;
  assignedByUserId: string;
  decidedAt?: string;
  decidedByUserId?: string;
  decision?: ApprovalDecision;
  note?: string;
};

export type RequestReviewHistoryEntry = {
  id: string;
  cycle: number;
  timestamp: string;
  action: "Submitted" | "Assigned" | "Reassigned" | "Approved" | "Rejected" | "Needs update" | "Resubmitted";
  actorUserId: string;
  actorNameSnapshot: string;
  reviewerUserId?: string;
  assignmentId?: string;
  note?: string;
};

export type RequestItem = {
  id: string;
  assetId: string;
  quantity: number;
  fulfillmentMethod?: "Pickup" | "Delivery";
  fulfillmentState?:
    | "Reserved"
    | "In use"
    | "Return pending"
    | "Inspection pending"
    | "Returned"
    | "Outstanding";
  fulfilledQuantity?: number;
  substitutionFor?: string;
};

export type RequestDraft = Omit<
  PrototypeRequest,
  "id" | "items" | "status" | "submittedAt" | "wbsReferenceIds" | "submittedByUserId" | "reviewRound" | "reviewHistory" | "approvalComment" | "approver"
> & { items: Array<Omit<RequestItem, "id">>; wbsCodes: string[] };
export type IssueDraft = {
  area: string;
  type: IssueType;
  severity: IssueSeverity;
  notes: string;
};

export type ActivationEvent = {
  id: string;
  brand: string;
  campaign: string;
  name: string;
  venue: string;
  city: string;
  startDate: string;
  endDate: string;
  pic: string;
  status: "Planned" | "Active" | "Completed";
  /** Canonical event hierarchy; null/absent means standalone or parent. */
  parentEventId?: string | null;
  locationId?: string;
};

export type EventDraft = Omit<ActivationEvent, "id"> & { id?: string };
