# AssetHub — Inventory Partial 1: Gate 0 Approved Plan

**Date:** 28 October 2026, Asia/Jakarta  
**Status:** Approved D01–D07 and T01–T05 reconciled; planning finalized. **Implementation is not authorized.**  
**Deliverable boundary:** This document only. No Gate 1–5 work, migration creation/application, uploads, restores or database-writing tests.

> The status above records the original planning task, not the current delivery state. For implemented behavior and verification, read [Gate 1](INVENTORY_GATE1_DURABLE_FOUNDATION.md) and [Gate 2–4](INVENTORY_GATES_2_4_IMPLEMENTATION.md). The approved decisions below remain the scope reference.

## Authority, evidence and reconciliation

The latest “Gate 0 Architecture Approval & Planning Finalization” and consolidated Inventory Partial 1 briefs govern this slice. This document is the authoritative execution plan for Partial 1. Earlier registration proposals are superseded, not implemented. The initial Inventory audit is historical evidence, not a current completion claim; these documents are kept in the local handover archive rather than the active repository. Follow AGENTS.md, AI_GUIDE.md and docs/00_README.md, with the latest explicit approvals resolving this slice's previously deferred decisions.

Reuse the existing architecture; do not restart M1-E–G or replace working catalog, contact, vendor, booking, identity or media-read implementations. Current M1-D trusted-cookie/canonical-Person behavior takes precedence over historical fixture/header descriptions in the M1-A policy document. HeroUI v3 and existing tokens/layout remain mandatory when UI implementation is separately authorized.

Read-only verification during this task:

| Check | Observed result |
| --- | --- |
| Repository/package | `.`, `assethub-v2`; dirty tracked files and untracked contact/editor/request work preserved |
| Database | Loopback `assethub_dev`, PostgreSQL 17.11; inspection transaction explicitly read-only, repeatable-read, then rolled back |
| Counts | 1,073 assets; 713 registered media; 5 internal contacts; 2,129 asset/PIC links; 405 booking assets; 8 requests |
| Existing group/owner schema | No Asset Group or standalone Owner relation in asset_master/contact_core |
| Migration inventory | On-disk files 0001–0010; all ten checksums match ledger |
| Provenance | 0001–0007 observed_historical; 0008–0010 executed. Observed history is not execution proof |
| Decoder | sharp 0.35.3 installed transitively, not a direct application dependency |

Counts are this read snapshot. Media byte integrity, full-table manifests, source/restore equivalence, browser behavior and test outcomes were not re-certified here. No backup/restore or business command ran. Existing audit test results must not be relabeled as results for this plan.

| Decision | Final treatment; old recommendation replaced where applicable |
| --- | --- |
| D01 | Shared internal contact master, separate Owner/PIC relationships. Owner text-only is not sufficient for new registration |
| D02 | Name, category, brand, warehouse type/location, eligible Owner/PIC, condition and actual primary photo required for new registration; legacy incompleteness preserved |
| D03 + T01 | Optional group, at most one per individual, explicit membership; create with first member or join existing; one registration creates one individual |
| T02 | Active canonical StoreDev/Super Admin may create group only through registration; group assignment/membership edits and legacy attachment/reparenting deferred |
| D04 | Individual/quantity 1, flexible existing valid stock unit; no automatic Set decomposition or global conversion change |
| D05 + T03 | Real primary Asset Photo mandatory; JPEG/PNG/WebP, max 6 files, 10 MiB/file, 30 MiB total, 40 MP decoded. Optional-photo core cannot be activated as registration |
| D06 + T05 | Valid internal or active/verified vendor warehouse; vendor-contact availability is not a registration condition. Booking destinations remain unchanged |
| D07 + T04 | Server timestamps, optional calendar receivedDate, decimal value with explicit currency, event/project reference, notes. No production date or PO/Invoice input |

## A. Architecture overview

```text
Canonical local actor (existing identity_core.people + trusted HttpOnly cookie)
  → existing StoreDev/Super Admin asset-command boundary
  → strict registration intent + validated private photo bytes
  → one relational transaction:
       optional Asset Group → explicit Individual membership
       standalone Owner relationship / existing standalone PIC relationships
       existing canonical asset + exact warehouse FKs
       logical documentation + existing binary media associations
       held booking.assets projection + asset audit + registration receipt
  → canonical read projection → existing provider / Detail / gallery / history
```

### A1. Sources of truth and relationship resolution

| Concept | Existing or proposed authority |
| --- | --- |
| Individual Asset | Existing asset_master.assets, text stable ID; payload plus existing location FK columns. Every new record is ASSET / Individual / quantity 1 |
| Asset Group | Proposed asset_master.asset_groups; stable UUID/name, one Owner contact, one managing-PIC contact. No physical state, booking row, UoM sum or allocation |
| Membership | Proposed asset_master.asset_group_memberships; asset ID unique, group ID explicit. Only created for new manual individual at registration |
| Standalone Owner | Proposed contact_core.asset_owner_contacts; at most one direct owner per asset |
| Standalone/legacy managing PIC | Existing contact_core.asset_management_contacts; ordered multi-contact links retained. New standalone registration requires at least one; group has exactly one shared PIC |
| Shared business contacts | Existing contact_core.internal_contacts. Active ID resolution only; no email linking, identity creation, new department/role eligibility filters or master update through asset commands |
| Group-member effective Owner/PIC | Group FKs only. Do not materialize a competing live Owner/PIC assignment on each member |
| Storage location | Existing internal warehouse text FK OR vendor/warehouse UUID pair. Group membership never changes either |
| Vendor contacts | Existing vendor_master contacts/warehouse links; display when available, no mandatory contact or implicit internal-PIC mapping |
| Documentation | Existing media bytes/metadata/associations plus proposed logical asset_photos revisions. Category, caption, identity and history belong to the logical photo, not a globally shared binary object |
| Audit/history | Existing asset_master.audit_events for immutable command evidence; safe business-history projection. No generic event store |
| Booking compatibility | Existing booking.assets, same individual ID, unavailable + inspection hold. No group booking or new lifecycle command |

