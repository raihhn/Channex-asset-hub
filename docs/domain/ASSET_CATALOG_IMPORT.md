# Local asset catalog import

## Authorized source and mapping

Import only `ALL BRAND (Storedev)` and `ALL BRAND (Gd.Internal)` from the supplied STOREDEV workbook. The import contains 567 external-sheet rows and 506 internal-sheet rows (1,073 records); row identity is stable and separate from potentially duplicate names/codes. Full original cells, cached formulas, notes and photo coordinates remain private provenance. The source workbook is never modified. Other brand tabs are not imported, preventing duplicates from parallel views.

Location follows explicit notes corrections. Storedev row 4 resolves to DGI Jatim; row 18 resolves to Hanuman. Row 45 has no confirmed destination. Rows 47/222 say DGI Jateng; the user explicitly confirmed this means the Dua Garis Imagi Semarang warehouse, so both resolve to its UUID/address. Rows 62/63/397 describe split/partial movement and require the quantity and destination of each part to be confirmed; a component move never silently moves its entire parent set. Row 56 has an explicit latest quantity correction from 2 to 1, retaining original Qty. Internal row 33 is external (Vendor IDEA Project) with no unambiguous branch. Rows 32/358 have missing warehouse information.

Vendor storage resolves to existing Vendor/warehouse UUIDs. Three internal warehouse records are created from actual source locations: Jatake 5, Tanah Asset Yohannes - Kamar 1, and Kamar 2. Their source addresses may be empty; none is fabricated. They appear in the operational location projection alongside database Vendor destinations. Legacy demo locations/assets are retained only to resolve historical fixture records; the real catalog is used for new discovery/selection after import.

`BST-2025`, `BST-2024`, `MASTERSHADE`, and `TANAH YOHANNES - FM` are source event/collection contexts, not item categories. Missing capitalization classification and item category use explicit Unclassified states. Missing brand is distinct from All Brand. Source production/event/usage/received dates remain ambiguous references and do not establish age or last-use dates. Original owners, multi-PIC text, PO/Invoice references and source values remain available in source details, without creating login identities, finance ledgers or verified procurement records.

Wall A/B/C of Totem Skybridge remain three independent IDs with the shared source setup label. Other package-versus-independent relationships are unconfirmed; UoM Set does not establish composition. Multi-quantity source rows are retained as source stock groups, never split into invented serialized units. Mixed Qty strings such as 2 dus normalize into quantity 2 and UoM Dus. Unknown units/counts remain missing and unavailable. Set contents are not converted into independently borrowable Pcs. No packaging conversion is guessed.

## Evidence and readiness

567 Storedev rows and 478 internal rows have recovered photos (1,045 records, 1,068 photo references including updates). Extraction follows rich-cell value metadata and image relationships, plus drawing row/column anchors for documentation columns. Source `#VALUE!` rich-image cells are not treated as lost photos. The 28 internal rows without mapped images retain visible fallback/documentation state. Reused photo binaries are content-addressed, while independent row identities remain distinct. Photos are labeled Other because the source does not reliably identify Front/Left/Right; required-view completion is not fabricated.

Latest physical-condition explanation takes precedence over older condition notes. Unconfirmed location, missing/invalid quantity/UoM, unknown classification, negative physical confirmation and maintenance/damage notes hold booking readiness. Imported Ready records require suitable supplied condition/status and a mapped active warehouse; this is source-based readiness, not a newly performed inspection. Existing documentation warnings remain inline. Source snapshots and notes are visible in a collapsed detail disclosure. Names are bounded in cards, and Inventory/request selection render batches of 24 while searching all imported rows.

## Persistence and media adapter

Private PostgreSQL schema `asset_master` stores catalog payloads, source evidence, vendor/warehouse foreign keys, internal warehouses, media references and import audit. The two explicit DGI Jateng → Semarang confirmations have separate compact actor/timestamp audit events. RLS is enabled with no browser/public table grants. Repeat identical imports skip existing source keys; existing records are never silently overwritten. Known-classification imports are mirrored into the existing booking authority without changing its quantity-allocation limitations.

Binary images live in `.local/asset-media`, outside the public directory and Git. The local storage adapter resolves only registered content-addressed keys through short-lived signed URLs. The catalog API uses the existing loopback-only allowlisted prototype actor bridge; unsigned media, cross-origin media and path traversal are rejected. `ASSETHUB_MEDIA_SIGNING_KEY` is server-only. This is durable **local** catalog storage, not Supabase/cloud storage or production authentication. Preserve `.local/asset-media` with the database backup; extraction can restore images from the original workbook.

Read via `/api/assets`; display in Inventory, Home, Asset Detail, new Request and new Transfer selection. New Add Asset records and operational photo/location/condition/transfer mutations still use session state; these are not silently advertised as persistent catalog edits. Durable booking still rejects unsupported quantity-based allocations. A persistent editing/verifying workflow and full quantity ledger are separate slices.

