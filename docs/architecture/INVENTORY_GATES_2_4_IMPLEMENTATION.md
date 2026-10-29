# Inventory Partial 1 — Consolidated Gate 2–4 implementation

28 October 2026, Asia/Jakarta. **PASS for implemented functionality and isolated verification.**
Active migration, deployment, shared authentication and Borrowing remain unapproved.
This report records implementation, not an additional approval/planning document.

## Implemented result and activation boundary

The existing four-stage Add Asset now submits an authenticated durable command:
standalone, create group with first individual, or join existing group. Owner/PIC
resolve from the existing contact master; new individuals have quantity 1, existing
supported UoM, exact warehouse/vendor IDs and optional D07 metadata. Successful
registration requires validated actual primary image bytes and SQL associations.
The UI no longer inserts a session asset or displays success before server commit.

Gate 1's photo-disabled entry was replaced only after implementing the required
media pipeline. Its isolated relational-only test helper remains guarded by the
owned test-target contract; it is not an HTTP/UI fallback. The active database lacks
0011/0012: the new public command checks documentation schema before parsing/storing
uploads and returns DISABLED there. **This does not make port-3000 registration
ready to save.** That requires separately approved active migration/release review.

Implemented scope:

- Reuse of Gate 1 normalized validator, transaction, canonical actor/role checks,
  group inheritance, direct Owner/PIC separation, command locks/receipts, held
  booking mirror, registration provenance and audit.
- Four-stage HeroUI form, searchable master/group choices, fixed Individual/1,
  required Owner/PIC/image, honest optional/unknown metadata and canonical Detail
  navigation. Group assignment cannot be changed through member editing.
- Draft/file/key preservation on network uncertainty; immutable retry intent,
  pending-submit protection and corrections after definitive validation failure.
  Documentation stale-version recovery reloads the version while retaining files,
  without automatically retrying a command.
- Manual durable Edit uses catalogRevision rather than importInfo, resolves Owner
  IDs, preserves existing legacy multi-PIC behavior, rejects group/operational field
  mutation and uses the existing row-lock/revision/audit transaction.
- Actual JPEG/PNG/WebP decoding, one primary Asset Photo, optional separate
  Condition Photos/captions; six files, 10 MiB/file, 30 MiB aggregate, 40 MP decoded.
  Raw multipart body consumption is bounded even without trustworthy Content-Length.
- Private content-addressed immutable binary objects; exclusive staging, fsync and
  atomic publication before SQL references; authenticated signed reads. sharp 0.35.3
  is explicitly declared as a direct dependency, with no decoder version upgrade.
- Logical photo revisions/supersession, preserved imported objects/payloads/links,
  idempotent documentation receipt, metadata revision conflict protection and durable
  documentation audit. Old evidence remains readable through signed history links.
- Asset Information, Status/Condition, Warehouse/Location, Owner/Contacts and History
  compositions reuse the current screen. Contact assignment source, group membership,
  master address and optional contacts are displayed. Recorded storage is not receipt.
- Safe durable business-history projection distinguishes Registration, Metadata,
  Documentation, source Import and recorded-data Correction from Usage/Movement.
  Raw technical audit payloads are not exposed. Event/received metadata does not
  manufacture lifecycle events. Legacy import payload history is not rewritten.
- Request CTA is restricted to the existing durable ASSET/Individual/qty1 eligibility;
  server booking logic is unchanged. New records remain unavailable/inspection-held.

## Database and media implementation

Only restored, generated PostgreSQL 17 clones received migration application:

| Migration | SHA-256 | Effect |
| --- | --- | --- |
| 0011_asset_registration.sql | `3921cdae740e720dbf44459a450e77f0bf844c1cbefc7239b4f0c7c405e3d619` | Existing approved Gate 1 artifact, unchanged; group/member/Owner/registration receipt foundation |
| 0012_asset_documentation.sql | `8d250767df8b5d667455298814812c6965fb93c177a9d62afe6938d3ccd76d59` | asset_photos, documentation_receipts, indexes/RLS/revocations, nullable source_cell for manual associations, receipt fingerprint versions 1/2 |

No historical migration was replayed. The driver verifies bundle and on-disk
checksums, confirms ledger 0001–0010 and its observed/executed distinction, applies
only reviewed pending 0011/0012 transactionally to the owned clone, and records
executed provenance there. Original source_cell values remain unchanged. No fake
spreadsheet cell/uploader/date is assigned to old evidence. New logical photo
attribution belongs to the asset/photo revision, not a globally shared binary.