Existing `OutboundDispatch.groupId` and booking.request_groups are fulfillment groups, not Asset Groups. Existing Whole/Component metadata is descriptive, not membership. Asset Setup/Setup Template in ASSET_MODEL.md is a reusable suggested combination that does not own assignments; it is not reused as this group model.

### A2. Inheritance, compatibility and history

For grouped records, return a computed assignment projection with `source:'group'`, group ID/version and current contact records; for standalone records, `source:'asset'`. Legacy unresolved owner strings remain a clearly labeled source fallback, not a guessed relationship. Existing multi-PIC arrays remain arrays.

Group creation and membership are immutable through this slice's supported APIs. Joining an existing group never accepts replacement Owner/PIC intent. If an inherited contact is now inactive, retain existing group/member references on reads and reject new registration into that group; do not create a replacement contact or offer a deferred reassignment command.

Record assignment IDs, source and relevant group version at registration so history explains what was applied then. Current channels resolve from master; historical registration evidence must not be reconstructed from today's master values. Existing master update/deactivation endpoints are not added here; controlled clone fixtures can test changed master data.

No existing asset is attached, regrouped, split, reclassified, normalized or backfilled. Membership changes on existing assets are not hidden inside metadata PATCH. Imported assets may later receive an explicit Owner selection through permitted metadata editing while original source owner strings remain unchanged.

## B. Database migration plan

### B1. Proposed objects and constraints

These are designs, not migration files. Keep existing tables and historical SQL intact.

| Proposed object | Fields, constraints and purpose |
| --- | --- |
| asset_master.asset_groups | `id uuid PK`, nonempty `name` (max 250), `owner_contact_id uuid NOT NULL`, `managing_contact_id uuid NOT NULL`, both FKs to contact_core.internal_contacts RESTRICT; `version integer NOT NULL DEFAULT 1 CHECK >0`; created/updated actor FKs to identity_core.people RESTRICT; timestamptz created/updated. Owner and PIC may be equal. Name is not globally unique |
| asset_master.asset_group_memberships | `asset_id text PK/FK asset_master.assets RESTRICT`, `group_id uuid NOT NULL FK asset_groups RESTRICT`, canonical joined_by FK, joined_at timestamptz. PK gives max one group. Index `(group_id,asset_id)` for members/counts |
| contact_core.asset_owner_contacts | `asset_id text PK/FK assets RESTRICT`, `contact_id uuid NOT NULL FK internal_contacts RESTRICT`, assigned_by FK, assigned_at timestamptz. Index contact_id. Existing unknown owners require no row |
| asset_master.registration_receipts | `key uuid PK`, actor text FK People, versioned SHA-256 fingerprint, asset_id text UNIQUE FK assets, created_at timestamptz. One stable registration receipt; no booking request FK or expiring signed URLs |
| asset_master.asset_photos | `id uuid PK`, asset_id and object_key, logical category Asset/Condition, supported view, optional caption, `is_primary`, revision, nullable predecessor ID, superseded_at, recorded actor/time. Compound FK `(asset_id,object_key)` to existing asset_media; revision >0, max one direct successor per predecessor, partial UNIQUE asset_id for active primary. Index `(asset_id,created_at,id)` |
| asset_master.documentation_receipts | UUID command key PK, canonical actor FK, asset FK, versioned fingerprint, logical result-photo IDs and timestamp. Separate from registration/booking receipts; supports exactly-once documentation retries |
| Existing asset_media | Relax `source_cell` to nullable for manual associations; add defaulted association origin if needed to distinguish new manual vs existing import. Preserve every imported cell value and reference; no fake spreadsheet cell |
| Existing audit_events | Reuse unrestricted action text and JSON changes for REGISTER_ASSET / EDIT_METADATA / documentation changes. No new group-audit subsystem because group-wide changes are deferred |
| Asset payload additions | Typed optional manual registration provenance, legacy reference, registration metadata and declared condition notes. Imported payloads remain unchanged; no fabricated importInfo |

Photo predecessor must refer to the same asset; enforce through a composite key/FK or a narrowly scoped integrity constraint. A primary must be an active Asset-category photo, never a Condition-category substitute. Use NOT NULL/default compatibility only where it does not fabricate imported photo attribution. Uploader/time live on new logical records; do not assign a fake uploader to old media.

Cross-table invariants: a grouped asset has no direct Owner/PIC relationship competing with group inheritance. Serialize membership/relationship writes on the asset row and enforce the exclusion with narrowly scoped deferred constraint triggers on membership, standalone-owner and existing managing-contact writes. Do not scan/rewrite all historical assets or impose new registration completeness on them. Active-contact checks and “one or more new primary photos” are command-time rules, not ordinary FK promises.

