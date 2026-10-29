# Internal asset contact directory — local implementation

## Scope and identity boundary

Add/Edit Asset select reusable internal management contacts by ID. Contacts are
business metadata, separate from authenticated People, owner, request/event PIC,
vendor warehouse contact, and physically confirmed custodian. No Person, login,
role, capability, organizational scope, or account mapping is created by this
feature. People CRUD/M1-F and operational authorization remain outside this slice.

The existing StoreDev/Super Admin permission to capture asset contact metadata
also gates directory selection/creation. Other roles cannot enumerate or create
directory records through its endpoint. Existing authorized catalog reads retain
their existing asset-contact visibility. The user explicitly approved the same
StoreDev/Super Admin-only directory visibility for the Request selector. Other
roles retain manual Request PIC capture; event/custody assignment permissions
are unchanged. Vendor contacts keep their existing
warehouse links and are not copied into this directory.

Asset detail also shows the existing Vendor Master warehouse contact through
the already-authorized vendor-location projection. It requires a matching
warehouse ID, vendor and recorded location; a stale warehouse after movement is
not presented as the current contact. This read-only fact does not set physical
custody or add contact channels to the existing projection.

## Durable model and API

Migration `0010_internal_contact_directory.sql` adds the private `contact_core`
schema with RLS enabled and no public/browser grants:

- `internal_contacts`: stable UUID, name, optional email/phone, active state,
  exact normalized contact-key uniqueness, source, canonical recording actor,
  creation timestamp. No auto-linking by email alone.
- `asset_management_contacts`: asset/contact foreign keys, ordered many-to-many
  assignments and recording actor/time. No change to original asset payloads
  during import. Existing media, booking, vendor and identity tables are untouched.
- `audit_events`: compact create/import evidence; no full contact-channel copies.

`GET /api/internal-contacts` lists active choices for StoreDev/Super Admin.
`POST /api/internal-contacts` creates one contact or reuses an exact normalized
name/email/phone match without updating it or duplicating its create audit.
Both use the existing canonical local cookie actor and loopback/origin boundary.
No new authentication provider, fallback, exposure, or default identity exists.
Contacts sharing an email but having different names remain separate records.

`PATCH /api/assets/[assetId]` accepts optional `managementContactIds`. Within the
existing asset row lock/version transaction it resolves active contact IDs,
replaces assignments, updates compatible payload projections and appends asset
metadata audit. Browser-supplied contact channels never override referenced
directory data. Bad/inactive/duplicate IDs reject the whole transaction. Audit
uses contact IDs for this path. Omitted IDs preserve existing relations for old
clients; explicit `[]` clears assignments. Catalog GET resolves current directory
records, including an inactive warning for previously linked contacts. There is
no directory update/delete endpoint in this slice.

The shared searchable picker supports multiple PICs. New contacts are saved to
the directory explicitly before assignment; cancelling asset editing does not
delete that reusable contact. Removing a selection only changes the draft until
asset save. Add Asset still creates session-only assets; this feature does not
activate durable registration/Phase 1A.

## Approved Request selector follow-up — 27 October 2026

In New Request and revision, StoreDev/Super Admin can search the existing
directory for the single project-site PIC supported by the current Request
model. No contact is created by the Request selector. Other roles do not fetch
or see directory choices; the existing manual/vendor-suggested field remains.
Selecting a directory record fills a read-only contact snapshot. The explicit
manual-input action releases the directory link; event, usage, brand and
registered-destination changes also release it to avoid a stale association.
No Requester identity, Asset owner, permanent management PIC or physical
custodian is inferred from this choice.

The existing booking POST/PATCH accept optional `siteContactInternalId` in the
draft, stored in `booking.requests.payload` alongside `siteContact`. No migration
or new table is required. Inside the existing transaction, an active contact is
resolved by ID with a shared row lock; canonical name/phone/email replace any
browser-supplied site-contact snapshot. New ID selections require StoreDev or
Super Admin server-side. Missing/inactive/invalid IDs and denied selections use
the existing `VALIDATION` error contract and roll back the booking transaction.
Manual drafts without the field keep their existing path.

