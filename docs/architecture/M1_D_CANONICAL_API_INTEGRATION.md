# M1-D — Existing API integration with canonical actors

Status: **Gate D PASS**, 26 October 2026. Local development only. No M1-E/F,
provider authentication, shared exposure, People administration persistence,
migrations, account mappings, roles, or new lifecycle permissions are activated.

## Authority and scope

Follow [M1 policy decisions](M1_IDENTITY_COMMAND_FOUNDATION.md),
[M1-C storage](M1_C_CANONICAL_PEOPLE_STORAGE.md), and [M0 recovery](M0_RECOVERY.md).
The intervening Asset Detail metadata editor remains in place, including its
approved StoreDev/Super Admin rule. Its transport is integrated alongside catalog
reads; its fields, optimistic revision and persistence rules are unchanged.

A valid local HttpOnly session identifies a stable Person ID. On **every request**,
the server loads that ID from `identity_core.people` and rejects missing/inactive
People. Profile, roles and scopes come from PostgreSQL, never token/header claims
or fixtures. The five development selector IDs remain explicitly allowlisted.
Provider mode remains unavailable; there is no email matching, account creation,
identity-link provisioning, fixture fallback or default Super Admin selection.

`getCurrentSession`, `getCurrentUser`, `hasCapability` and the two coarse local
capabilities are unchanged. Operational PIC contacts are independent business data.
The old `prototypeActor` server helper is removed. Vendor service guards re-read
canonical People rather than trusting the caller's role array. Reviewer assignment
looks up canonical People before invoking the existing domain validator. Booking
numbering, fingerprints, receipt lookup/write ordering, versioning and SQL/domain
rules are retained.

## API compatibility and projections

| Routes | Result |
| --- | --- |
| `/api/booking/requests` GET/POST | Trusted session required; GET shape and POST 201 retained. All active allowed local actors may submit; no new Requester-only rule. |
| `/api/booking/requests/[requestNumber]` GET/PATCH | Trusted session; original 200/404 and domain errors retained; resubmit remains requester or Super Admin. |
| `/api/booking/requests/[requestNumber]/review` POST | Original assign/decide bodies, versions and responses retained. Super Admin assigns; only the assigned current-cycle reviewer decides. |
| `/api/vendors`, `/api/vendors/[id]` | Canonical active Super Admin; original drafts, versions, success shapes, STALE/CONFLICT/VALIDATION behavior retained. |
| `/api/vendor-locations` | Active canonical actor; existing eligible-warehouse projection unchanged. |
| `/api/assets`, `/api/assets/[assetId]` | Existing catalog/read and edit payloads/responses retained; edit remains StoreDev/Super Admin. |
| `/api/assets/media/[key]` | Canonical session plus the existing signature/expiry/object-key checks. Cookie path `/api` supports normal same-origin image loads. Valid content/cache headers retained. |
| `/api/actor` | Existing minimal identity, ID/name and capability response preserved. |
| `/api/actor/person` GET (new) | Authenticated actor's own Person profile only, supporting current UI roles/scopes and request contact defaults. No People CRUD or link projection. |
| `/api/development/session` GET (new) | Local-boundary-only selector bootstrap: active allowlisted IDs/names/status/roles; no email, scope or links. Reading does not issue a cookie. |
| `/api/booking/reviewers` GET (new) | Authenticated local actor; active internal reviewer ID/name/status/roles only. Vendor-role exclusion is unchanged, including multi-role People. Requester exclusion remains request-specific. |

Authentication failures are intentionally distinct from domain errors:
`401` missing/invalid/expired/unresolved session, `403` origin/ingress rejection,
`404 LOCAL_ACTOR_DISABLED`, or `503` unconfigured provider/unverified listener/
unavailable identity storage. Feature-disabled booking/vendor responses retain
existing `503 DISABLED` semantics. Successful public command shapes and existing
domain error codes are unchanged; unauthenticated booking reads are now gated as
explicitly authorized by M1-D, without adding shared own/team/all visibility rules.

Browser clients use same-origin cookies and send no prototype actor headers.
Me retains its existing HeroUI selectors and legacy role-view control. Its current
local user selector now makes an explicit server selection and hydrates the actor's
canonical profile; bootstrap restores only an existing cookie. Missing sessions
show no selected/privileged actor. `setCurrentUserId` remains a local prototype-state
helper used by policy tests, not authentication; Me uses the server-selection action.
Remaining prototype People CRUD/operational state is not made durable by this slice.
Reviewer choices/display for persisted requests use the narrow canonical projection.

