# M1-C — Canonical People storage and controlled identity mapping

Status: **Gate C PASS**, 22 October 2026. Storage is installed in the local
PostgreSQL development database, but no application route, actor/session resolver,
React provider or UI uses it as authority. Stop boundary: M1-C only.

> The status above describes the M1-C slice at its delivery date. Current runtime integration is documented in [M1-D](M1_D_CANONICAL_API_INTEGRATION.md). Earlier M1-B verification reports are historical and kept outside the active repository.

## Authority and preserved behavior

Read [M0 recovery](M0_RECOVERY.md), the
[M1 policy register](M1_IDENTITY_COMMAND_FOUNDATION.md),
[People/domain rules](../domain/PEOPLE_ROLES_SCOPE_AND_AUDIT.md) and
[ADR 001](../engineering/ADR_001_BACKEND_AUTH_STORAGE.md).

D1 local-only identity, D2 command-specific permissions, D5 People UI/service work
in M1-F, D6 explicit identity mapping and D8 deferred self-role/last-admin policy
remain unchanged. The repository is a storage primitive, not an authorization
service. Existing self-inactivation inconsistencies remain characterized; this
slice neither fixes nor broadens them.

The existing `Person` type has no version field. Its fields and text IDs remain
unchanged; `StoredPerson` wraps that profile with a positive integer version and
optional resolved Vendor UUID. New imports start at version 1, updates require the
expected version and increment once, and stale writes return CONFLICT. Profile
creation/update instants are preserved; PostgreSQL projects equivalent UTC ISO
strings rather than the fixture's original timezone spelling.

## Exact added files and migration checksum

1. [0009_canonical_people.sql](../../db/migrations/0009_canonical_people.sql)
2. [repository.ts](../../src/server/people/repository.ts)
3. [people-m1c.mjs](../../scripts/people-m1c.mjs)
4. [people-m1c.d.mts](../../scripts/people-m1c.d.mts)
5. [test-people-m1c.mjs](../../scripts/test-people-m1c.mjs)
6. [people-persistence.test.ts](../../tests/server/people-persistence.test.ts)
7. This document.

`0009_canonical_people.sql` SHA-256:

```text
dca0649bc1eda0daa28c61419a0c9d68385b4ffda0a461e058bce6ee4a487192
```

Migration 0009 was the next available file and was applied by itself. No earlier
migration file, application consumer, package/configuration/environment file,
existing fixture identity or existing M0/M1 artifact was changed. No automatic
migration hook, authentication provider or dependency was introduced.

## New database objects

Private schema `identity_core` contains:

- `people`: stable text primary key, name/email/status, the existing six roles,
  ordered Brand/Category/Area/DC scope arrays, original legacy Vendor reference,
  nullable explicit Vendor UUID FK, version and timestamps. Email uniqueness uses
  `lower(btrim(email))`, including inactive People.
- `identity_links`: exact case-sensitive `(issuer, subject)` uniqueness, explicit
  Person and linking-operator Person FKs, linked timestamp, revocation timestamp,
  revoking Person/reason and optimistic version. Links do not use email lookup.
- `development_imports`: append-only-by-tool import receipts with source checksum,
  inserted/skipped IDs and time. No automatic imports occur during sign-in.
- `distinct_nonblank(text[])`: structural array validation function. Role values
  are constrained to existing enums. Repository validation reuses the existing
  `validatePersonDraft` for canonical organizational IDs and legacy associations.

All three tables have RLS enabled with no browser policies. Public and existing
browser-role schema/table/function privileges are revoked. Owner/server access is
not a new product permission. Primary/unique indexes and the Person lookup index
support identity-link integrity. No new organizational Master Data was created.

No existing booking/audit/receipt column was altered or given a new FK. Historical
actor references include `dev-user` and `legacy`. `legacy` remains an opaque
historical label; no Person, role or identity link was invented for it.

`user-vendor` retains `legacy_vendor_id='vendor-abc-production'`. Its resolved
`vendor_id` remains NULL; no lookup by name/email or cast to UUID was attempted.
The Vendor UUID column references the existing directory but has no resolution
workflow in this slice. Future resolution requires an explicit approved mapping.

## Repository and import contracts

`PeopleRepository` requires an exclusively checked-out PostgreSQL client. It does
not construct a pool or read a database environment variable. Versioned updates
and link creation/revocation are atomic SQL operations. Caller-owned transactions
are required for imports/combined operations. No command authorization or
capability inference is implemented inside this storage layer.