Request reads, detail and history retain the submitted snapshot rather than
joining to today's directory channels. An already-authorized requester whose
role later changes can retain an identical historical ID/snapshot during
resubmission without listing or resolving the directory; changing that ID or
snapshot under a directory link is rejected. Switching explicitly to manual
capture remains available. Requester/Super Admin revision ownership, reviewers,
operational permissions and visibility of existing submitted PIC snapshots
remain unchanged.

Command fingerprints still hash the original draft/actor/command exactly as
before; contact resolution occurs only after the existing receipt replay check.
Legacy/manual fingerprints and receipts are not rewritten. Existing numbering,
versions, review cycles, audit, reservations and vendor validation remain in
the same transaction. The current frontend-only booking mode continues to
store only session state; this follow-up does not activate persistence flags or
persist event Master Data or operational custody/history.

Follow-up verification: **141 non-mutating tests across 11 suites** (including
all 57 Gate A tests), plus **six isolated PostgreSQL integration tests** passed.
The PostgreSQL driver also re-ran three directory domain tests, restored the
verified pre-0010 M0 bundle, validated 0010/import repeatability and removed only
the generated `assethub_test_contacts_53ddff79ee7340f1acb5cee4` database. The two
new integration cases cover actual cookie → canonical Person → Request API,
canonical snapshot/ID persistence, submit/resubmit versions, inactive rejection,
receipt replay/fingerprints and denied selection versus preserved manual
submission for Brand/Vendor/Management. Typecheck and scoped lint passed.
Read-only pre/post comparison confirmed the active schema, all 31 table hashes,
sequences and all 713 media files unchanged; isolated database cleanup passed.
Evidence: `.local/internal-contacts/request-preservation.json`.

Browser observation at `/request/new`: desktop 1440×1000 and mobile 390×844,
search/selection/autofill, usage-change link release, Enter/Escape and long-option
wrapping inspected. Brand identity showed only the manual field; the original
Super Admin identity was restored. No booking was submitted on the active DB.
Contact-free screenshots are private `request-desktop.png` and
`request-mobile.png` under `.local/internal-contacts/`. No screen-reader audit or
new full lifecycle browser test was performed.

Exact follow-up file scope (preserve earlier edits when rolling back):

- `src/features/requests/request-site-contact-field.tsx` (new)
- `src/features/requests/request-flow-screen.tsx`
- `src/server/contacts/request-site-contact.ts` (new)
- `src/server/contacts/service.ts`
- `src/lib/domain/internal-contacts.ts`, `src/lib/server/booking.ts`
- `src/types/prototype.ts`
- `tests/request-site-contact-field.test.tsx` (new)
- `tests/server/request-site-contact.test.ts` (new)
- `tests/server/internal-contacts-persistence.test.ts`
- `docs/domain/REQUEST_BOOKING_MODEL.md`, this document.

Rollback is a selective reversal of these code hunks/selector activation. Keep
existing payload snapshots/IDs, contacts, 0010 and provenance. There is no active
database migration/data rewrite or environment change to reverse in this
follow-up, and existing Request readers tolerate the additive optional field.

## Controlled import and provenance

The operator imports explicit saved contact pairs and unambiguous single-name /
single-email source fields. An identical legacy name/email group can reuse pairs
already explicitly saved in another asset; contradictory saved groups are not
guessed. Multiple unresolved names/emails, missing names, and malformed channels
remain review items. No name is split by words. Repeated imports skip existing
asset assignments, never overwrite later edits, and emit no new audit when no
new contacts/links are inserted. Existing raw text/source snapshots stay intact.

Command (explicit target, actor and verified exact recovery bundle required):

```sh
node scripts/internal-contacts.mjs apply-and-import assethub_dev VERIFIED_BUNDLE dev-user
```

This executes only 0010, never the historical suite. One transaction verifies
the pre-change manifest, old migration checksums/ledger semantics, PostgreSQL 17,
existing schema definitions, all original business table hashes, sequences, and
media. It records a new M0-compatible baseline and 0010 execution provenance;
historical ledger/baseline records remain unchanged. It refuses schema replay,
drift, ambiguous targets, or a missing verified recovery receipt.