## Recovery and data preservation

Fresh verified pre-run bundle:
`.local/recovery/2026-10-26T05-44-23.078Z-3481be8a`.
M0 restored all **28 tables and 713 media files** into a generated temporary target;
schema, complete row hashes, sequences and media hashes matched. Source unchanged.
No active database migration, import, seed, identity mapping or application write ran.

The M1-D runner restores that bundle into a uniquely owned
`assethub_m1d_test_<24 hex>` PostgreSQL 17 database and copies media/source into a
private `.local/m1d-runtime-*` checkout. Next listens only on `127.0.0.1:4319`.
No environment files are copied; test process values are explicit. The active dev
server/listener is untouched. All generated databases from completed attempts were
dropped. Runtime evidence includes the actual `lsof` process/listener listings.

Final source comparison: all 28 tables, schema, sequences and media identical
(`.local/m1d-runtime-0KJ4ST/final-preservation.json`, rechecked after all tests).
Clone checks also preserve catalog IDs/payloads, media references, identity links,
and development-import records. Expected command writes affect only the clone's
booking/vendor/audit records; controlled activity/role/name changes affect only
clone People. No DDL/migration changes occur even in the M1-D clone.

The source baseline has **zero historical command receipts**. This is not evidence
of a real historical replay. The runner additionally inserts a synthetic receipt
using the unchanged legacy submit fingerprint contract, replays it through the
cookie-authenticated API, and verifies unchanged receipt bytes and request identity.
It also checks submit/resubmit retries, changed-content STALE rejection, stable
item IDs, review rounds and successful Super Admin resubmission.

## Verification evidence

Final runtime evidence: `.local/m1d-runtime-0KJ4ST/results.json`.
Desktop/mobile screenshots: `desktop.png` and `mobile.png` in that same private
directory. No cookies, signing keys or credentials appear in evidence output.

- **PASS:** default-disabled protected routes; header-only requests denied across
  booking, vendor, catalog, self-profile and reviewer APIs.
- **PASS:** signed HttpOnly/SameSite Strict cookies, browser delivery, subsequent
  navigation and real process-restart invalidation. Expiry uses a child-process-only
  clock offset, not a production TTL change or wall-clock soak.
- **PASS:** forged cookies, forged actor/role headers, foreign Origin/Host and
  forwarding-header attacks; inactive and missing canonical People rejected.
- **PASS:** canonical name changes appear without fixture edits; selector/reviewer
  projections omit contacts/scopes; inactive and Vendor-role reviewers excluded.
- **PASS:** no Super Admin decision override; assignment self-review restriction;
  reason requirements; requester/admin resubmit and denied unrelated actor.
  An already assigned reviewer gaining a Vendor role is not subject to an invented
  decision-time Vendor-role ban. Status/activity is still checked by authentication.
- **PASS:** catalog has 1,073 records; valid media loads with a session; missing
  session or altered signature fails; non-editor catalog metadata mutation denied.
- **PASS:** vendor update and stale-version conflict through unchanged contracts.
- **PASS:** UI selector, reload/cookie use and navigation at **1440×1000** and
  **390×844** through `/me`, `/assets`, `/requests`, `/requests/new`, imported asset
  detail and `/admin/warehouses-vendors`. No horizontal overflow or page JS errors.
  No full screen-reader audit or approved screenshot-baseline comparison is claimed.
- **PASS:** provider mode fails closed; unavailable `lsof` denies activation.
  Wildcard-listener rejection is covered by existing parser/listener tests; no
  wildcard/shared server was opened to test it.
- **PASS:** Gate A/B regressions plus asset metadata/client tests: **132 tests in
  nine suites**. Existing policy assertions remain; transport doubles now model
  cookies/canonical repository responses. Historical unauthenticated GET/header
  transport assertions are explicitly replaced by the approved M1-D boundary.
- **PASS:** Gate C **12 tests** on an isolated pre-M1-C restored database, removed
  afterward; the existing asset-edit PostgreSQL regression **1 test** passed
  with real cookies/canonical People in another removed clone (OS ingress mocked
  only for that in-process test); M0 safety **4 tests**; scoped ESLint and application/test TypeScript.