## Commands and verification

Read/extract with bundled Python: `scripts/extract-assets.py <source.xlsx>`. It produces source JSON and private local media. `node --env-file=.env.local scripts/import-assets.mjs` previews mapping; add `--apply` for a transaction. Requires the local Vendor and booking schemas. Apply `0005_asset_catalog.sql`, `0006_internal_warehouses.sql`, and `0007_asset_import_audit.sql` through the importer. Keep the generated source evidence/review JSON with the import. Changed source rows require deliberate reconciliation, not silent replacement.

Verify source/media counts, object hashes, repeat-import skips, source corrections, unknown classification, package parsing and notes precedence. Browser checks cover persisted catalog reload, actual image loading, corrected Vendor location, unsigned/tampered access rejection and desktop/mobile width. No source or operational record is deleted by this import.

## Catalog metadata editing

Asset Detail exposes **Edit asset** to StoreDev and Super Admin (explicitly approved).
Imported catalog metadata saves through `PATCH /api/assets/[assetId]` using the
trusted local-only cookie actor and canonical PostgreSQL Person (M1-D). This does
not activate shared/provider authentication or change metadata persistence rules.

Editable fields are name, description, owner/contact metadata, paired management
contacts and composition confirmation. Event/setup and ambiguous source dates
are retained as legacy context, not editable activity fields in the asset form.
Asset code is the inventory reference. PO/Invoice is
not an Add/Edit Asset field; original imported values and existing stored
references remain preserved as source/history. Request financial references
retain their existing UI, permissions, and behavior. Current corrections
live in `payload.details`; original `importInfo`, raw `source`, source hashes,
IDs, vendor/warehouse relationships, and media remain intact. Source flags are
historical import evidence and remain visible separately from corrected details.
A composition choice describes this record; it does not split or merge records.
A confirmed context date does not establish manufacture date or asset age.

The command locks the catalog row, checks the revision returned by catalog GET,
and updates metadata plus an `EDIT_METADATA` audit event in one transaction.
Stale edits return 409 and require a reload. Availability, quantity, unit policy,
condition, location, inspection, and booking occupancy cannot be written through
this command. No schema migration is needed. Prototype-only assets continue to
edit in session state, explicitly disclosed in the form.

### Paired asset management contacts

Add Asset and Edit Asset share repeatable PIC rows with one name, optional email,
and optional phone per row. `payload.managementContacts` stores the ordered
`{name,email,phone}` array in the existing catalog JSON; metadata updates retain
revision checks and transactionally audit before/after values. Omission by an
older API client preserves the existing array; an explicit empty array clears
structured contacts. Empty draft rows are omitted. Contacts with a channel but
no name or multiple emails in a single row are rejected.

Legacy `responsiblePic` and `details.picEmail` text remains reference evidence,
not inferred name/email pairings. No automatic splitting, email linking, Person
creation, login authority, or operational PIC assignment occurs. Add Asset still
uses session state; this does not activate durable registration or Phase 1A.

### Editing after local session expiry

The local actor cookie retains its existing one-hour lifetime and restart
invalidation. A failed metadata save with a missing/invalid session keeps the
editor draft and offers explicit re-selection of the same current canonical
Person through the existing local session endpoint. This does not refresh or
remount the provider, switch identities, extend the configured lifetime, or
retry the metadata command automatically. The user explicitly saves again after
successful re-selection; canonical role, active status, origin and listener
checks remain unchanged. A fresh unauthenticated detail load instead links to Me.

Composition is optional, collapsed additional information in Edit Asset. Whole
means this record describes an intact asset; Component means it describes an
independently movable component. Neither creates/splits records or grants
borrowing readiness. Event/setup context and event/usage/received-date fields
are removed from the main asset information and editor. Existing stored values
remain in the metadata draft/API payload unchanged and are readable in a
separate, collapsed legacy-context disclosure. Original Excel contexts remain
in source details. These references never fabricate activity history, asset age,
or last-use dates; verified usage and movements belong to Asset History through
existing operational records. Asset description remains editable free text;
this UI change does not rewrite existing descriptions or database records.

### Reusable internal directory

The current Add/Edit Asset UI selects `managementContactIds` from the durable
[internal contact directory](INTERNAL_CONTACT_DIRECTORY.md). Legacy paired
`managementContacts` remains a compatible projection/snapshot; linked IDs are
resolved server-side and cannot be overridden by client contact channels. The
0010 import adds contact/link records without rewriting any original asset
payload or import evidence. Existing account/People, request/event PIC and vendor
contact behavior remains separate. New contacts can be saved once to the library
through the picker and reused by other assets.