Membership mutability is restricted by command allowlists: registration creates only new manual asset membership; PATCH cannot add/change/remove it. Do not pretend a FK alone enforces this product boundary. No UPDATE/DELETE group-management route exists. Physical deletion remains excluded and FKs use RESTRICT.

### B2. Stored metadata and compatibility

- Existing non-null `source_key`: `manual:<server-generated asset ID>`; source_hash is a documented digest of normalized manual registration intent, not a workbook hash. Source JSON identifies manual provenance, actor/time/schema version/command key.
- Keep system ID and display code stable. Store optional legacy asset number separately; trim outer whitespace, preserve case, allow duplicate names/references without merging or overwriting. No new global uniqueness constraint.
- Payload `registrationMetadata`: `receivedDate` as valid YYYY-MM-DD calendar date; `assetValue` as null or `{amount: decimal-string, currency: explicit-code}`; optional `eventProjectReference`, `additionalNotes`. Use bounded decimal-string validation (no JS floating-point arithmetic), e.g. up to 18 integer/6 fractional digits; reject malformed representation, do not default currency/zero or perform conversions. Currency is explicit uppercase three-letter representation, not a claim of external finance validation. Limits are technical validation choices; no financial business rule is introduced.
- created_at/updated_at and audit instants come from the server/database. Display operational instants in Asia/Jakarta; do not timezone-shift receivedDate or reinterpret existing booking timestamps.
- Existing producedAt/lastUsed unknown representations remain unknown. Do not copy receivedDate or registration date into them. No PO/Invoice, event-date-meaning or production-date input added.
- Existing catalogRevision is optimistic concurrency token. New/manual durable records must use it; group version is returned for inherited-reference context, not a new editable group API.

### B3. Migration order and recovery

Current inventory ends at 0010 and ledger checksums match. **0011/0012 are candidate names only, not reserved**; recheck immediately before creating approved SQL.

1. Candidate `<next>_asset_registration.sql`: group/membership/Owner/receipts, exclusion constraints/indexes and private privileges.
2. Candidate `<next+1>_asset_documentation.sql`: logical photos, source-cell compatibility, history lookup index if existing indexes do not cover `(asset_id,occurred_at,id)`.

Enable RLS/revoke public/browser privileges on new tables, following existing private-schema practice. Do not change global RLS/auth settings. Keep booking.assets legacy-only IDs valid; do not add a universal FK to catalog or a global quantity/classification constraint.

Migration execution uses a focused checksum/target/provenance-aware operator entry point, not scripts/booking-db.mjs or importers. Each migration records executed provenance only after successful transactional application. Historical observations retain their original status and checksum. Verify M0 source/restore manifests before active application. Never append a migration execution receipt during this planning task.

Rollback prefers disabling incomplete new submit paths and forward correction. Preserve new records, additive schema, history, receipts and media. Do not drop tables, restore over active data or remove old migrations automatically. Reversing code must not restore misleading session-only registration success. Keep schema readable by previous clients and permit old metadata requests without new fields.

## C. API and command contracts

### C1. Registration request

Proposed **POST /api/assets**, Node runtime, bounded multipart request with one JSON intent part and image parts. One command creates one individual. Illustrative JSON intent (not application code):

```json
{
  "commandKey": "<UUID>",
  "asset": {
    "name": "Wall A",
    "legacyReference": "A-1.1.1",
    "brand": "All Brand",
    "category": "Supporting asset",
    "classification": "ASSET",
    "trackingType": "Individual",
    "quantity": 1,
    "unitPolicy": {"stockUnit": "Unit"},
    "condition": "Needs review",
    "conditionNotes": "Recorded condition; verification pending",
    "description": "Individual asset description",
    "location": {"kind": "internal", "warehouseId": "<existing text ID>"},
    "group": {"mode": "standalone"},
    "ownerContactId": "<active contact UUID>",
    "managementContactIds": ["<active contact UUID>"],
    "metadata": {
      "receivedDate": "2026-10-28",
      "assetValue": {"amount": "1250000.00", "currency": "IDR"},
      "eventProjectReference": "Optional reference only",
      "additionalNotes": "Optional notes"
    },
    "photos": [{"partId": "photo-1", "category": "Asset", "isPrimary": true, "view": "Front", "caption": ""}]
  }
}
```

Group variants:

| Mode | Required intent / server behavior |
| --- | --- |
| standalone | Explicit Owner ID and nonempty ordered managingContactIds; resolve active business contacts, insert separate relationships |
| create | `group:{mode:'create',name,ownerContactId,managingContactId}`; no competing top-level assignments. Create group and first member in the same registration transaction |
| existing | `group:{mode:'existing',id,expectedVersion}`; no supplied Owner/PIC replacements. Lock exact group, validate version and active inherited contacts, add only new member |

Vendor location variant supplies `{kind:'vendor',vendorId,warehouseId}`. Server resolves exact matching FK pair and warehouse active/address_verified. **No active-contact existence predicate.** Parent vendor is resolved by ID; this command does not silently add borrowing-destination predicates or mutate vendor status. Valid internal row is sufficient; no invented internal active flag/address requirement. Unknown address/contact is displayed honestly.

