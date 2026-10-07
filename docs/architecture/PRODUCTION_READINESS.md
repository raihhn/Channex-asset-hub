# AssetHub V2 — Production Readiness and Architecture Boundaries

> Historical Slice 9 audit. Slice 10 added a **local-only** PostgreSQL booking foundation. For current implementation status and limitations, read [Persistence Foundation](PERSISTENCE_FOUNDATION.md). Statements below describing the absence of any database are the Slice 9 baseline, not the current tree.

Status: Slice 9 audit of the **current frontend prototype**, 7 October 2026. This is an implementation map, not a production-readiness certification or authorization to deploy. No database, authentication provider, storage service, API, or integration was configured in this slice. The accepted [infrastructure ADR](../engineering/ADR_001_BACKEND_AUTH_STORAGE.md) already records Supabase PostgreSQL/Auth/Storage as an *eventual initial provider*; this audit does not select a new stack or activate that decision.

## 1. Executive Summary

The UI demonstrates Slices 1–8, but operational state is fixture-seeded React memory. Refresh loses mutations. Browser state, mutable actor selection, and client-side validation cannot become a production authority. Preserve the current domain semantics while introducing verified identity, server-side invariants, relational transactions, durable evidence, and concurrency control in later approved slices. The most dangerous false assumptions would be treating Request status as receipt, a TransferPlan as movement, `Asset.availability` as a booking lock, or an AuditEvent held in React state as a tamper-resistant audit log.

## 2. Current Runtime Architecture

Next.js routes under `src/app/` render `src/features/` and shared/domain components. `src/features/prototype/prototype-provider.tsx` owns fixture-initialized `useState` arrays for Assets, Requests, People, Events, WBS, financial references, assignments, transfers, receipts, maintenance and audit. `src/lib/domain/` contains mostly pure validation/derivation, while several business validations and draft values remain in `src/features/requests/request-flow-screen.tsx`. Fixture master data remains in `src/lib/fixtures/`. There are no durable repositories, server mutations, production login, object storage, or external APIs. Page refresh resets operational mutations.

Current ownership diagram:

```text
Browser UI / route → feature draft and UI guards → PrototypeProvider mutable arrays
                                      ↘ domain helpers ↗      ↑ fixtures
          reports, calendar, availability, dashboard = read projections of arrays
```

Target boundary is UI → authenticated server command/query → domain policy → transactional persistence, with private media behind a storage adapter. This is a boundary statement, not an implemented layer. Do not add an empty repository abstraction merely to make the prototype look production-like.

## 3. Canonical Entity Inventory

“Canonical” below means a business record or master record that will need durable authority, **not** that its current in-memory copy is production-authoritative. Embedded structures may need relational decomposition later; no schema is chosen here.