Reproducible runtime command (requires the installed PG17 tools and Chromium):

```sh
node scripts/test-m1d-runtime.mjs .local/recovery/2026-10-26T05-44-23.078Z-3481be8a
```

Early harness attempts stopped safely on UTC manifest normalization, missing
explicit PostgreSQL user in the sanitized child environment, unsuitable test
asset/draft selection, UUID parameter typing and a media-manifest property typo.
These were harness corrections; no permission, listener, origin or business-rule
check was relaxed. Temporary diagnostic logging was confined to a disposable copy
and is absent from the final source and passing runner.

## Exact M1-D file boundary

New files:

- `src/server/people/canonical.ts`
- `src/lib/actor-client.ts`
- `src/features/prototype/use-local-identity.ts`
- `src/app/api/actor/person/route.ts`
- `src/app/api/booking/reviewers/route.ts`
- `tests/local-identity-client.test.tsx`
- `scripts/test-m1d-runtime.mjs`
- `docs/architecture/M1_D_CANONICAL_API_INTEGRATION.md`

Existing files changed for this slice:

- `src/server/auth/local-actor.ts`
- `src/app/api/development/session/route.ts`
- `src/lib/server/booking.ts`
- `src/lib/server/vendors.ts`
- `src/lib/server/assets.ts`
- `src/lib/server/vendor-http.ts`
- `src/app/api/booking/requests/route.ts`
- `src/app/api/booking/requests/[requestNumber]/route.ts`
- `src/app/api/booking/requests/[requestNumber]/review/route.ts`
- `src/app/api/vendors/route.ts`
- `src/app/api/vendors/[id]/route.ts`
- `src/app/api/vendor-locations/route.ts`
- `src/app/api/assets/media/[key]/route.ts`
- `src/lib/booking-client.ts`
- `src/lib/vendor-locations-client.ts`
- `src/features/prototype/prototype-provider.tsx`
- `src/features/profile/me-screen.tsx`
- `src/features/admin/vendor-master-screen.tsx`
- `src/features/requests/request-review-section.tsx`
- `src/features/requests/approval-screen.tsx`
- `tests/server/authorization-characterization.test.ts`
- `tests/server/local-actor.test.ts`
- `tests/identity-audit.test.tsx`
- `tests/approvals.test.tsx`
- `tests/booking-persistence.test.ts`
- `tests/vendor-persistence.test.ts`
- `tests/server/asset-edit-persistence.test.ts`
- `docs/domain/ASSET_CATALOG_IMPORT.md`
- `docs/architecture/M1_IDENTITY_COMMAND_FOUNDATION.md`

Private recovery/runtime copies and scoped typecheck configuration live under
ignored `.local/`. Pre-existing `next-env.d.ts`, M0–C artifacts, and the asset editor
implementation are not M1-D changes to discard. No package, environment,
configuration, migration or schema object is changed by M1-D.

## Activation, rollback and remaining gates

Local mode remains disabled by default. After deliberately stopping the existing
listener, a developer may start the intended development instance explicitly:

```sh
ASSETHUB_ACTOR_MODE=local-development \
ASSETHUB_LOCAL_ACTOR_ORIGIN=http://127.0.0.1:3000 \
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Use that exact origin and select a Person in Me. Do not activate identity against
an externally bound/shared listener, add a reverse-proxy bypass, persist the
session signing key, or fall back to prototype headers when a session fails.
Restart requires deliberate selection again. This task did not stop/reconfigure
the active wildcard-bound port-3000 server or edit `.env.local`.

Rollback requires no database/schema recovery: no active records changed. Stop the
opt-in local process to invalidate sessions, remove its process-only mode values,
and selectively reverse only the M1-D changes listed above. Preserve M0–C and the
intervening asset-editor changes, which share some files. Do not use `git reset`,
`git clean`, remove whole untracked directories, or replay migrations in this dirty
working tree. Keep the recovery bundle if a later milestone needs actual data
recovery; never restore it over the active database automatically.

Shared/provider access, explicit provider links, D8 decisions, People CRUD authority,
new operational grants and later persistence milestones remain gated. The legacy
Vendor UUID mapping remains unresolved and unchanged. Gate D is a local integration
pass, not a shared deployment or comprehensive accessibility certification.
No M1-E or later work, commit or push is included.