Required fields are explicit typed selections, not trusted text snapshots. Existing valid default brand/category values can remain, but server validates allowed vocabulary. Canonical condition is Good/Fair/Needs review; Poor is rejected. Stock units use existing Pcs/Unit/Set/Dus/Box/Pack/Roll/Meter values. Quantity stays exactly 1 and package conversions are excluded from this command. Existing global conversions are unchanged.

### C2. Authorization and transaction

Reuse existing resolveServerActor/operationalVendorActor local-only contract, active canonical People, and confirmed StoreDev/Super Admin rule. Same guard permits group creation within registration under T02. Directory selection remains restricted to those roles. No prototype actor headers, scope-inferred permissions, default identity, provider activation or permission from asset assignment.

1. Validate local cookie/origin/listener boundary, approved role, bounded multipart intent and actual image content. Prepare staged bytes/digests without a long DB transaction.
2. Normalize intent plus ordered validated photo hashes/metadata; compute versioned fingerprint including canonical actor ID and mode. Unknown state/actor/history/status fields are rejected, not spread into payload.
3. Begin transaction, advisory-lock command key, inspect receipt. Reauthorize on every call including replay. Matching actor/fingerprint returns original ID; mismatch is conflict, no leakage of another actor's asset.
4. Lock active actor, optional existing group, referenced warehouse/vendor/contact rows in consistent order. On normal edits lock asset before its relationship operations; new registrations use fresh IDs. Define a documented shared lock order in implementation to avoid contact/group/asset deadlocks.
5. Generate stable `asset-<UUID>` ID; insert asset, optional new group/membership, standalone relations or inherited-assignment evidence. No direct relationship copies on members.
6. Insert booking.assets projection with same ID, ASSET, Individual, availability_hint unavailable, inspection_hold true, available_quantity 1, no active maintenance/issues. Stock count one is not borrowable quantity. A projection collision fails the transaction, not ON CONFLICT DO NOTHING.
7. Under sorted media-key serialization, ensure durable final bytes; insert/reuse verified binary metadata and associations/logical photos. Write registration audit with group/assignment source, photos and initial state; insert receipt; commit.
8. Serialize canonical read with joined references/revision and fresh signed URLs. Return 201 `{asset,commandKey,replayed:false}`; replay may return 200 with same identity and current canonical state, replayed true. Never persist expiring URLs as receipt authority.

Relational failure rolls back asset/group/member/contact/projection/photo/audit/receipt together. Filesystem is not a PostgreSQL transaction participant: bytes must precede reference commit; safe unreferenced files can remain for report-first cleanup. A timeout after commit is an unknown outcome resolved by same-key retry, never a compensating delete/new key.

### C3. Retrieval, editing and history

| Route/command proposal | Contract and compatibility |
| --- | --- |
| GET /api/assets (existing) | Preserve `{assets,internalWarehouses}`. Add optional group/owner/registration metadata fields and effective assignments; imported contracts still work. Shared serializer derives revisions and signed media URLs |
| GET /api/asset-groups (new, narrow) | StoreDev/Super Admin selector projection: ID/name/version/current Owner/PIC and member count; no group mutations or full People directory |
| GET /api/asset-registration-locations (new) | StoreDev/Super Admin registration-specific eligible internal/vendor projection. Contacts optional; no change to `/api/vendor-locations` booking rules |
| PATCH /api/assets/[assetId] (existing) | Keep revision/transaction/error contract. Add explicit standalone owner selection and approved optional metadata. Omitted new fields preserve old data. Group/member/assignment mutation rejected; identical inherited IDs may be accepted as no-op for compatibility, never converted to direct links |
| POST /api/assets/[assetId]/photos (new) | Existing asset metadata-command role boundary, revision, command key and validated files. Add documentation or supersede an explicit logical photo; no binary deletion. Does not change condition/readiness, assignment or location |
| GET /api/assets/[assetId]/history (new) | Existing catalog-read actor boundary; allowlisted business events with stable event ID, source, kind, occurredAt and safe attribution. No raw audit JSON/technical payload dump |
| GET /api/assets/media/[key] (existing) | Existing cookie + signature + expiration + regex + registered-key check; preserve authenticated private access |

For documentation retries after registration, use a separate documentation-only receipt table in the media migration (UUID key, actor, fingerprint/version, asset ID, result logical-photo IDs, timestamp). Do not reuse registration or booking receipts for incompatible command kinds. Replays must not create a second supersession/history event. Preserve original revision conflict protections; success returns canonical photos plus fresh asset revision.

Asset metadata editing does not become an operational condition/location update. New required fields apply at registration, not as a forced repair of all legacy records. Existing legacy empty/multi-PIC behavior is preserved; standalone Owner replacement is explicit ID selection, no email matching. Grouped fields display inherited/read-only and cannot activate the deferred group reassignment operation.

Failure contracts: existing auth `{error:{code}}` and status semantics remain; business errors use existing `{code,message}` conventions with additive fieldErrors for new commands. Validation 400; forbidden 403; missing entity 404; stale revision/key conflict 409 using existing STALE/CONFLICT; body/file limits 413; unsupported media 415; existing disabled/unconfigured local boundary 404/503 as currently defined. Unexpected DB/storage errors sanitized without secret/path/PII logging. Recoverable errors preserve draft; no success before commit.

### C4. Media write contract