| Entity / record | Current owner and evidence | Future authority / persistence |
| --- | --- | --- |
| Asset | Provider `assets`; `Asset` in `src/types/prototype.ts` | Physical asset/inventory master; persist identity, classification, condition and current physical state with controlled transitions. Quantity-based stock needs explicit allocation semantics. |
| AssetPhoto / RequestDocument | Embedded in Asset / Request, optional `dataUrl` | Persist immutable-enough metadata and links; binary private object storage, not data URLs in rows. |
| AssetIssue | Embedded `Asset.issues` | Persist separate issue identity, status, evidence links and history. |
| ActivationEvent | Provider `events`, fixture initial set | Persist registered event master and parent/sub relationship; ad-hoc event context stays on Request unless business decides otherwise. |
| Brand / Category / Area / DC | Fixture `organization.ts` | Governed master records or approved external reference source; do not infer a physical warehouse from an organizational DC. |
| Vendor / RegisteredLocation | Fixtures `vendors.ts`, `registered-locations.ts` | Governed master records; one Vendor has many workshop locations. Preserve destination ID and historical address snapshot as needed. |
| Person | Provider `people`; `src/types/identity.ts` | Persist organizational profile/roles/scopes separately from login identity. |
| Booking Request | Provider `requests`; `PrototypeRequest` | Persist request, actor, usage context, dates, status and immutable transition history. |
| RequestItem | Embedded `Request.items` with stable `id` | Persist as child of Request and link to a physical Asset; do not identify it by Asset ID alone. Custom Booth requirement is on Request, not a fake Asset/RequestItem. |
| FulfillmentGroup / ReturnGroup | Embedded Request groups | Persist group configuration and *RequestItem* membership after ID migration; currently `itemIds` contain Asset IDs. |
| ApprovalAssignment / review history | Provider assignments plus embedded `reviewHistory` | Persist every assignment/cycle and immutable decisions/history; one active assignment per eligible request/cycle. |
| ReturnReceipt | Provider receipts; `requestItemId` canonical | Persist initiated/confirmed/inspected evidence per RequestItem, linked to Request and Asset. |
| MaintenanceRecord / activity | Provider maintenance; Asset legacy summary | Persist lifecycle, asset linkage, optional source receipt/request item/issue, vendor and photo links; acceptance is distinct from vendor work completion. |
| TransferPlan | Provider `transferPlans` | Persist as *plan* only if retained; execution/physical handover needs separately authorized evidence and transition. |
| WbsReference | Provider WBS | Persist manual code and many-to-many Request association; external verification not currently available. |
| FinancialReference | Provider references | Persist manual PR/PO/Invoice number with typed Request/Maintenance owner, actor and update history; not financial ledger truth. |
| AuditEvent | Provider `auditEvents` | Persist server-generated append-only material-action evidence atomically with mutations. |

`src/types/auth.ts` exposes older capability/session types; `src/types/identity.ts` is the newer organizational Person/roles/scopes prototype. They are not yet reconciled with real authentication.

## 4. Persistence Classification

| Structure | Current state | Future treatment and reason |
| --- | --- | --- |
| Entities in §3 | Fixture + in-memory provider arrays / embedded objects | Durable records or governed external masters; preserve identity and historical references. |
| Request/Asset status | Mutable prototype fields | Persist only as controlled state transitions or carefully defined projections; never infer physical receipt from Request status. |
| Reservation | Derived by `src/lib/domain/reservations.ts` from blocking RequestItems/status and operational windows | No separate authoritative reservation row required by current model. Future transaction must lock/check competing windows and commit the RequestItem/window together; an index/materialized projection may aid reads without becoming an independent truth. |
| Availability / eligibility | Combination of Asset status, condition, maintenance/inspection, quantity, and derived reservation conflict | Derived decision for a requested period, not a standalone `isAvailable` truth. `Asset.availability` is currently a mutable fixture/UI hint and needs explicit reconciliation against transitions. |
| Calendar entry | Derived from Reservations and source data in `operational-calendar.tsx` | Read model/query, not a second booking authority. |
| ReportEntry / CSV | `deriveOperationalReport` in `src/lib/domain/reporting.ts`; date-bounded client export | Read projection of Request, Assignment, TransferPlan, Receipt, Maintenance and selected AuditEvent evidence. Do not persist as operational source. Large-scale export may require an asynchronous read-model job, still reconcilable to sources. |
| Review queue, dashboard counts, Asset health/readiness summaries | Computed from provider state | Derived query/read models; can cache with invalidation, never independently mutate. |
| UI filters, search, form draft | Feature-local React state | Ephemeral unless an approved saved-draft requirement exists. |

## 5. Relationship / Foreign-Key Map

```text
Person 1 ── many Request(submittedByUserId), ApprovalAssignment(reviewer/assigner), AuditEvent(actor)
Brand 1 ── many ActivationEvent; ActivationEvent(parentEventId) 1 ── many sub-events
Vendor 1 ── many RegisteredLocation(workshops); Vendor 1 ── many MaintenanceRecord
RegisteredLocation 1 ── many ReturnReceipt(receivingLocationId), destination references
Request 1 ── many RequestItem, ApprovalAssignment, review-history entries, documents
Request many ── many WbsReference via request-reference link
RequestItem many ── 1 Asset; RequestItem 1 ── 0..1 canonical ReturnReceipt per return cycle
Asset 1 ── many Issue, AssetPhoto, MaintenanceRecord, TransferPlan, RequestItem
MaintenanceRecord 0..1 ── Request / RequestItem / Issue; many photo references and activities
FinancialReference many ── exactly one Request OR MaintenanceRecord (typed owner)
AuditEvent many ── one actor and one primary entity, with optional related IDs
```

