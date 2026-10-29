# M0 — Persistence baseline and recovery

## Scope and authority

M0 adds recovery tooling and provenance only. It does not implement identity,
operational persistence, API changes, UI changes, new business rules, automatic
migrations, or M1. Follow `AGENTS.md`, `AI_GUIDE.md`, `docs/00_README.md`, and
`docs/engineering/ADR_001_BACKEND_AUTH_STORAGE.md` for subsequent work.

The active development database must never be reset, truncated, or used as a
restore target. Existing migration files 0001–0007 remain unchanged. Do not run
`db:booking:migrate`, seeds, import tools or data-writing application tests as
part of this procedure. The legacy booking runner executes every numbered SQL
file; it is not a provenance-aware incremental migration runner.

## Files and database objects

- `scripts/persistence-m0.mjs`: explicit PostgreSQL 17 backup/restore verification
  and guarded M0 provenance recording. No startup hook or package-script change.
- `scripts/persistence-m0.test.mjs`: safety guard tests using Node's test runner;
  these tests do not connect to PostgreSQL.
- `db/migrations/0008_persistence_provenance.sql`: creates only the private
  `app_core` schema, `persistence_baselines` and `migration_provenance` tables,
  their indexes/constraints, RLS and revoked public/browser privileges.
- This document: exact operating and recovery boundaries.

Historical provenance rows contain the observed file checksum and
`provenance=observed_historical`, with `executed_at=NULL`. They **do not prove**
that those historical scripts ran, that their historical contents were identical,
or that all historical changes came from migration files. Only 0008 receives an
`executed` record when the tool actually executes it successfully.

The baseline row anchors the pre-M0 schema fingerprint, full-table count/hash
manifest, media-manifest hash, migration artifacts and verified recovery bundle.
No business payloads, credentials or full contact records are copied into the
ledger. The database owner can modify this ledger; it is not a tamper-proof audit
service or a general migration framework.

## Prerequisites

Run from the AssetHub repository root with its installed Node/`pg` dependencies.
The tool reads `.env.local` with Node's environment parser and honors an explicitly
inherited `ASSETHUB_DATABASE_URL`. It never edits either environment or config.
Check overrides privately before use; never echo connection strings.

Only a named loopback PostgreSQL 17 database is accepted. The connecting role must
be able to read/dump all application objects and create/drop a fresh isolated
database. PostgreSQL client tools default to:

```text
/opt/homebrew/opt/postgresql@17/bin
```

An explicit `ASSETHUB_PG_BIN` can select another trusted PostgreSQL 17 installation.
No installation or download is performed. Stop on permission, integrity, disk,
tool-version, source-drift, or restore errors. Do not add `--clean`, force-drop
databases, weaken checks, or run the application migration suite to repair them.

Avoid concurrent application writes, imports and schema changes during capture.
The tool does not stop the app: it detects source drift and refuses to certify the
bundle. Recording provenance takes short, NOWAIT SHARE locks on existing tables;
if busy, it stops rather than waiting indefinitely or terminating sessions.

## 1. Capture and verify a fresh backup

```sh
node --test scripts/persistence-m0.test.mjs
node scripts/persistence-m0.mjs backup-verify
```

The command prints the new bundle path only after success. It:

1. Creates a private, uniquely named `.local/recovery/<bundle-id>/` directory.
2. Exports a repeatable-read, read-only database snapshot. PostgreSQL `pg_dump`
   uses that same snapshot to create `database.dump` in custom archive format.
3. Captures schema definitions, owners/effective ACLs, constraints, indexes, RLS,
   policies, functions, views, triggers, defaults and sequence definitions/state.
4. Hashes every ordinary user table's complete rows in deterministic order using
   PostgreSQL JSONB text and UTC timestamp rendering. IDs and relationships are
   covered by full row hashes, not merely row counts.
5. Checks every registered media object's size and content-addressed SHA-256 key;
   copies and hashes the entire private media tree, including unregistered files.
6. Archives migration files and their SHA-256 hashes. It never executes them.
7. Restores into a new `assethub_m0_restore_<24 hex digits>` database created from
   `template0`, using `pg_restore --exit-on-error --single-transaction`.
8. Compares restored schema, all row hashes/counts and sequence values. Copies
   media into a separate restore directory and compares every SHA-256 hash.
9. Removes only that newly created restore database and verified media copy.
   It does not force-close sessions or use `DROP ... CASCADE`.
10. Rechecks the source database, media and migration files for drift, then writes
    `verification.json` with `verified=true` and `sourceUnchanged=true`.

Default-equivalent explicit ACLs are fingerprinted as effective grants: PostgreSQL
may restore an owner-only default ACL as NULL instead of an explicit owner grant.
This normalization does not ignore privilege differences or remove ACL checks.

Bundle contents:

```text
database.dump          Full database archive, including schema/data/ACLs
baseline.json          Schema fingerprint, row/sequence/media/migration manifests
media/                 Private binary copy
migrations/            Exact SQL artifacts at capture time
dump.log               Private command diagnostics
restore-*.log          Private per-attempt restore diagnostics
verification.json      Successful source/restore verification result
```

A failed attempt has no successful verification receipt. It can retain partial
artifacts and `restore-difference-*.json` for investigation. Do not use it to record
a baseline. If cleanup fails, inspect the reported generated target, confirm its
identity, and seek operator action; never target the active database.

Large objects are explicitly rejected because their contents are not covered by
the current manifest. This implementation is validated against the current
AssetHub schema; new persistence mechanisms require extending the verifier.

## 2. Record the initial provenance, once

After inspecting a successful fresh bundle, run:

```sh
node scripts/persistence-m0.mjs record-baseline .local/recovery/<verified-pre-M0-bundle-id>
```