- Exactly one primary Asset Photo in a new registration, at least one actual Asset image. Condition photos are separate optional evidence, not an alternate primary or inspection.
- 1–6 total actual images, JPEG/PNG/WebP only, <=10 MiB/file, <=30 MiB bytes aggregate, <=40,000,000 decoded pixels per image. Request overhead also bounded; enforce file/total limits while reading, not after unlimited buffering.
- Treat filename/client MIME as hints only. Verify byte content, successful bounded decoding and dimensions before acceptance. Reject corrupt/truncated images, SVG, executable/HTML and unsupported/animated multi-frame content; this is a conservative supported decoder profile, not a readiness policy.
- Adopt installed sharp 0.35.3 as an explicit direct dependency during the authorized media slice if compatibility verification passes; update package/lock deliberately. Do not rely on Next's transitive version or install anything during planning. No dependency upgrade is authorized now.
- Store validated original bytes with content hash/derived allowed extension; no silent transformation of evidence. Staging is private, exclusive, path-safe and outside served routes. Sorted object-key locks serialize materialization with any future cleanup. Reuse an existing object only after hash/size/MIME agreement, never overwrite it.
- Fsync/atomic publish final bytes before committing DB associations; private command manifest records upload-created paths for recovery. Validate master references before final materialization when practical. Always remove owned staging files safely; final orphan binaries may be retained on uncertain failure.
- Supersession creates new logical photo/revision, marks predecessor superseded, updates current selection and writes audit in one transaction. Primary replacement supersedes old primary and installs the new one atomically. No delete endpoint, automatic janitor or removal of imported evidence.
- Imported images remain compatibility reads without backfill. Explicitly replacing an imported photo records its stable source-photo identity in supersession metadata; preserves its existing payload/source/link/bytes and overlays the new current-gallery selection. History can retrieve historical signed documentation. No fabricated historical uploader/date.
- Report-only orphan reconciliation distinguishes command-created objects from pre-existing/shared/imported bytes; deletion is separately authorized, locked and rechecked. Missing SQL association alone never proves a file is safe to remove.

## D. Existing UI integration

Preserve the four stages, current HeroUI components and shared styling. No unrelated navigation, Request flow or Inventory redesign.

| Stage | Fields / controls | Reuse/adaptation |
| --- | --- | --- |
| 1 Basic information | Optional group: standalone / create / select; individual name; optional legacy asset number; category/brand; warehouse type/location; Owner/PIC | Reuse searchable selects and AssetContactPicker. Add single Owner mode; retain standalone multi-PIC. New group has one Owner/one PIC; existing group shows inherited read-only contacts. No blank Owner/PIC substitution |
| 2 Quantity and units | Individual, quantity 1, existing valid stock unit | Keep stage, render fixed tracking/count. Hide unsupported classification/quantity/package conversion controls only for new MVP registration; do not remove shared unit helpers or change existing records |
| 3 Condition and documentation | Canonical condition, optional condition notes; primary Asset Photo, additional Asset/Condition photos; description; optional received date, event/project reference, value+currency, notes | Replace Poor option with Needs review; add real file input/preview/category/caption. Optional metadata can use existing disclosure composition. No production date, PO/Invoice, event-management or inspection controls |
| 4 Review and submit | Group/assignment source, individual identity, warehouse, qty/UoM, condition, actual image previews, optional metadata | Async submit, pending disabled state, field errors, key-preserving retry. Navigate to persisted ID only after canonical success |

System ID is server-generated and shown after save; legacy asset number is not that ID. Asset/group names and references may repeat; never auto-merge or infer membership. Group choices use IDs.

Update provider registerAsset signature to async restricted intent; use same-origin actorFetch and canonical upsert by ID. The current importInfo-only edit guard must become a durable-record/revision check so manual assets never fall back to session-only edit. Server hydration must include new projection fields and stable catalog ordering without overwriting unrelated session operational state. Do not add localStorage persistence of draft by default.

On errors keep form/draft, selected references and file handles while mounted; expired identity offers recoverable Me selection without silently discarding or submitting under a different actor. A changed actor changes fingerprint authority: reconcile unknown prior outcome before an intentional new submission. Full page reload is not a promise to retain browser File objects.

Edit reuses existing metadata editor: Owner is explicit selector with legacy source fallback; existing PIC multi-select remains for standalone; grouped assignments are read-only and labeled group-derived. Preserve old revision/error and untouched imported fields. Documentation action uses the durable photo command; caption-only prototype actions must not appear as successful persistence.

## E. Asset Detail and History

| Logical section | Existing composition retained / delta |
| --- | --- |
| 1 Asset Information | Existing gallery/name/classification/meta; add group link/label, legacy reference vs system ID, qty/unit, approved optional metadata. Group count is count of member records |
| 2 Status & Condition | Existing status/condition/health composition; declared notes and Condition Photos; explicit missing verification. Aktif, Good, photos and registration do not imply borrowable |
| 3 Warehouse & Location | Existing location facts plus master address/vendor/available warehouse contacts. Explain unavailable/unverified contact/address and recorded location vs physical custody; no master rename interpreted as movement |
| 4 Owner & Contacts | Existing metadata/contact presentation with current Owner and PIC resolved by ID, assignment source “Asset Group: …” or “Asset ini”; vendor contacts separate. Legacy unresolved values visibly retained |
| 5 Asset History | Existing timeline composition backed by business-history projection; source/import, registration, metadata, Owner/PIC and documentation events distinguished. No fake Usage |