Current TypeScript does not enforce these as database foreign keys. Asset `location`, `brand`, `category`, PIC and custodian are often free-text, not IDs. Fulfillment/return group `itemIds` are currently Asset IDs despite their name; migrate to stable RequestItem IDs before supporting repeated lines for one Asset. Do not cascade-delete historical operational evidence. Archive/inactivate masters while retaining resolvable IDs and necessary name/address/actor snapshots. Define typed financial-owner integrity rather than an unchecked polymorphic string. Person-to-auth-subject mapping needs a unique, controlled link, but PIC can remain a separate contact snapshot.

## 6. Derived Read Models

Reservation uses half-open operational windows: fallback to usage start/end when pickup/return missing, 00:00 and 23:59 defaults. Pending approval/Needs update are blocking; Draft, Rejected and Cancelled are not. An overdue unreceived item extends its blocking end indefinitely until authoritative receipt. Confirmed receipt supplies actual end. The date/time zone policy is currently mixed (`YYYY-MM-DD`, local `datetime-local` and ISO offsets); later persistence must define operational local zone per Location, UTC instants for events, and unambiguous inclusive usage-day versus half-open logistics-window semantics. The 30-day booth policy counts inclusive usage calendar days, not transit time; enforce again after Fulfillment date changes.

Reports intentionally omit rows without an authoritative parseable date rather than fabricating a timestamp. Their selected audit-derived Issue/Financial rows do not make AuditEvent a universal business ledger. Search, pagination, indexed filters, export limits, and row-level scopes must be designed before production-sized datasets.

## 7. Mutation Catalog

The Provider is the current mutation owner unless noted. Every production command needs authenticated actor, server validation, authorization, idempotency policy and transaction/audit semantics.

| Command family | Current state touched | Mandatory future invariant |
| --- | --- | --- |
| Create/resubmit/cancel Request; edit dates/items/groups | Request, RequestItem, WBS, audit, reservations derived | Recheck brand/event/booth/30-day/budget policy, item eligibility and competing windows on server; preserve item identity and existing receipt links. Much validation currently lives only in `request-flow-screen.tsx`. |
| Assign/reassign/decide review | Assignment, Request status/history, audit | One current reviewer/cycle, exact reviewer authorization, no self-review, compare expected version, immutable decision. |
| Plan transfer | TransferPlan, audit | Plan is not handover; never change physical Asset state from planning alone. |
| Start/confirm/inspect return | Receipt, RequestItem state, Asset location/custody/condition/inspection, audit | Exactly one canonical receipt for RequestItem/return cycle, registered receiving location, confirmation before inspection, replay-safe transition. |
| Create/assign/start/complete/accept/rework/cancel maintenance | MaintenanceRecord, Asset status/condition/issues/photos/history, audit | One active maintenance for an individual Asset; linked return requires confirmed receipt; vendor completion does not equal internal acceptance. |
| Report/resolve Issue; add photo/document | Asset Issue/Photo, Request document, audit | Authenticated actor, immutable evidence reference, safe file limits and authorization. |
| Add/update Person/Event/Asset/master data | Provider arrays, audit | Server-scoped role checks; preserve historical references; distinguish physical Location from organizational scope. |
| Add/remove WBS or PR/PO/Invoice reference | WBS/FinancialReference, owner, audit | Manual/unverified; typed owner, access control, version and idempotency. No external validation implied. |

## 8. Transaction Boundaries

| Atomic command | Records that must commit together | Partial-commit failure |
| --- | --- | --- |
| Request submission/resubmission | Request, stable RequestItems, WBS links, validated operational windows, review history, AuditEvent | Double booking, orphan links, mismatched status/history. |
| Review assignment/decision | Current Assignment, Request status/cycle, history, AuditEvent | Old reviewer can decide or decision visible without history. |
| Return confirmation | Receipt, RequestItem, Asset physical location/custody/condition/inspection, AuditEvent | “Received” with asset still elsewhere, or asset moved with no receipt. |
| Inspection outcome | Receipt, Asset state/issues, AuditEvent | Readiness diverges from inbound evidence. |
| Maintenance creation/acceptance/rework | MaintenanceRecord/activity, Asset state/condition/issues, photo links, AuditEvent | Duplicate active work or falsely available Asset. |
| Master/financial mutation | Record, stable reference/snapshot, AuditEvent | Unattributed operational or financial change. |