This is the **only active-database write operation in M0**. It requires the exact
source data/schema/media and migration artifacts to still match the verified
bundle. It refuses an existing `app_core` schema, unexpected migration files,
changed artifacts and concurrent provenance recording.

One transaction applies **only** 0008, inserts one baseline, records 0001–0007 as
observed historical artifacts, and records 0008 as executed. An error rolls the
transaction back. No application table, sequence, feature flag or media object is
changed. Do not manually rerun historical migrations to justify ledger entries.

For subsequent milestones, first implement an explicit checksum-aware migration
runner with serialized execution, pending-only application, transactional DDL where
supported, failure recording, schema checks and recovery gates. M0 intentionally
does not provide a general-purpose `migrate all` command. Never treat an
`observed_historical` row as proof of an old migration's successful execution.

## 3. Back up the recorded ledger and re-verify

```sh
node scripts/persistence-m0.mjs backup-verify
```

Keep both the pre-M0 and post-M0 verified bundles. Compare all original table
hashes/counts, sequence states, effective schema definitions, media hashes and
migration artifacts across them; only the new `app_core` objects/rows may differ.

To repeat a recovery drill without changing the active database:

```sh
node scripts/persistence-m0.mjs verify-backup .local/recovery/<verified-bundle-id>
```

This validates archive/media checksums, creates a fresh isolated database, restores
and compares it, and removes only that generated database. It does not overwrite
the original verification receipt. It requires an accessible local connection for
creating the temporary database; it is a drill, not an automatic disaster cutover.

## Actual recovery, separately authorized

For data loss, preserve the damaged database and logs. Select a trusted verified
bundle, verify its checksums/media manifest, and restore to a **new** database and
new media directory. Never restore into `assethub_dev` or replace live media in
place. On the same PostgreSQL cluster, use the existing operator authentication
without placing credentials in command arguments:

```sh
# Example new name; confirm it does not already exist. Use trusted PG17 binaries.
PGHOST=localhost PGPORT=54329 PGDATABASE=postgres \
  /opt/homebrew/opt/postgresql@17/bin/createdb --template=template0 assethub_recovered_YYYYMMDDHHMM
PGHOST=localhost PGPORT=54329 \
  /opt/homebrew/opt/postgresql@17/bin/pg_restore --exit-on-error --single-transaction \
  --dbname=assethub_recovered_YYYYMMDDHHMM .local/recovery/<bundle-id>/database.dump
```

Use existing `PGUSER`/secure password handling if required; the commands above
assume the current local operator owns the objects, as in this validated setup.
Do not use `--clean`, `--create` or an active database URL. Restore media with an
exclusive copy to an absent directory, then compare the full file path/size/hash
manifest. Use the exported `manifest()` helper inside a read-only UTC transaction
to compare the restored database to `baseline.json`, as the drill does. Validate
sequence state and the application/media references before any promotion.

Application connection/media-path cutover, secret restoration and UI validation
require a separate reviewed operation. M0 does not change adapters or configuration
to point at recovered locations. Signed URLs are temporary; signing credentials
must be recovered through the existing secure secret procedure, never Git.

The database dump does not back up cluster-global roles, password credentials,
tablespaces or PostgreSQL service configuration. Cross-machine restore must
recreate required roles/ownership and verify locale/version compatibility in a
separate rehearsal. Current proof is a same-cluster PostgreSQL 17 logical restore.

## Permissions, retention and rollback

Recovery directories are mode 0700; sensitive generated files use a 077 umask.
`.local/` is already Git-ignored. Backups contain private source/contact data;
never commit them, attach them publicly, or expose them through the app.

These are local, unencrypted backups on the same disk. They protect against
application/database mistakes, not disk loss or a compromised account. Off-device
encrypted copies and retention ownership remain operator decisions. Never delete
the only verified bundle. No automatic pruning, scheduling or hook was added.

To roll back tooling, remove only the M0-specific files after preserving required
recovery artifacts. Keeping the provenance tables is normally the safest database
rollback. If their removal is explicitly approved, inspect dependencies first and
drop only these two tables/schema using RESTRICT in a transaction; do not restore
an old development database over later business writes or use CASCADE. Once later
milestones depend on `app_core`, plan a forward correction instead.

## Verified run — 21 October 2026

- Baseline ID: `a8eaff3e-9353-46fd-a732-64036043d784`.
- Verified pre-M0 bundle: `.local/recovery/2026-10-21T09-59-32.313Z-0b1ad60f`.
- Verified post-M0 bundle: `.local/recovery/2026-10-21T10-00-32.679Z-f88599cc`.
- Pre-M0 schema SHA-256:
  `7c275a21e55caceea5f835fb1aa48dde7c4e8c721a4dab6b48a2328d3792d105`.
- Post-M0 schema SHA-256:
  `406456b3f08d798d5ebf33353b27285e70725e70b05d19b33d1f22af5d59a335`.
- All 23 original tables have identical complete row hashes/counts; 25 tables
  restore after adding the two provenance tables. Original schema definitions,
  effective privileges, sequence values and migration artifacts match.
- 713 media files, 227,475,091 bytes, have identical full SHA-256 manifests.
- Pre/post database archives: 471,429 / 478,186 bytes.
- Seven historical entries have no execution timestamp; only 0008 is executed.
- No temporary restore database remains. Existing application files/configuration,
  business records, feature flags and media were not changed.
- The initial attempt stopped on explicit-versus-default ACL representation;
  table/sequence data matched. Effective-ACL fingerprinting corrected that false
  mismatch; the failed bundle was retained without a verification receipt.

M0 provides a verified recovery foundation for M1 planning/implementation. It does
not resolve identity provisioning, capability policy, timezone, quantity allocation
or other blueprint decisions, and is not production-readiness approval.