History event key/source prevents duplicate rendering of a SQL audit plus an equivalent payload entry. Preserve raw imported payload history and source evidence; reclassify only its display projection as Import/Source when provenance proves import. Do not rewrite historical payloads just to remove the old Usage tag. Unknown kind/date remains labeled unknown source evidence rather than invented chronological use.

New REGISTER_ASSET audit supplies registration and inherited-assignment context. Existing EDIT_METADATA audits produce safe supported correction events; SOURCE_LOCATION_CONFIRMED produces recorded-data correction, not Movement. Documentation events reference logical revisions. Old records lacking reliable actor/time are labeled accordingly; no fake current actor or placeholder production date. Group creation is shown only where applicable; later members show inheritance at their own registration, not retroactive participation in earlier events. Group-wide change events do not exist in this slice.

Keep raw technical audit and restricted governance UI separate. The new history read exposes only the existing catalog-reader-safe business projection, not unrestricted contact directory/identity history. Do not broaden directory selection beyond StoreDev/Super Admin.

Request CTA compatibility is a narrow presentation repair: reflect existing durable ASSET/Individual/qty1 and readiness/issue/maintenance/reservation rules. Do not loosen booking server validation or add mandatory-photo rules to historical booking eligibility. Every new asset remains unavailable with inspection hold even after required photos.

## F. Implementation slices and approval gates

No row below is currently authorized for execution. A named slice approval is required; active migration/application is separately authorized and never inferred from permission to code/test.

| Slice | Objective and exact scope | DB effects / dependencies | Verification / acceptance | Rollback and authorization |
| --- | --- | --- | --- | --- |
| S1 / Gate 1 | Restricted draft validator; group/Owner model; idempotent registration service; canonical serializer; additive relationship/receipt migration; guarded operator | New group/member/Owner/receipt objects only, on isolated PG17 first. Photo contract integrated as a required dependency; no zero-photo shortcut | Standalone/create/join group, required contacts, FK/eligibility, rollback, retry and held mirror tests. Existing rows unchanged | Approve S1 code + isolated tests and fresh M0 recovery drill explicitly; no active schema application. New registration route not activated as complete before S3 |
| S2 / Gate 2 | Existing Add/Edit/provider integration, fixed Individual/1 controls, new metadata/master selectors, group projection and registration-location read | Depends S1 contracts; no extra persistence engine | Component tests for draft/re-auth/pending/revision, legacy multi-PIC and inherited read-only state. No session-only success | Revert only slice hunks; do not restore deceptive session submit. Final submit remains unavailable until S3 passes |
| S3 / Gate 3 | Real media adapter, logical photo/receipt migration, registration multipart + durable documentation command, dependency declaration, gallery revisions | Depends S1; additive media schema; private clone media only | All format/size/decode/crash/storage/transaction/supersession tests; primary required and actual bytes durable. S1–S3 tested together | Approve media writes/isolated DB tests/dependency update specifically. No automatic cleanup. Preserve committed revision evidence on rollback |
| S4 / Gate 4 | Five-section Detail, safe history read/projection, address/contacts, import display classification and CTA alignment | Depends S1–S3 stable read shapes; reuse existing audit, no operational schema | Imported/manual/grouped detail, history dedup/privacy, CTA server alignment; actual desktop/mobile inspection | Revert presentation/projection only; do not delete audit or edit historical source data |
| S5 / Gate 5 | Integrated isolated PG/server/media/browser verification, exact migration/checksum/recovery/preservation report | Complete S1–S4; fresh verified clone and dedicated loopback server | T01–T23 plus security/media/group cases below; restart and second session prove durability | Separate approval for active migration/release. No user-data registration as test, no auto commit/push |

**Dependency:** Gate 2 can develop draft/UI integration with non-mutating mocks, but cannot provide a working success path that omits T03. Gate 1–3 form one deployable registration capability. The media stage is not an optional follow-up anymore. No temporary authenticated zero-photo production/development API bypass.

### F1. Expected file/module inventory

Current files to adapt narrowly:

- `src/features/assets/add-asset-screen.tsx`: four-stage async intent and required fields/media.
- `src/features/prototype/prototype-provider.tsx`: async registration/canonical hydration; durable manual edit guard; no unrelated lifecycle persistence.
- `src/features/assets/asset-editor.tsx`, `src/lib/domain/asset-edit.ts`: Owner/reference/metadata compatibility, group assignment protection, revision behavior.
- `src/features/assets/asset-contact-picker.tsx`: reuse with single Owner/group PIC or multiple standalone PIC mode; preserve current Request consumer behavior.
- `src/features/assets/asset-detail-screen.tsx`, `src/features/assets/asset-metadata.tsx`: five sections, effective contacts, dates/value and projected history.
- `src/components/domain/asset-gallery.tsx`, `src/features/assets/photo-documentation-screen.tsx`: real categorized documentation and supersession; no caption-only durable success.
- `src/lib/server/assets.ts`: shared serializer, canonical revisions, media/history/group/owner joins; existing media read stays authenticated/signed.
- `src/server/contacts/repository.ts`: reuse active resolution; add standalone Owner operations without altering master create/dedupe or existing Request lookup.
- `src/types/prototype.ts`: additive group/owner/metadata/logical-photo/history types; preserve imported optionality and existing events.
- `src/app/api/assets/route.ts`, `src/app/api/assets/[assetId]/route.ts`: new multipart POST and backward-compatible PATCH; existing GET shape retained.
- `src/lib/actor-client.ts`: only necessary new response/error handling, no auth transport redesign.
- `src/lib/fixtures/request-eligibility.ts`, affected Detail/card consumers: small durable-eligibility presentation predicate, no server business-rule change.
- `package.json` and lockfile: explicit existing-version decoder dependency only during S3.