Blob upload and notifications cannot share a database transaction: stage/upload, validate and commit metadata, then finalize/clean orphaned objects with idempotent retries; queue external side effects after commit, not before. Client retries must use command idempotency keys, not timestamp/random IDs as a substitute.

## 9. Concurrency Risks

| Operation | Risk / severity | Future protection |
| --- | --- | --- |
| Two Request submissions or date edits for same Asset/window | **P0** double booking; UI precheck is a race | Transactional conflict check with per-asset/period serialization or DB exclusion/advisory locking; quantity-aware allocation constraints. |
| Two return confirmations for one RequestItem | **P0** duplicate receipt or competing physical location | Unique canonical receipt key per cycle, expected-state compare, idempotent command and one transaction. |
| Two active maintenance records | **P0** conflicting readiness/condition | Unique active-per-Asset constraint and transactional create/transition. |
| Reviewer reassignment races decision | **P0** unauthorized/stale final decision | Compare assignment/cycle/version in transaction; one active assignment; immutable decision record. |
| Request resubmission replacing item IDs | **P1** receipts/evidence link wrong line, especially repeated Asset IDs | Stable RequestItem identity and explicit line diff/migration, not match by `assetId`. |
| Asset/Person/Event/reference edits | **P1** lost update and stale scope/master data | Version or `updatedAt` compare, conflict response, archive semantics. |
| Media upload/retry | **P1** duplicate or orphan evidence | Object checksum/key, idempotent metadata creation, cleanup and retention policy. |

`PrototypeProvider` currently updates several arrays via independent React setters; this is not atomic and cannot protect multiple browsers. A database transaction plus uniqueness/locking and server-side validation is required, not merely an optimistic UI state update.

## 10. Identity / Auth Migration

`Person` is an organizational record (roles, brand/category/area/DC scopes, optional vendor, active status); `currentUserId` can be switched in the prototype profile. `src/lib/fixtures/current-user.ts` seeds a demo identity; no verified session exists. Map future verified auth subject to exactly one controlled Person where appropriate, verify active status and scopes server-side, and snapshot name/role at material events. Migration must match legacy names/emails manually where ambiguous, never treat a contact string as a verified account.

**Current User != Origin PIC automatically.** Request `submittedByUserId` represents actor for new submissions, while `contact`, `siteContact`, Asset `responsiblePic`, `currentCustodian`, receipt `initiatedBy`/`receivedBy` and legacy Request `approver` are distinct contact/evidence fields. Existing fixtures may lack `submittedByUserId`; do not backfill from PIC by guesswork. Origin PIC can default to account contact in the UI without becoming the authenticated actor or a mandatory same-person rule.

## 11. Authorization Enforcement Points

Prototype checks include profile-based role/scope display, Super Admin reviewer assignment, active internal reviewer decision checks, self-review prevention, and Super Admin financial-reference guard. Some actions such as Person/Event edits rely substantially on UI controls; all guards can be bypassed by manipulating client state. Future server commands must enforce actor identity, role, scope, record-level access, expected state and audit; reads/exports/media URLs need the same scope discipline. Provider/adapters or database policies may provide defense in depth, but never replace server domain authorization. **No production RBAC was implemented.** Final role matrix, approval routing and privileged break-glass rules remain business decisions.

## 12. Media Architecture