Verified local import: **5 contacts, 1,068 assets, 2,128 links**, with **5 assets
requiring confirmation**. All 1,073 original asset payloads/revisions/source rows,
existing identity/vendor/booking/media data and historical provenance were
preserved. The private review report contains asset IDs/reasons, not raw contacts.

## Verification and recovery

```sh
node scripts/persistence-m0.mjs backup-verify
node scripts/test-internal-contacts.mjs VERIFIED_PRE_CHANGE_BUNDLE
```

The test driver restores the pre-change bundle to a generated
`assethub_test_contacts_<24 hex>` database, executes 0010/import, verifies a repeated
import has an identical manifest, then tests real cookie/canonical Person/API /
PostgreSQL behavior. OS ingress is mocked only in that in-process test; existing
M1-B ingress regressions and observational browser tests cover the boundary.
Only that generated DB is terminated/dropped. No persistence suite targets dev.

Keep pre/post verified M0 bundles in private `.local/recovery`. Roll back UI/API
activation selectively using the task diff, preserving other local work; keep
the additive schema, contacts and historical ledger rows. Do not drop directory
records or reverse ledger history as a shortcut. For actual recovery restore to
a new database/media directory per M0, then perform a separately reviewed cutover.
Do not restore over the active database or replay earlier migrations. The old
M1-C operator intentionally checks its original nine-artifact inventory; use this
new scoped tool for 0010 rather than loosening historical tool safeguards.

## Verified execution — 27 October 2026

- Pre-change verified recovery: `.local/recovery/2026-10-27T06-38-48.457Z-f0cf9f47`
  (28 tables, 713 media files).
- Post-change verified recovery: `.local/recovery/2026-10-27T06-54-53.204Z-af625544`
  (31 tables, 713 media files). Schema, row hashes, sequences and media matched
  isolated restoration; generated recovery databases were removed.
- 0010 SHA-256: `4e2ba14a989c87a837e3c2fcf33e75683b6a7ed5c2072c3a828ffcc1ea97a127`.
- 135 non-mutating regression tests and four isolated PostgreSQL integration
  tests passed; typecheck, scoped lint and diff checks passed.
- Real Next runtime: missing cookie `401`, explicit local selection `200`,
  contact GET `200`/5 contacts, catalog GET `200`/1,073 assets, forged actor header
  without a cookie `401`. No contact or asset browser form was submitted on dev.
- Desktop 1440×1000 and mobile 390×844: existing linked PIC hydration, directory
  search/reselection, Add/Edit picker, contact-form opening/cancellation, keyboard
  opening/Escape, long text and mobile overflow inspected. No page JS errors
  observed; no automated screen-reader audit was performed.
- The read-only warehouse contact was inspected at mobile width 390; document
  width remained 390 with no horizontal overflow. Existing custodian stayed
  unrecorded; no custody event was inferred from the directory contact.
- Private summaries: `.local/internal-contacts/preservation.json`,
  `api-evidence.json`, `isolated-migration.json`, and `operation-*.json`.

Files added or changed by this directory slice (earlier unrelated local edits
remain preserved):

- `db/migrations/0010_internal_contact_directory.sql`
- `scripts/internal-contacts.mjs`, `scripts/test-internal-contacts.mjs`
- `src/lib/domain/internal-contacts.ts`, `asset-contacts.ts`, `asset-edit.ts`
- `src/lib/domain/asset-location-contacts.ts`
- `src/types/prototype.ts`
- `src/server/contacts/repository.ts`, `src/server/contacts/service.ts`
- `src/app/api/internal-contacts/route.ts`, `src/lib/server/assets.ts`
- `src/features/prototype/prototype-provider.tsx`
- `src/features/assets/asset-contact-picker.tsx`, `asset-editor.tsx`,
  `add-asset-screen.tsx`, `asset-metadata.tsx`, `asset-detail-screen.tsx`
- `tests/internal-contacts.test.ts`, `tests/asset-contact-picker.test.tsx`,
  `tests/server/internal-contacts-persistence.test.ts`,
  `tests/asset-editor-recovery.test.tsx`, `tests/asset-location-contacts.test.ts`
- `docs/00_README.md`, `docs/domain/ASSET_CATALOG_IMPORT.md`, this document.