Proposed new modules (not created now):

- `src/lib/domain/asset-registration.ts`, `asset-groups.ts`, `asset-documentation.ts`: typed intents/validation, no provider SDK.
- `src/lib/server/asset-registration.ts`, `asset-groups.ts`, `asset-documentation.ts`, `asset-history.ts`: focused existing-style services/repositories, not a generic command platform.
- `src/server/assets/local-media-storage.ts`: private bounded byte handling and report-first recovery boundary.
- `src/app/api/asset-groups/route.ts`, `src/app/api/asset-registration-locations/route.ts`, `src/app/api/assets/[assetId]/photos/route.ts`, `src/app/api/assets/[assetId]/history/route.ts`: narrow contracts from section C.
- Two candidate migrations described in B; `scripts/asset-registration-db.mjs`, `scripts/test-asset-registration.mjs`: explicit checksum-aware migration and disposable clone verification. Do not invoke the 0010 contact importer unchanged.
- Tests: `tests/asset-registration.test.ts`, `tests/asset-groups.test.ts`, `tests/asset-documentation.test.ts`, `tests/asset-registration-screen.test.tsx`, `tests/server/asset-registration.test.ts`, `tests/server/asset-registration-persistence.test.ts`, `tests/server/asset-documentation-persistence.test.ts`, `tests/e2e/asset-registration.spec.ts`, `playwright.asset-registration.config.ts`.

`src/lib/server/booking.ts`, identity/session/authorization modules, original migrations, source import scripts, Request workflow and vendor destination endpoint are regression references, not planned business-logic changes. Avoid changing shared HeroUI tokens to implement a single new field. Scoped implementation evidence/runbooks may be updated later without reopening locked product decisions.

## G. Test and verification matrix

All entries are planned, **NOT RUN** here. Unit/component tests do not establish PG durability; in-process listener mocks do not establish runtime isolation.

| ID | Scenario | Layer and required evidence |
| --- | --- | --- |
| T01 | Internal standalone registration | PG + API: exact internal FK, Owner/PIC, logical photo, audit/receipt and held mirror |
| T02 | Vendor registration | PG + API: active verified exact vendor pair, both IDs retained; no contact requirement |
| T03 | Missing/inactive/invalid Owner/PIC | Unit + PG: reject new registration; same contact allowed in both roles; canonical channels override forged snapshots |
| T04 | Invalid/mismatched/unverified/inactive warehouse | Unit + PG: reject full transaction; no partial rows; missing internal address stays unknown |
| T05 | Create group with first member | PG: one group and one member atomically, shared references, no direct competing links |
| T06 | Join group / independent members | PG + browser: unchanged group Owner/PIC; individual location/condition/unit/photos/history separate; count is member count, not UoM sum |
| T07 | Duplicate names/references | Unit + PG: distinct intended commands preserve IDs, no merge/backfill/inference; existing imported duplicates still readable |
| T08 | Individual qty/UoM | Unit: exactly 1, all supported stock labels, Set not split; pooled/conversion intent rejected only for new command |
| T09 | Missing primary photo | Unit/API: reject zero files, condition-only or multiple primary intents; no success/partial records |
| T10 | Valid upload | Real media + PG + browser: actual private bytes/digest, association, logical category/view, signed read; URL not public |
| T11 | Upload/resource/failure/orphan | Unit + isolated runtime: corrupt/truncated/MIME spoof/SVG/unsupported frame/over-limit file-count/bytes/pixels; disk/publish/DB failure, safe shared-key reuse, no false photo success or destructive cleanup |
| T12 | Refresh/restart/second session | Actual dedicated Next process + two fresh contexts: cookie re-selection after restart, same durable ID/data/photo; no fixture/localStorage fallback |
| T13 | Retry/concurrent duplicate | Real PG: same key/fingerprint one asset/group/audit/receipt; mismatched content/actor conflict; timeout after commit recoverable; photo replacement replay exactly once |
| T14 | Authorization/security | Gate A/B regressions + actual API: active StoreDev/Super Admin allowed, other roles denied; missing/expired/forged cookies, actor headers, inactive People rejected; trusted origin/listener boundary unchanged |
| T15 | Manual durable edit | Component + real PG: record without importInfo uses API/revision, survives refresh; legacy request payload compatibility |
| T16 | Shared contacts/master changes | Controlled clone data: relationship selection does not edit contact; current contact projection updates; history attribution unchanged; no login permission effect |
| T17 | Warehouse status changes | Clone: old references retained; no implicit movement, vendor contacts optional, new invalid registrations blocked, borrowing destination unchanged |
| T18 | History | Unit + PG/browser: registration/metadata/owner/PIC/doc changes visible once; Import separate from Usage; group inheritance starts at asset registration; no raw audit leak |
| T19 | Initial state | PG/domain: unavailable/inspection pending and booking hold even with Good and primary image; no inspection/receipt/readiness command |
| T20 | Preservation | Full M0 manifests: all original asset/source/contacts/vendors/booking/media/audit unchanged except separately authorized explicit clone operations; no migration backfill |
| T21 | Optional metadata | Unit + PG: leap/calendar validity, decimal/currency pair, unknown amounts, notes/ref round-trip; no event/receipt/finance side effects |
| T22 | Legacy ambiguity | Unit/browser: old owner/multi-PIC/date/value/photo provenance retained; no auto email/group/date conversion or production age fabrication |
| T23 | Concurrent edits | PG: existing revision conflict preserved; photo supersession/metadata races serialized; no double primary or lost assignment |