Asset photos and Request floor-plan/loading letters use embedded metadata and optional browser `dataUrl`; maintenance before/after IDs point to Asset.photos. There is no durable blob store. Upload UI has a 5 MB limit, but file/MIME/size checks are not yet authoritative server checks. Generic fixture photo IDs (`front`, `detail`) repeat across Assets; globally unique media identity must include owning Asset or new generated ID. Issue evidence can reference `detail` without verified blob existence. Editing/deleting gallery entries could break historical Issue or Maintenance evidence; preserve immutable/versioned evidence metadata and object retention through the lifecycle. Store binary privately in object storage and only metadata, checksum, owner, uploader, timestamp, purpose and storage key in relational data. Define access policy, virus/content checks, allowed types, maximum size, signed access and orphan cleanup before production. The accepted ADR names Supabase Storage as future initial provider, but this slice installs none.

## 13. External Integration Boundaries

WBS is a manual reusable reference linked to Requests; whether/when it is mandatory is unresolved and must not become universal by inference. Budget code is a separate Request field. PR, PO and Invoice are manual, unverified references owned by Request or Maintenance; AssetHub is not an ERP or finance ledger and has no SAP validation. TFM/MARS, SAP, SSO, notifications and external event/master feeds are not integrated. Decide ownership, authority, refresh/reconciliation and failure behavior with system owners before designing APIs. Future outbound notifications and synchronization must be post-commit, idempotent and observable; failed integration must not silently roll back a valid physical receipt or produce a false approval.

## 14. Legacy / Compatibility Data

| Fallback / data | Classification | Required disposition |
| --- | --- | --- |
| Missing Asset `classification` defaults to `ASSET` | Migration required | Classify existing records explicitly; review `INVENTORY` exceptions. |
| `Asset.maintenance` summary and `blockedRanges` fixture flags | Migration required | Reconcile to MaintenanceRecord / authoritative blocking source; do not double count. |
| Completed/Return due/Inspection pending Request status without a receipt | Safe to retain as historical label; **manual reconciliation** for physical truth | Do not infer receipt, location or inspection from label. |
| Legacy ReturnReceipt ID is request+asset; canonical `requestItemId` now present | Migration required; ambiguous duplicate asset matches = manual reconciliation | Normalize only uniquely matched lines; preserve unresolved record for review. |
| Legacy Requests without `submittedByUserId`, `eventId`, `reviewHistory` or operational dates | Migration required / unknown actor | Preserve snapshots; do not invent actor, event or exact pickup time. |
| Legacy `approver` string vs ApprovalAssignment | Migration required | Keep historical label but do not treat as current authorized reviewer. |
| `FulfillmentGroup.itemIds` / `ReturnGroup.itemIds` storing Asset IDs | Migration required | Rewrite to RequestItem IDs after disambiguation. |
| Mixed free-text Asset location, custodian and destination | Manual reconciliation | Map to registered Location where provable; retain historical raw value. |
| `AssetPhoto` fixture IDs and optional `dataUrl`; missing evidence objects | Migration required / unknown | Namespace IDs and verify evidence existence. |
| `lastUsed` human text and historical date strings | Safe to retain display; migration required for queries | `lastUsedAt` only when source trustworthy; `authoritativeOccurrence` rejects undated/invalid report entries. |
| ID generation from max Request suffix, timestamps/random, and hardcoded photo/issue IDs | Migration required | Use collision-resistant server identity and imported legacy-key mapping; no silent overwrite. |

No fixture should be copied blindly into production. Establish source provenance, uniqueness, referential checks, reconciliation queue, rollback plan and acceptance sampling. Hard delete is inappropriate for referenced Assets, People, Locations, Events, evidence, receipts and decisions; retention/privacy periods require policy.

## 15. Data Migration Sequence

1. Approve unresolved business rules and data ownership; define environments, roles and retention/privacy policies. Use the accepted infrastructure ADR without adding unapproved provider features.
2. Inventory/clean master data and legacy IDs; assign stable IDs for Person, Brand, Category, Vendor, Location, Event hierarchy, Asset and media references. Resolve physical Location versus organizational DC.
3. Model verified auth-subject ↔ Person mapping and server authorization boundary; define actor snapshots and access tests before exposing mutations.
4. Establish canonical transactional records in dependency order: Request → RequestItem → group membership/WBS → ApprovalAssignment/history → ReturnReceipt → Issue/Maintenance/TransferPlan → financial references/AuditEvent. Keep Custom Booth as requirement, not Asset.
5. Import and reconcile legacy records, particularly ambiguous receipt/item relationships, missing actor/physical location, statuses and photos. Keep source keys and an exception register.
6. Move business validation and physical transitions behind authenticated server commands; enforce booking, duplicate-receipt, active-maintenance and reviewer-race constraints with transactions/idempotency.
7. Migrate media with metadata/evidence integrity and private access; stage external adapters only after owners/contracts are approved. Build derived calendar/report/search queries from persisted sources.
8. Parallel-run controlled test fixtures, contract/invariant and concurrency tests, authorization tests, reconciliation reports and rollback drills; only then consider cutover.