Identity resolution joins only the explicit issuer/subject link, requires an
unrevoked link and active Person, and returns no match otherwise. It never creates
a Person on lookup. A revoked issuer/subject pair remains reserved by the unique
constraint; no reactivation/reassignment operation is provided. Any future transfer
or reactivation workflow requires approval rather than an implicit upsert.

The development import reads the five current server fixtures and:

- Validates through existing People rules, preserving IDs, role/scope array order,
  status and original timestamps.
- Inserts missing IDs with version 1; checks existing IDs first and uses
  `ON CONFLICT(id) DO NOTHING` for a race. Existing records are never overwritten,
  reactivated, re-versioned or relinked by a repeat import.
- Rejects a conflicting normalized email on a different new ID; the operator
  transaction rolls back the entire import and, for apply, the DDL/provenance.
- Creates no identity links and guesses no Vendor UUIDs.
- Records inserted/skipped IDs and fixture-payload SHA-256:
  `b8ada69e1713d4d8a1a62ddb23a68700b38a0a2541dacb7db610e0f4a240699a`.

## Operator procedures and provenance

Use the installed Node 22.22+ and PostgreSQL 17 tools. The explicit CLI loads
TypeScript repository/fixtures with a temporary, process-local Node resolution
adapter and then deregisters it. It does not install a global loader, change Next
configuration, or bypass the application's `server-only` bundler guard in the app.

Before each active-database operation, capture a fresh exact recovery bundle:

```sh
node --test scripts/persistence-m0.test.mjs
node scripts/persistence-m0.mjs backup-verify
node scripts/test-people-m1c.mjs .local/recovery/<verified-pre-change-bundle>
```

Initial apply only, after review of that bundle, checksum and isolated tests:

```sh
node scripts/people-m1c.mjs apply assethub_dev .local/recovery/<verified-pre-change-bundle>
```

This command was executed once against the explicitly verified loopback
`assethub_dev` on port 54329, PostgreSQL 17.11. The successful transaction created
the schema, imported five People, appended a fresh pre-change baseline and recorded
only 0009 as executed. Earlier observed/executed rows remained byte-equivalent.
Seven historical rows still have no execution timestamp; 0008 and 0009 are executed.

The tool checks exact target name, PostgreSQL major, verified archive/media,
current full schema/data manifest, exact migration inventory and prior checksums.
It serializes through an advisory lock, takes NOWAIT SHARE locks, executes only
0009 inside one transaction and checks original schema/data/sequence/media and
historical provenance before commit. Any drift stops it. It is intentionally
frozen to inventory 0001–0009; future migrations require a separately reviewed
runner update. Do not use the legacy full-suite migration command.

A later controlled import requires a new verified bundle of the *current* source:

```sh
node scripts/persistence-m0.mjs backup-verify
node scripts/people-m1c.mjs import-people assethub_dev .local/recovery/<new-verified-current-bundle>
```

`import-people` never runs DDL or changes migration provenance. It verifies all old
canonical People/import receipts, identity links, business tables, existing schema
and provenance, allowing only insertions and an appended import receipt. Reusing a
stale bundle fails safely. This command was validated on a restored post-change
copy: zero inserted, five skipped, all existing People unchanged. No second import
was needed against active development data.

Success and failure diagnostics are private `.local/m1c/` receipts. Failure
receipts do not claim that an uncertain commit did or did not occur: inspect the
database ledger before retrying. Never replay 0009 to repair a diagnostic failure.

## Actual recovery and preservation evidence