Relational writes are atomic. Filesystem and PostgreSQL are not a distributed
transaction: bytes are validated/published durably first; SQL failure can retain a
safe unreferenced binary. Private command manifests identify uploaded objects.
`report-asset-upload-orphans.mjs` is read-only/report-only, and performs no deletion.
The controlled receipt-failure test left one such review object; the report resolved
referenced objects and identified it without changing media or DB rows. No automatic
orphan cleanup, raw-source rewrite or destructive storage replacement exists.

## Verification results

Final unique test results:

| Verification | Result / evidence boundary |
| --- | --- |
| Foundation + actual PG/media suites | **60 PASS**, 0 FAIL/SKIPPED across 3 suites: 21 pure validator, 22 real-PG Gate 1, 17 real-PG/media integration cases |
| UI + regression suites | **176 PASS**, 0 FAIL/SKIPPED across 19 suites: includes 3 new mocked-transport form tests, prior role/actor/session/approval, import/UoM/contact/edit/loading and Request-contact regressions |
| Actual Next 16.3.0/Turbopack + Chromium | **PASS**, separate source copy/build, fresh contexts, owned clone/media and dedicated OS-verified loopback port |
| Scoped static checks | TypeScript noEmit/nonincremental and ESLint across all 37 changed/new JS/TS files **PASS** |
| Diff/reference checks | git diff --check and report references **PASS** |
| Active schema/data/media | Full M0 manifest comparison **PASS**; no active migration or mutation |

The 39 PostgreSQL cases use real SQL, canonical People, signed local cookies and
actual loopback-listener verification. Vitest mocks only the server-only package
marker. Their Request objects are in-process; they are not mislabeled browser tests.
The three new UI tests mock transport and selectors to verify draft/key behavior;
their preview fixtures do not establish image decoding or DB durability.

New media integration covers actual PNG/JPEG/WebP, optional caption, primary/Condition
requirements, malformed/spoofed/corrupt bytes, file count/size/request/pixel limits,
private authenticated reads, independent group documentation, concurrent replay,
filesystem failure, SQL failure after publication, durable manual edit and photo
supersession/replay. Gate 1 tests retain eight-point rollback, relationship/role/
warehouse/receipt/held-projection checks. Existing role permissions are unchanged;
characterization expectations were updated only where the approved durable contract
replaced fixture-based session registration, and brittle mocks now distinguish
Owner/PIC or identify SQL by operation rather than an old positional call index.

Actual browser evidence:

1. Desktop 1440×1000 and mobile 390×844 Add master selectors and Detail inspected.
   Mobile root width is 390; final Continue bottom 692.09 < nav top 770.03.
2. Native browser File upload → POST /api/assets **201** → canonical Detail with
   decoded private gallery image; no mock persistence response.
3. Browser refresh retains the asset; manual Edit/PATCH persists the changed name.
4. A fresh second context selecting StoreDev reads the same persisted record.
5. Actual Next process stop/restart invalidates the old cookie (**401**); explicit
   identity re-selection restores the asset and real private image. A fresh page in
   that same restored-cookie context avoids an old-frame HMR navigation race.
6. Actual Next route rejects no-cookie/prototype-header spoofing (**401**) and
   selected Brand-role registration (**403**).
7. Registration and metadata events appear in API and rendered History; no Usage
   is invented. Recorded JavaScript page errors: **0**. This is not a full browser
   console/accessibility/screen-reader certification.

During development, tests exposed a missing DB username in the minimal browser
process environment, selector-load timing, transient hidden-select overflow on
viewport resize, premature image-load assertion and a dev-HMR restart race. Fixes
were limited to explicit isolated environment credentials, loading/layout behavior
and truthful asynchronous browser waits. No origin, cookie, listener or actor
security boundary was weakened. Test iterations are not added to unique totals.

Final integration evidence:

```text
.local/gate234/assethub_test_registration_78edb6058969c4b11dc89a09/
  migration.json
  vitest.json
  browser.json
  preservation.json
  orphans.json
  cleanup.json
  add-desktop.png / add-mobile.png / add-mobile-top.png
  detail-desktop.png / detail-mobile.png
  next-runtime.log
.local/gate234/final-source-preservation.json
.local/gate234/prechange.json
.local/gate234/original/
```

Screenshots and logs are private/ignored and may contain contact data or temporary
signed URLs; do not publish recovery/media artifacts. Some full-page captures include
fixed navigation at the page's scroll position or an early loading state. Completed
history/render assertions are recorded separately in browser.json.

Commands executed (all writes isolated):

