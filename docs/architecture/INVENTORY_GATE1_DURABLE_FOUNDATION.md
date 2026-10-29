# Inventory Partial 1 — Gate 1 Durable Foundation

Date: 28 October 2026. **Gate 1 PASS for isolated relational implementation only.**
No Gate 2–5 implementation, active migration, complete Add Asset activation,
photo upload, readiness or Borrowing activation is included.

## Authority and implementation

Follow [Gate 0 approved plan](INVENTORY_APPROVED_PLAN.md),
the separately approved Gate 1 brief, [M0 recovery](M0_RECOVERY.md)
and [M1-D](M1_D_CANONICAL_API_INTEGRATION.md).
D01–D07/T01–T05 are preserved. The current source, including dirty/untracked
contact and Request follow-up implementations, was the baseline, not HEAD.

Implemented:

- Strict normalized registration intent: ASSET/Individual/quantity 1, existing
  brand/category/unit vocabulary, canonical condition, optional legacy reference,
  received calendar date, decimal-string amount/explicit currency, event/project
  metadata and notes. Unknown dates/value remain unknown; no PO/production input.
- Standalone Owner plus ordered multiple managing PICs from the existing active
  business-contact directory. No account linking or master modification.
- New group with first member, or explicit existing group/version selection.
  Effective Owner/PIC resolve from group; no competing direct member assignments.
  Existing multi-PIC assignments remain intact. Group/membership updates/deletes
  are deliberately rejected; legacy attachment/reparenting have no command.
- Exact internal warehouse or vendor/warehouse pair. Active/verified vendor
  warehouse is required; warehouse contact existence is not required. Existing
  booking destination validation is unchanged.
- Canonical cookie actor, active PostgreSQL People and StoreDev/Super Admin check;
  actor is re-read under lock in the command transaction. No header/fixture fallback,
  scope-derived grant, role addition or operational permission.
- Versioned deterministic fingerprint, serialized command-key lock and receipt;
  asset, group/member, direct relationships, unavailable/inspection-held booking
  projection, registration audit and receipt commit in one transaction.
- Canonical catalog read adds Owner/group/member-count/effective-PIC fields while
  preserving existing GET shape. Pre-0011 schema returns the original projection;
  no dependency on importInfo for retrieving manual durable records.
- Registration evidence contains assignment source, reference IDs, group version,
  initial state and canonical actor; initial payload history is not Usage.

### Mandatory photo boundary

`registerCatalogAsset()` always fails DISABLED. No POST route, Server Action,
UI registration integration, feature flag or photo-free end-user command was added.
Existing session-only Add Asset behavior is preserved rather than relabeled durable.

The only writing entry is explicitly named `registerIsolatedRelationalAsset()`.
Every invocation checks the connected database name, PG17 version, loopback
configured database, and exact database ownership comment against a 48-hex token.
Only generated `assethub_test_registration_<24hex>` databases are accepted.
The helper still uses real trusted-cookie/canonical-actor authorization.
No route/UI imports this helper. Target/token checks are operational isolation,
not a substitute for actor authorization.

These isolated fixture records intentionally have empty photos, explicit
`gate1-isolated-no-media` provenance and clearly labeled relational-verification
history. They are not documented assets or a production-ready registration result.
All test databases were dropped. Gate 3 must coordinate actual validated durable
bytes and transactional associations before any successful end-user command.
The blocked entry has no bypass parameter or environment switch.

## Exact file scope

| File | Gate 1 change |
| --- | --- |
| `db/migrations/0011_asset_registration.sql` (new) | Four private tables, FKs/indexes/RLS, immutable group/member guards and deferred assignment-source exclusion |
| `src/lib/domain/asset-registration.ts` (new) | Strict typed intent and normalization/validation |
| `src/lib/server/asset-registration.ts` (new) | Disabled end-user boundary, isolated-target guard, canonical authorization and atomic relational command |
| `src/lib/server/asset-registration-projection.ts` (new) | Additive Owner/group inheritance and deployment-compatible reads |
| `src/lib/server/assets.ts` (modified) | Import projection helper, name existing serialized array, enrich it; only three narrow changes relative to captured dirty-tree file |
| `scripts/test-asset-registration.mjs` (new) | Guarded clone restore, single migration/provenance application, isolated tests, full preservation and owned cleanup |
| `tests/asset-registration.test.ts` (new) | 21 pure validator tests |
| `tests/server/asset-registration-persistence.test.ts` (new) | 22 real PG integration tests |
| This document (new) | Procedure, implementation/test evidence, limitations and rollback |

No other pre-existing repository file changed relative to the captured baseline.
In particular, existing People fixtures, UI/provider, identity/auth, booking/vendor
commands, migrations 0001–0010, environment files and configuration were preserved.
Private baseline/evidence under ignored `.local/gate1/` is not application code or
public documentation. The baseline records 371 pre-existing tracked/untracked files
and retains the original asset service for a narrow comparison.

## Schema and provenance

Migration: `0011_asset_registration.sql`