| Evidence | Verified result |
| --- | --- |
| Pre-change bundle | `.local/recovery/2026-10-22T06-38-33.718Z-795b522d` |
| Pre-change restore | 25 tables, full schema/row hashes/sequences and 713 media files matched |
| Pre-change schema SHA-256 | `406456b3f08d798d5ebf33353b27285e70725e70b05d19b33d1f22af5d59a335` |
| Post-change bundle | `.local/recovery/2026-10-22T06-56-04.891Z-b8a92972` |
| Post-change restore | 28 tables, full schema/row hashes/sequences and 713 media files matched |
| Post-change schema SHA-256 | `16011a57527dccd404bb21318c9d52186c78ed375d95d45d2c175544cf8e96eb` |
| Existing business tables | All 23 full row hashes/counts identical |
| Existing schema definitions, sequences and media | Identical; 713 media files, no reference rewrites |
| Existing catalog / vendors / warehouses / bookings | 1,073 / 34 / 59 / 8 records preserved; all child/history records also hash-identical |
| Historical command receipts/audit and legacy identities | Preserved, with no relinking or backfilled actors |
| New canonical state | 5 People, version 1; 0 identity links; 1 import receipt; 0 resolved Vendor UUIDs |
| Provenance/baselines | 8 -> 9 migration rows and 1 -> 2 baselines; original rows preserved |
| Final source versus post-change bundle | Exact full database-manifest match |
| Temporary databases / servers | All owned test/restore databases and dedicated runtime servers removed/stopped |

The two M0 bundle verification receipts report `verified=true`, schema/row/
sequence/media match and `sourceUnchanged=true`. Keep both private bundles.
M0's same-disk/unencrypted backup limitations and separately authorized cutover
procedures still apply; never restore over the active database.

Private non-secret/hash-oriented verification artifacts include
`.local/m1c/initial.json`, `preservation.json`, `legacy-actor-references.json`,
`controlled-reimport.json`, `final-verification.json`, operation receipts and
private restore logs. Do not publish database archives or profile/media contents.

## Tests and runtime compatibility

- **12 PostgreSQL integration tests PASS** on fresh generated
  `assethub_m1c_test_<24 hex>` PostgreSQL 17 databases restored from the verified
  pre-change archive. Targets never use active/generic test names. The runner drops
  only the database it created after successful tests; failures retain that target.
- Coverage includes fixture field/role/scope/date preservation, duplicate email,
  invalid scope/role rejection, version conflicts, edited/inactive Person retention
  on repeat import, no implicit links, exact issuer/subject lookup, FK/uniqueness,
  revocation/history, RLS/private access and accurate migration provenance.
- Before successful apply, a deliberate duplicate-email import proved that DDL,
  new provenance and partial imports roll back together. Re-applying with the old
  pre-change bundle was rejected without replaying DDL.
- **118 existing Gate A/B tests PASS**, including all original 57 characterization
  checks and the runtime-normalization regressions. M0's four safety tests PASS.
- Scoped ESLint, formatting and application/new-test TypeScript checks PASS,
  without emitted application files or TypeScript cache writes.
- Fresh disposable Next.js 16.3.0/Turbopack and Chromium retest PASS. Evidence:
  `.local/m1c-runtime-eB6B2M/runtime-results.json`. Default GET/POST stayed 404;
  selection and cookie-backed actor resolution were 200; spoofed actor headers
  could not change identity/capabilities; Origin/Host/proxy/CSRF probes were 403;
  invalid cookies and actual restart invalidation were 401; missing lsof was 503.
  Signed expiry used an isolated accelerated process clock, not a changed TTL.
  Desktop/mobile `/assets` were 200 at 1280x800 and 390x844. Non-loopback access was
  refused. Legacy database-disabled responses matched across modes.

The disposable runtime had a dummy port-1 database URL and persistence flags off.
Trusted identity still worked. Static consumer inspection also found canonical
storage references only inside the new repository, not API routes, session/auth
adapters, UI or the React provider. Existing fixture/coarse-capability behavior is
therefore retained. Full live database-backed UI/operational mutation tests were
not run; this slice does not claim they were.

## Rollback and next-slice gates

Before commit, any SQL/import failure rolls back atomically. After successful
commit, keeping the unused additive schema is the safest rollback boundary:
existing routes have no dependency on it. Preserve verified bundles and ledger.
Do not delete People or links, reset the database, replay historical scripts,
restore over later writes or remove provenance to make a retry look pending.
If removal is requested later, review dependencies and use a separately authorized
narrow operation; never CASCADE away related business history.

**Gate C PASS.** No M1-C technical blocker remains. Before M1-D, separately approve
its exact consumer/command scope and transaction/audit/idempotency boundaries.
Historical `legacy` actor labels and unresolved legacy Vendor associations must
remain preserved; they are not authenticated accounts or automatic mapping inputs.
People UI/authority activation stays gated to the approved later slice. Provider
verification/mapping provisioning, shared access, D8 policies and operational
permission gaps are not resolved or activated here. No M1-D work, commit or push.