Additional integrity checks: exclusion constraints reject direct assignment on a member; no reparent/group mutation API; actor is reauthorized on retries; group contact inactivation blocks new member without altering old members. Decode tests use deliberately bounded fixtures, not resource exhaustion against the active server.

Isolation: recheck target/version/private connection, restore verified M0 bundle into an absent generated `assethub_test_registration_<24hex>` database and private media copy, use a disposable source directory (no env-file copy), dedicated build output and loopback listener/origin on an unused port. Fresh Chromium contexts must not reuse the active user's tab/server/cookies. Current media reader uses process.cwd(), so a source copy/media directory is required until a reviewed adapter provides an explicit path. The runner refuses source DB and arbitrary targets even if localhost; cleanup drops only its owned generated DB after closing its sessions, never force-disconnecting active users.

Relevant regressions include existing authorization/actor/session, canonical People, contacts and Request contact snapshot/receipt, asset edit/loading/units, bookings/reservations/approvals and shared picker consumers. Inspect test setup/env variables first; generic npm test/Playwright can opt into writing suites or reuse the active server. Use scoped explicit commands. The audit's clock-sensitive reservations failure must remain reported until a separately reviewed deterministic test correction; do not weaken overdue occupancy to turn it green.

Static checks: typecheck and scoped lint after actual code changes; documentation-only structure/links/diff checks now. Browser at desktop 1440×1000 and mobile 390×844 must inspect all four steps, keyboard/focus, errors/re-auth, long groups/contacts, photo previews, gallery/history and final action clearance above nav. Record actual screenshots/network/console evidence privately. Screen reader/visual-baseline checks are NOT implied by passing automation.

## H. Risks, genuine blockers and execution boundary

| Type | Issue / disposition |
| --- | --- |
| Actual contradiction in earlier plan | Optional/text-only Owner, optional photos and unknown warehouse-contact rule are superseded by D/T approvals; resolved here, not reopened |
| Source-of-truth risk | Group inheritance plus copied direct assignment would conflict. Use relational exclusion and explicit computed projection; no copied live group links |
| Current implementation defect | importInfo-only persistence guard would lose edits for manual assets. Required S2 fix, not a permission change |
| Storage integrity risk | Filesystem+PG not globally ACID; bytes-before-reference, explicit receipts, immutable revisions and safe orphan retention required; no false atomicity claim |
| Operational limitation | An inactive inherited group contact blocks new members; group repair commands are deferred. Report this limitation, do not invent a reassignment permission |
| Technical dependency | Decoder must become deliberate direct dependency and pass isolated format/pixel tests; installed transitive sharp is not sufficient dependency governance |
| Dirty-tree risk | Preserve all existing modified/untracked contact/editor/request implementations; narrow before/after hashes and diffs required, no reset/clean |
| Read/API privacy risk | History/group/location projections must not expose raw audit, unrestricted directory or provider identities; preserve current catalog visibility and restricted selector rules |
| Historical compatibility risk | New mandatory registration contract must not force legacy repairs or invalidate existing booking/media/source records |
| Deferred scope | Group reassignment, membership edits, legacy attachment/reparenting, pooled allocation, operational commands/permissions, readiness activation, auth/shared deployment, PO/Invoice and production date remain excluded |

**No unresolved product contradiction blocks this finalized Gate 0 plan.** Decimal limits, strict decoder profile, endpoint/module decomposition, lock order, indexes and error envelopes are bounded technical implementation choices under existing rules, not excuses for new product approvals. If actual package/runtime/schema verification disproves compatibility during execution, stop with that concrete evidence rather than bypassing security or rewriting data.

Execution prerequisites still outstanding (not completed by documentation): explicit named-slice authorization; fresh verified M0 database/media recovery bundle and isolated restore comparison; final exact target/provenance/migration-number recheck; passing isolated implementation/security/regression/browser gates. These are safety prerequisites, not new permissions or product decisions.

Before any authorized implementation: recheck Git status and file baseline, confirm exact DB privately, review ledger, obtain fresh verified M0 backup, compare source/restored manifests, review exact single pending migration and existing command guards. Active migration/application requires explicit separate approval. Never use migrate-all, import/backfill scripts, destructive reset, broad cleanup/refactor or active DB writing tests.

### Gate 0 delivery and stop boundary

This task creates only `docs/architecture/INVENTORY_APPROVED_PLAN.md`. Earlier audit/plan, application source, SQL migrations, environment/configuration, permissions, business records and media remain unchanged. No implementation test or browser/restore result is claimed. Planning validation checks this document's sections, references and repository file preservation; it is not Gate 1–5 PASS.

**Next action:** separately authorize **S1 / Gate 1 — Durable Registration Foundation** with explicit recovery-drill and isolated-test scope. Keep registration inactive until required S3 photo persistence and combined verification pass. No application/database execution, commit or push follows automatically from Gate 0 planning completion.