SHA-256:

```text
3921cdae740e720dbf44459a450e77f0bf844c1cbefc7239b4f0c7c405e3d619
```

New tables, applied **only in generated clones**:

- `asset_master.asset_groups`
- `asset_master.asset_group_memberships`
- `contact_core.asset_owner_contacts`
- `asset_master.registration_receipts`

Three narrowly scoped trigger functions and eight triggers provide asset-row
locking, deferred exclusion of competing direct/group assignment sources, and
rejection of group/membership changes. New tables use RLS and revoked public and
browser privileges. No media table change or new schema namespace is included.
Existing PIC table gets additive locking/exclusion triggers, not a data rewrite.
All existing logical schema definitions remain present after additive migration.

The driver verifies the exact existing ledger/checksums against the verified
bundle, permits only the reviewed pending 0011, takes the migration advisory lock,
and records a recovery baseline plus executed provenance inside the same clone
migration transaction. 0001–0007 remain observed_historical; 0008–0010 retain
executed status. It never executes historical SQL or contact imports.

**Active database remains at 0010.** Read-only final checks prove asset_groups is
absent there and no 0011 execution receipt was written to it. Applying this migration
to the active database is not authorized by Gate 1 or by this report.

## Recovery and preservation evidence

Fresh verified M0 bundle:

```text
.local/recovery/2026-10-28T05-42-31.914Z-c1522c7a
```

`backup-verify` dumped a read-only consistent source snapshot and copied private
media, restored DB/media into new isolated locations, compared schema, every table
row hash, sequences and media hashes, then removed the generated restore targets.
Result: **31 tables, 713 files; all comparisons PASS; sourceUnchanged true**.
Four existing M0 safety tests passed before capture. No new M0 baseline was recorded
in the active ledger.

Final integration evidence:

```text
.local/gate1/assethub_test_registration_c5de8406ffe674409baddfe2/
  migration.json
  vitest.json
  preservation.json
  cleanup.json
.local/gate1/final-source-preservation.json
.local/gate1/prechange-files.json
.local/gate1/prechange-status.txt
```

The final driver independently re-restored the verified bundle and copied media;
applied only 0011 to that owned clone; verified original schema definitions,
business-table hashes and sequences before command testing; then checked all
original rows as a multiset subset after tests (including original provenance).
New fixture/registration/audit rows are expected only in the clone. One imported
asset's existing metadata/PIC API was exercised and its payload/revision and exact
PIC timestamps/rows restored to their original clone values; its new audit is
retained only as clone test evidence until DB cleanup.

Final source comparison:

| Scope | Result |
| --- | --- |
| Active logical schema, 31 table hashes and all sequences | Identical to fresh M0 baseline |
| Existing catalog IDs/payloads/source keys/hashes | Preserved |
| Vendor/warehouse/contact/People records and original links | Preserved |
| Booking records/receipts/request number sequence | Preserved |
| All 713 original private media paths/bytes/hashes | Identical |
| Isolated media copy | Identical; no upload performed |
| Active migration maximum | 0010; Gate 1 schema absent |
| Remaining generated registration databases | 0 |
| Pre-existing repository files | Only intended `src/lib/server/assets.ts` changed |

All completed test attempts removed their generated database with an ownership
check and no force-disconnect/drop-CASCADE. Private evidence/media snapshots remain
ignored for inspection; no destructive orphan cleanup was run. This is same-cluster
PG17 logical recovery, not off-device disaster recovery or production certification.

## Executed verification

Final new suite: **43 PASS, 0 FAIL, 0 SKIPPED**:

- 21 pure validator tests (no database).
- 22 PG integration tests. All DB/storage/actor reads are real. Only the
  `server-only` package marker is mocked for Vitest import compatibility.
- A dedicated OS loopback listener exists in the test process; lsof verification
  is real, not mocked. Signed HttpOnly sessions are issued by the real local
  session helper, and People/roles/contact references resolve from clone PG.
- Requests are in-process Request objects, not a Next.js HTTP/browser test. Do not
  describe this as a new full Next/Turbopack runtime verification.

Coverage of G1-01–G1-18:

| Scenarios | Executed evidence |
| --- | --- |
| G1-01/13/14/17/18 | Standalone persisted/independently reconnected read; canonical catalog, optional metadata, manual provenance, same-ID unavailable/inspection-held mirror |
| G1-02/03/04 | Atomic group+first member; explicit second member with independent vendor location/condition and shared effective contacts/count; no direct member contact links |
| G1-05/06/07/08 | Invalid/missing/inactive contact, stale/missing group, invalid/mismatched/inactive/unverified warehouse, quantity/unit/enum failures; no partial rows |
| G1-09/10 | Three simultaneous identical commands on separate pool clients: one asset/group/audit/receipt, two replays. Changed actor/content conflicts; distinct keys preserve separate same-name/reference assets |
| G1-11 | Real temporary PG failure trigger injected separately at assets, groups, membership, Owner, PIC, booking mirror, audit and receipt inserts. Every failure leaves all relational row counts unchanged |
| G1-12 | Active StoreDev/Super Admin allowed; Brand/Vendor/Management denied; missing/forged cookies and actor-header spoofing rejected; inactive canonical actor rejected; hostile origin rejected |
| G1-15 | Real FK/exclusion/immutable constraints; RLS/public privilege checks; group Owner/PIC cannot be overwritten or given competing direct assignments |
| G1-16 | Full original-row preservation checks; original metadata/PIC command compatibility; active source unchanged; no registration POST or UI integration |