```sh
node scripts/persistence-m0.mjs backup-verify
node scripts/test-inventory-build.mjs .local/recovery/2026-10-28T08-15-26.717Z-cca41c02
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

The build driver restores the verified bundle into a generated ownership-token-
marked clone; copies private media; applies only pending reviewed migrations; runs
three explicit suites; then starts the separate Next/Chromium verification and the
read-only orphan reporter. All test-target environment overrides are explicit.
No environment files are copied into the source copy. The final database is dropped
only after exact ownership verification and process/connection shutdown, without
force disconnects or CASCADE.

The 19-suite regression command explicitly clears ASSETHUB_DATABASE_URL and all
registration/asset-edit/contact/vendor/People test URLs, then selects the following
non-mutating tests:

```text
tests/asset-registration-screen.test.tsx
tests/server/authorization-characterization.test.ts
tests/server/local-actor.test.ts
tests/server/session.test.ts
tests/identity-audit.test.tsx
tests/approvals.test.tsx
tests/local-identity-client.test.tsx
tests/server/asset-edit.test.ts
tests/asset-edit.test.ts
tests/asset-import.test.ts
tests/asset-units.test.ts
tests/asset-contacts.test.tsx
tests/asset-contact-picker.test.tsx
tests/asset-editor-recovery.test.tsx
tests/asset-location-contacts.test.ts
tests/internal-contacts.test.ts
tests/inventory-loading.test.tsx
tests/request-site-contact-field.test.tsx
tests/server/request-site-contact.test.ts
```

## Recovery and preservation

Fresh M0 bundle:
`.local/recovery/2026-10-28T08-15-26.717Z-cca41c02`.
Database/media restoration verified schema, complete row hashes, sequences and all
713 file hashes; temporary restore target removed; sourceUnchanged true.

Final independent read-only source comparison confirms:

- **31 tables**, schema definitions, every original row hash and sequence unchanged.
- **713 media files**, all paths/bytes/hashes unchanged.
- Imported asset IDs/payloads/source hashes, Owner/PIC evidence, contact assignments,
  vendor/warehouse records, People, booking records/receipts/numbering preserved.
- Active ledger still ends at **0010**; documentation schema absent.
- **0** remaining generated registration databases.
- In the clone, original rows were compared as a multiset subset, original media
  retained exactly, and expected additional test/registration/audit rows separated.

No active business registration, contact creation, Edit, upload, migration, import,
seed, reset or media cleanup was performed. Existing dirty/untracked work was
preserved against a captured file baseline. Booking server, identity policy files,
source importers and migrations 0001–0011 remain unchanged by this build.

## Remaining limitations, by impact

1. **Activation blocker, intentional:** active migration/release review is outstanding.
   End-to-end registration is proven only in the isolated environment. The active
   preview cannot durably register until the approved schema is applied separately.
2. **Deferred product scope:** new assets cannot be cleared for borrowing here.
   Inspection/readiness, dispatch/receipt/returns, membership changes and group-wide
   reassignment remain unavailable. Existing operational prototype cards remain
   prototype flows; this build does not make them durable.
3. **Operational storage:** failed published objects can remain unreferenced; the
   read-only reporter and private manifests support explicit review. No destructive
   janitor, automatic retention policy or off-device backup guarantee is introduced.
4. **Verification limits:** complete Borrowing/People DB suites, screen reader audit,
   approved pixel-baseline comparison and every grouped/media editing combination
   through browser UI were not performed. Group and replacement commands have real
   PG/media coverage; browser UI covers standalone registration and manual edit.
   The previously documented clock-sensitive reservations test is not claimed fixed.
5. **Local draft lifetime:** mounted forms preserve draft and selected files on
   recoverable errors. A deliberate full reload can discard unsaved browser File
   objects; no unapproved automatic localStorage draft persistence was added.
6. **Existing dependency audit:** npm reported pre-existing audit findings during
   lockfile-only declaration. No npm audit fix, broad dependency upgrade or MCP/global
   configuration change was performed.

Ready for final verification and **separately authorized active migration review**,
not production/shared deployment. A fresh recovery/source-drift check is still required
at that time; do not reuse this report as permission to run a migrate-all script.
No additional product decisions, permission grants or planning documents are required.

## Exact file inventory

The table below is relative to the captured start-of-build working tree, including
untracked Gate 1/contact implementations, not relative to Git HEAD.

| File | Change |
| --- | --- |
| [db/migrations/0012_asset_documentation.sql](../../db/migrations/0012_asset_documentation.sql) | Added |
| [docs/architecture/INVENTORY_GATES_2_4_IMPLEMENTATION.md](INVENTORY_GATES_2_4_IMPLEMENTATION.md) | Added |
| [package-lock.json](../../package-lock.json) | Modified |
| [package.json](../../package.json) | Modified |
| [scripts/report-asset-upload-orphans.mjs](../../scripts/report-asset-upload-orphans.mjs) | Added |
| [scripts/test-inventory-build.mjs](../../scripts/test-inventory-build.mjs) | Added |
| [scripts/verify-inventory-browser.mjs](../../scripts/verify-inventory-browser.mjs) | Added |
| [src/app/api/asset-groups/route.ts](../../src/app/api/asset-groups/route.ts) | Added |
| [src/app/api/asset-registration-locations/route.ts](../../src/app/api/asset-registration-locations/route.ts) | Added |
| [src/app/api/assets/[assetId]/history/route.ts](../../src/app/api/assets/[assetId]/history/route.ts) | Added |
| [src/app/api/assets/[assetId]/photos/route.ts](../../src/app/api/assets/[assetId]/photos/route.ts) | Added |
| [src/app/api/assets/route.ts](../../src/app/api/assets/route.ts) | Modified |
| [src/components/domain/asset-gallery.tsx](../../src/components/domain/asset-gallery.tsx) | Modified |
| [src/features/assets/add-asset-screen.tsx](../../src/features/assets/add-asset-screen.tsx) | Modified |
| [src/features/assets/asset-contact-picker.tsx](../../src/features/assets/asset-contact-picker.tsx) | Modified |
| [src/features/assets/asset-detail-screen.tsx](../../src/features/assets/asset-detail-screen.tsx) | Modified |
| [src/features/assets/asset-documentation-editor.tsx](../../src/features/assets/asset-documentation-editor.tsx) | Added |
| [src/features/assets/asset-editor.tsx](../../src/features/assets/asset-editor.tsx) | Modified |
| [src/features/assets/asset-history.tsx](../../src/features/assets/asset-history.tsx) | Added |
| [src/features/assets/asset-metadata.tsx](../../src/features/assets/asset-metadata.tsx) | Modified |
| [src/features/assets/asset-photo-fields.tsx](../../src/features/assets/asset-photo-fields.tsx) | Added |
| [src/features/assets/photo-documentation-screen.tsx](../../src/features/assets/photo-documentation-screen.tsx) | Modified |
| [src/features/assets/registration-metadata-fields.tsx](../../src/features/assets/registration-metadata-fields.tsx) | Added |
| [src/features/prototype/prototype-provider.tsx](../../src/features/prototype/prototype-provider.tsx) | Modified |
| [src/lib/asset-registration-client.ts](../../src/lib/asset-registration-client.ts) | Added |
| [src/lib/domain/asset-edit.ts](../../src/lib/domain/asset-edit.ts) | Modified |
| [src/lib/domain/asset-registration.ts](../../src/lib/domain/asset-registration.ts) | Modified |
| [src/lib/server/asset-documentation.ts](../../src/lib/server/asset-documentation.ts) | Added |
| [src/lib/server/asset-http.ts](../../src/lib/server/asset-http.ts) | Added |
| [src/lib/server/asset-inventory-reads.ts](../../src/lib/server/asset-inventory-reads.ts) | Added |
| [src/lib/server/asset-photo-projection.ts](../../src/lib/server/asset-photo-projection.ts) | Added |
| [src/lib/server/asset-registration.ts](../../src/lib/server/asset-registration.ts) | Modified |
| [src/lib/server/assets.ts](../../src/lib/server/assets.ts) | Modified |
| [src/server/assets/local-media-storage.ts](../../src/server/assets/local-media-storage.ts) | Added |
| [src/types/prototype.ts](../../src/types/prototype.ts) | Modified |
| [tests/asset-editor-recovery.test.tsx](../../tests/asset-editor-recovery.test.tsx) | Modified |
| [tests/asset-registration-screen.test.tsx](../../tests/asset-registration-screen.test.tsx) | Added |
| [tests/server/asset-edit.test.ts](../../tests/server/asset-edit.test.ts) | Modified |
| [tests/server/asset-registration-persistence.test.ts](../../tests/server/asset-registration-persistence.test.ts) | Modified |
| [tests/server/authorization-characterization.test.ts](../../tests/server/authorization-characterization.test.ts) | Modified |
| [tests/server/inventory-build-persistence.test.ts](../../tests/server/inventory-build-persistence.test.ts) | Added |

**Stop boundary:** Combined Gate 2–4 implementation and isolated verification only. No active migration, deployment, Borrowing development, automatic commit or push.