No migration, schema, RLS, storage bucket or credentials are created by this document.

## 16. Production Risk Matrix

| Priority | Risk | Exit condition before real operations |
| --- | --- | --- |
| P0 | All mutations session-only; client actor/validation trusted | Durable server commands, verified auth, server authorization, audit and transaction tests. |
| P0 | Concurrent booking/return/maintenance/review races | Database constraints/locking, expected versions and idempotency proven by multi-client tests. |
| P0 | Request status or plan mistaken for physical truth | Receipt/execution evidence defined and required for location/custody transition. |
| P1 | Broken RequestItem, group, photo and legacy foreign-key links | Stable identity, import reconciliation and historical references. |
| P1 | Data URLs, mutable media and privacy leakage | Private object storage, metadata/evidence retention, access and size/type validation. |
| P1 | Incomplete actor/role/scope and external master authority | Auth mapping, RBAC decision, source ownership and scope tests. |
| P2 | Client-only reports/CSV and broad searches degrade | Indexed bounded queries, pagination, asynchronous export thresholds. |
| P2 | Mixed dates/timezones and fixture-age text | Explicit temporal policy, reliable timestamps and migration checks. |

Environment separation must include separate secrets, data and storage, least-privilege access, repeatable migrations, backups/restore exercises and operational monitoring. None exist in this prototype. Retention, PII (People/contact details) access and deletion/archive policy are unresolved. Current tests cover prototype behavior, not multi-client transactions, security or data recovery.

## 17. Open Business Decisions

- Who enters WBS, and in which request contexts is it mandatory? What is its external system of record?
- Final role/scope matrix, approver selection, delegation/reassignment and emergency override; no approver may be invented by architecture.
- Exact authority for registered Event/Vendor/Location/Brand/Asset masters and sync/reconciliation ownership.
- Quantity-based asset reservation and return unit tracking, partial receipts, substitutions and multiple return cycles.
- Transfer execution/handover proof, custody acceptance and how it differs from inbound ReturnReceipt.
- Whether a Custom Booth requirement has additional build/approval/cost lifecycle; it must not become a fake Asset.
- Retention, legal hold, immutable evidence, privacy, consent, archiving and acceptable file types/sizes.
- Time zone and date precision for cross-region operations and the treatment of missing legacy times.
- Finance reference validation/ownership and SAP/TFM/MARS integration scope; no ledger authority in AssetHub now.

## 18. Recommended Next Implementation Slice

**Persistence Foundation**: establish canonical relational schema and authenticated server-side command boundaries for the minimal Request/RequestItem/Asset/reservation path, with transaction and concurrency tests, while preserving the UI contract. It comes first because all subsequent workflows depend on stable identity and authoritative booking. It must **not** include final approval routing, broad external integrations, notifications, media migration, or unrelated UI redesign. Before implementation, resolve the business decisions that affect schema/commands and use the already accepted ADR as a constraint, not as evidence that any provider is configured.

## Evidence and validation scope

Primary code: `src/features/prototype/prototype-provider.tsx`, `src/features/requests/request-flow-screen.tsx`, `src/lib/domain/{reservations,returns,maintenance,approvals,events,reporting,audit,financial-references}.ts`, `src/types/{prototype,identity,auth}.ts`, `src/lib/fixtures/`, `src/features/operations/operational-calendar.tsx`, `src/features/reports/report-screen.tsx`. Product/domain references: `../domain/` and `../engineering/ADR_001_BACKEND_AUTH_STORAGE.md`. This is a static architecture audit of the current working tree, not proof of a deployed production system.