Additional cases preserve inherited inactive-contact warnings on reads, prevent
new member registration with inactive inherited contacts, retain unknown values,
reject ambiguous dates/PO/unsupported operational fields, and allow 50 PICs plus
a distinct Owner without conflating role identities.

Exact execution commands:

```sh
node --test scripts/persistence-m0.test.mjs
node scripts/persistence-m0.mjs backup-verify
node scripts/test-asset-registration.mjs .local/recovery/2026-10-28T05-42-31.914Z-c1522c7a
```

Driver invokes the two new Vitest suites with only its verified clone URL/token,
private copied media root and isolated dummy signing key. It clears inherited
ASSETHUB database/test-token overrides before invoking tests. No env file is copied
or changed. Reuse requires the source still matches the bundle and historical
artifacts; otherwise it stops and requires a fresh separately verified bundle.
The clone is always a new generated name; active/manual target selection is absent.

Regression command (all explicit suites, non-mutating):

```sh
env -u ASSETHUB_DATABASE_URL -u ASSETHUB_REGISTRATION_TEST_DATABASE_URL \
-u ASSETHUB_VENDOR_TEST_DATABASE_URL -u ASSETHUB_CONTACTS_TEST_DATABASE_URL \
-u ASSETHUB_ASSET_EDIT_TEST_DATABASE_URL -u ASSETHUB_PEOPLE_TEST_DATABASE_URL \
node node_modules/vitest/vitest.mjs run \
tests/server/authorization-characterization.test.ts tests/server/local-actor.test.ts \
tests/server/session.test.ts tests/identity-audit.test.tsx tests/approvals.test.tsx \
tests/local-identity-client.test.tsx tests/server/asset-edit.test.ts \
tests/asset-edit.test.ts tests/asset-import.test.ts tests/asset-units.test.ts \
tests/asset-contacts.test.tsx tests/asset-contact-picker.test.tsx \
tests/asset-editor-recovery.test.tsx tests/asset-location-contacts.test.ts \
tests/internal-contacts.test.ts tests/inventory-loading.test.tsx
```

Result: **157 PASS across 16 suites, 0 FAIL, 0 SKIPPED**, including existing
policy characterization/local actor/session/approval coverage. These are not
157 additional PostgreSQL persistence tests. No booking reservation business rule
or legacy command receipt was modified. Full booking/People DB-writing suites and
the known clock-sensitive reservations suite were not run; prior audit limitations
remain disclosed.

Scoped ESLint on the seven JS/TS files, `tsc --noEmit --incremental false`, and
`git diff --check`: PASS. One initial lint error for a Next-reserved test variable
was corrected; final lint is clean. Earlier intermediate successful test runs are
not added again to unique test totals. Total final unique checks: 43 new + 157
regression tests, with 4 M0 safety tests reported separately.

No UI changes were made. Desktop/mobile browser flows, photo validation/upload,
full Next process restart and second-browser-session verification are NOT RUN for
Gate 1; they belong to later activation/media gates. An independent SQL connection
read is not equivalent to those browser/restart acceptance scenarios. No production
registration, actual documentation persistence or complete Inventory claim is made.

## Remaining gates and rollback

- Gate 2: async Add/Edit provider/UI integration, including the existing importInfo
  edit guard, required selectors and draft recovery. Not implemented here.
- Gate 3: actual bounded validated primary-photo bytes, logical revisions,
  transactional associations, media receipts and safe explicit orphan reporting.
  Until then end-user durable registration remains disabled/unexposed.
- Gate 4: five-section Detail, human-readable durable history and CTA alignment.
  Only server read fields/evidence are prepared, not the screen redesign.
- Gate 5: full isolated Next/browser/media/restart/second-session regression and
  separate active migration/release review.

No remaining Gate 1 blocker was found in the verified isolated scope. Do not
activate the disabled command by removing its guard: Gate 3 must first supply
verified media coordination and pass combined tests.

Rollback is narrow: preserve earlier dirty/untracked work and reverse only this
report's new files and the three asset-service changes, using the private original
for comparison. Do not reset/clean the repository or remove contact implementations.
No active migration/data rollback is needed: none was applied. Keep recovery/evidence
artifacts private. If later active migrations occur, retain additive data/provenance
and forward-correct rather than restoring over later business writes.

**Authorization status:** no active migration, business record/media modification,
permission expansion, complete Add Asset activation, Borrowing/readiness activation,
commit or push. Stop after Gate 1 review.
