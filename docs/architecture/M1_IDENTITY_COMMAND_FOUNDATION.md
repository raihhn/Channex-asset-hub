# M1 Identity and Command Foundation

Status, 22 October 2026: M1-A policy baseline plus opt-in M1-B trusted local actor
contracts. M1-B adds isolated server boundaries without migrating existing APIs
or changing UI, schema, configuration or business rules. This document does not
turn prototype permissiveness or implementation gaps into approved permissions.

## Authority and approved decisions

Follow `AGENTS.md`, `AI_GUIDE.md`, and the authority order in `docs/00_README.md`.
Read [People and Audit](../domain/PEOPLE_ROLES_SCOPE_AND_AUDIT.md),
[Manual Request Review](../domain/MANUAL_REQUEST_REVIEW.md),
[Authentication and Access](../engineering/AUTH_AND_ACCESS.md), and
[ADR 001](../engineering/ADR_001_BACKEND_AUTH_STORAGE.md) for domain constraints.

| Decision | Approved boundary |
| --- | --- |
| D1 | Local-only development identity foundation; no shared authentication activation. |
| D2 | Preserve confirmed command-specific rules; no implied role/capability grants. |
| D5 | Existing People create/edit/status becomes durable in M1-F, not M1-A. |
| D6 | Explicit account-to-Person mapping; no email auto-linking or privileged self-provisioning. |
| D8 | Deferred. Preserve existing self-inactivation behavior; do not invent self-role or last-admin policies. |

M0 remains the verified recovery foundation. No migration or database test is
needed for M1-A. Historical provenance is not execution proof; no M0 artifacts or
records are changed by this slice. See [M0 procedures](M0_RECOVERY.md).

## Identity distinctions

- `Person` is the organizational identity with stable ID, multiple roles, status,
  Brand/Category/Area/DC scopes and optional Vendor association.
- `Session` / `CurrentUser` is a separate development session contract. The default
  session grants only `asset:read` and `request:create`, even though the Person
  with the same `dev-user` ID has a Super Admin role.
- Browser-selected `currentUser` and `x-prototype-actor-id` are fixture-based
  development impersonation, not provider verification.
- The five-value legacy role-view selector is presentation state. It does not
  select a server actor or grant asset-registration authority.
- Operational site/sending/receiving PICs are business data, not authentication.
  Do not create accounts or join identities from matching contact strings.

Sources: [auth types](../../src/types/auth.ts),
[Person types](../../src/types/identity.ts),
[session adapter](../../src/server/auth/dev-session.ts),
[capability helper](../../src/server/authorization/capabilities.ts), and
[prototype provider](../../src/features/prototype/prototype-provider.tsx).

## Current command and visibility register

"Confirmed guard" means an existing executable check, not blanket production
approval. "Observed gap" must remain visible until an authorized later change.

| Area | Confirmed behavior | Actual enforcement boundary |
| --- | --- | --- |
| Capabilities | Development defaults: read/create only. Null session denies; production development adapter returns null. No role-derived capability expansion. | Session/helper functions. Most existing commands use other checks. |
| Actor selection | Browser selector accepts active local People; missing/inactive choices fail. Server bridge independently resolves active fixture People. | Client selector versus server fixture bridge; these are not synchronized identity authorities. |
| Asset registration | StoreDev or Super Admin required. Other roles fail, regardless of legacy role-view selection. Empty organizational scope does not add a registration restriction. | Client provider action; no durable asset-create API. |
| Booking submission | Active allowlisted fixture actors can submit; no Requester-only role restriction. Missing/unknown actor fails. | POST route actor resolver plus booking service. |
| Booking reads | Enabled GET collection currently performs no caller authorization. | Observed server gap, not approved shared visibility. |
| Booking resubmission | Needs update; requester or Super Admin; expected version must match. | Durable service and analogous provider guard. Legacy provider requests with unknown submitter use compatibility handling; do not reinterpret them as canonical ownership. |
| Reviewer assignment | Super Admin; active internal Person; any Vendor role excludes eligibility; known requester cannot review own Request. Same reviewer cannot be reassigned as a no-op. | Shared domain validator called by provider/server. |
| Review decision | Pending request and pending assignment in current cycle; actor must be assigned reviewer. No Super Admin override. Approval note optional; Reject/Needs update require reason. | Shared domain validator; API actor activity is checked separately. |
| Review eligibility timing | Vendor exclusion is an assignment-eligibility check. The decision validator checks assignment identity, not a new blanket role filter. | Do not silently introduce a new decision-time role policy. |
| Vendor master/audit | Active canonical fixture Super Admin required. Submitted role claims cannot elevate a non-admin. | Server actor resolver and repository guard, not merely UI. |
| Vendor operational projection | Active fixture users can read eligible locations. Master-data access remains restricted. | Server bridge; not provider-authenticated. |
| Vendor locality | Remote URL, foreign Origin and missing actor are rejected. | Local development checks; not proof of production authentication. |
| People administration | Admin parent screen hides the editor for non-Super Admin. Provider create/update/status methods lack an equivalent admin-role guard. | UI guard plus observed unguarded client mutation boundary. No People API exists yet. |
| People validation | Required name/email/role; case-insensitive duplicate email rejection; canonical scope IDs; registered legacy Vendor association for Vendor role. No corporate-email-domain restriction. | Provider/domain validation, not authorization. |
| Self-inactivation | Dedicated `setPersonStatus` rejects deactivating the current user. General `updatePerson` accepts inactive status for that same user. | Confirmed inconsistency; see below. |
| Self-role/last admin | Existing general edit has no dedicated self-role or last-admin guard. | Observed behavior only; D8 remains deferred. |
| Manual financial references | Super Admin editor guard. | Client domain/provider, not a durable reference API. |
| Scopes | Missing StoreDev scope generates a warning; organizational IDs remain distinct from physical Locations. No automatic scope routing/filtering/grants. | Informational scope helpers and validation. |

Primary implementations:
[review validators](../../src/lib/domain/approvals.ts),
[People validators](../../src/lib/domain/people.ts),
[booking service](../../src/lib/server/booking.ts),
[booking route](../../src/app/api/booking/requests/route.ts),
[vendor service](../../src/lib/server/vendors.ts),
[Admin parent screen](../../src/features/admin/admin-screen.tsx),
[provider mutations](../../src/features/prototype/prototype-provider.tsx), and
[financial-reference guard](../../src/lib/domain/financial-references.ts).

## Characterization evidence and limitations

[authorization-characterization.test.ts](../../tests/server/authorization-characterization.test.ts)
executes real session/domain/provider/service code. PostgreSQL is completely
module-mocked: no actual Pool/connection implementation is loaded. Booking SQL
results are disconnected test doubles, so service guards run without database
records changing. Fetch is intercepted; the provider's catalog hydration receives
an empty test response and no live API is contacted.

The actual Admin parent gate is rendered with a probe in place of the People
editor. This establishes UI visibility, not browser, accessibility or server
authorization. The actual booking POST/GET handlers are called with mocked SQL.

Existing session, approval and identity/audit tests supplement the new suite.
Their files need no edits: missing cases are in the new characterization file.
The existing suites already exercise review reassignment/history, revision cycles,
reservation blocking and actor/PIC audit separation.

This is behavioral coverage, not a measured statement/branch coverage percentage,
a database transaction proof, a security certification, or proof of shared access.
No database suites, migrations, seeds, browser mutations or application build run.

## Inconsistencies and interpretation

1. **Self-inactivation bypass:** `setPersonStatus` guards self-inactivation, while
   `updatePerson` does not. The previous execution plan's statement that every
   status path already enforces this was too broad. Tests deliberately capture
   both outcomes. Do not change runtime code in M1-A. Before M1-F, confirm whether
   enforcing the approved restriction across the general-edit path is an approved
   bug fix; do not hide that decision inside characterization work.
2. **People UI versus store:** non-admins cannot see People administration through
   its parent gate, but direct provider actions can create/edit/inactivate others.
   This is not a production grant. M1-F must provide the approved server boundary.
3. **UI/server People divergence:** inactivating a browser Person does not change
   server fixtures; a fixture actor can remain server-active. M1-B must not claim
   it fixes canonical People persistence, which belongs to later M1 slices.
4. **Role/capability divergence:** Super Admin Person role does not change the
   development session capability list. Preserve this until reviewed alignment;
   do not insert a coarse capability gate that breaks existing commands.
5. **Unauthenticated booking reads:** GET lacks actor authorization while POST
   requires the fixture bridge. Shared read policy remains unapproved.

None of these observations authorizes a new role mapping, privilege, hidden
override, automatic self-provisioning or an unrelated fix.

## Unresolved permission gates

| Gate | Activation boundary |
| --- | --- |
| Shared booking/catalog/report visibility and exports | No shared access or inferred own/team/all filtering. |
| Dispatch, destination receipt, return initiation/receipt and inspection | Missing role policies are unresolved, not grants to all active users. No durable endpoints in M1-A/B. |
| Transfers, issues, photos and maintenance lifecycle/acceptance | Existing state/evidence checks do not establish complete role permissions. |
| Vendor account mapping | No guessed association between legacy vendor fixture IDs and real database UUIDs. |
| Scope combination/enforcement | No new Brand/Category/Area/DC access expansion or restriction. |
| Provider identity | No provider configured/installed and no fallback when verified authentication fails. |
| D8/self-inactivation discrepancy | Resolve the observed general-edit path before M1-F enforcement; no new self-role or last-admin rule. |
| Audit/receipt retention | No automatic cleanup or pruning policy. |

## Verification procedure and Gate A

Run only the selected non-database suites, clearing inherited persistence flags:

```sh
env -u ASSETHUB_DATABASE_URL -u ASSETHUB_VENDOR_TEST_DATABASE_URL \
  -u ASSETHUB_VENDOR_ENABLED -u NEXT_PUBLIC_ASSETHUB_BOOKING_ENABLED \
  ./node_modules/.bin/vitest run tests/server/authorization-characterization.test.ts \
  tests/server/session.test.ts tests/approvals.test.tsx tests/identity-audit.test.tsx
./node_modules/.bin/eslint tests/server/authorization-characterization.test.ts
```

Inside the characterization suite, server flags use a fake loopback URL on port 1
and pg is mocked. These are restored test-process values, not environment-file
changes or a database target to use. Production-mode testing calls only the real
development-session contract with a temporary process value.

Gate A requires all selected suites, scoped static checks, documentation references
and changed-file boundaries to pass. A pass freezes observed behavior; it does not
certify any missing policy. The self-inactivation discrepancy remains an explicit
M1-F decision gate and does not block isolated M1-B actor-contract work.

Verification recorded on 2026-10-22: **Gate A PASS for characterization**. The four
selected suites passed all 57 tests, including 44 new characterization cases,
without React act warnings. Scoped ESLint, Prettier, a no-emit/no-cache TypeScript
check of the test with the actual Vitest setup and its imports, document-link
validation (19 links), and whitespace checks passed. This is behavioral coverage,
not a measured line/branch coverage percentage or proof of database persistence.
Existing identity, session and approval tests were retained unchanged because the
new suite supplies the missing boundary coverage.

M1-B may proceed only when separately requested. Its review must keep local
impersonation distinct from provider verification, preserve coarse capabilities,
reject authority from forged headers/cookies, and keep shared/provider mode
disabled. Do not modify the M0 ledger, add migrations, persist People, or implement
any M1-B behavior as part of this baseline.

## M1-B — Trusted Local Actor Contracts

Implemented as an opt-in, server-only parallel boundary. M1-A's register above is
retained. Existing `getCurrentSession`, `getCurrentUser`, `hasCapability`, fixture
identities, provider actions and booking/vendor/catalog transports are unchanged.
No legacy endpoint is made secure by the existence of this new resolver.

### Contracts and transport

- `src/server/auth/actor-context.ts` defines provider-independent identity,
  Person, capability and adapter contracts. Operational PICs remain separate data.
- `resolveServerActor(request)` is the new request-scoped entry point. Only the
  explicit `local-development` mode can resolve a local actor. Provider mode
  returns `503 PROVIDER_UNCONFIGURED`, including when a valid local cookie exists;
  no provider, account mapping, email linking or fallback is implemented.
- `POST /api/development/session` accepts exactly `{ "personId": "..." }` and
  issues a session for an allowlisted, currently active development Person.
  Selection is deliberate local impersonation, not login or evidence of identity.
  Missing/unknown/inactive selections fail; roles, capabilities and scopes in the
  payload are rejected. Headers cannot select/elevate the resolved actor.
- `GET /api/actor` projects identity provenance, Person ID/name and unchanged
  read/create coarse capabilities. It does not expose email, scopes or contacts.
  Both responses are `no-store` and vary by Cookie/Origin. No selection-list API,
  UI, People CRUD, audit persistence or application command migration is added.
- `command-policy.ts` defines command authorization contracts only. Its unresolved
  implementation always denies. It does not translate roles/capabilities into
  grants or replace any characterized command-specific validator.

### Locality and session security

Both routes require `NODE_ENV=development`, `ASSETHUB_ACTOR_MODE=local-development`
and an explicit `ASSETHUB_LOCAL_ACTOR_ORIGIN` containing only a loopback HTTP(S)
origin. No environment/configuration files are changed and no mode is activated
by this implementation. When separately starting a disposable local instance,
set these process values explicitly and bind Next with `--hostname 127.0.0.1` (or
IPv6 loopback), using the same origin/port. Do not restart/rebind a shared running
instance merely to try this slice.

A localhost Host/URL alone cannot prove locality. `loopback-listener.ts` executes
`lsof` without a shell, bounded by timeout/output size, to verify that this exact
Node process owns the requested TCP listener and that all its TCP listeners are
loopback-only. Missing utility, unsupported output, a wildcard listener, an
unrelated port, subprocess/worker without the listener, or command failure denies
resolution with `503 LOOPBACK_LISTENER_UNVERIFIED`. Do not bypass this check to
support an unverified runtime topology. This deliberately excludes shared,
reverse-proxy and externally bound environments. It trusts the developer's OS
account; a hostile local process capable of relaying traffic or reading server
memory is outside a development impersonation boundary.

Host, URL and configured origin must agree. Selection additionally requires exact
Origin and JSON; present Origin and Fetch Metadata must be same-origin. Generic
Forwarded headers and unknown/inconsistent `x-forwarded-*` headers are rejected.
Installed Next 16 synthesizes the four standard forwarding headers for direct
requests (`node_modules/next/dist/server/base-server.js`): only a complete,
consistent tuple with a single loopback address is accepted. That tuple supplies
no identity authority and cannot bypass OS listener verification.

The `assethub_local_actor` cookie is host-only, HttpOnly, SameSite=Strict,
Path=/api, with Max-Age/Expires of one hour and Secure for HTTPS. HTTP is supported
only inside the verified loopback boundary. HMAC-SHA256 and timing-safe signature
comparison protect a versioned payload containing only Person ID, issued/expiry
times and origin audience. Roles/scopes/capabilities are resolved from server data,
never token claims. Duplicate, malformed, forged, expired, future-issued and
wrong-audience cookies fail closed without a default actor. Reads do not renew.

A dedicated random 256-bit key lives only in this Node process, survives module
reload via a namespaced server global, and is never read from the media signing
key or persisted. Restart invalidates old sessions and requires explicit selection
again. Multiple worker processes have distinct keys and are unsupported; no
persistent credential, shared key or cross-worker authentication is introduced.
Person allowlist/activity is rechecked on every resolution. These are still
server fixtures; M1-F owns durable People authority and the M1-A discrepancies.

### Verification and limits

The security suite calls the actual new handlers with isolated Request objects,
mocked listener outcomes and cloned People fixtures. It tests selection, minimal
projection, header spoofing, malformed/forged/duplicate cookies, expiry, invalid
claims, inactive/nonallowlisted People, origin/forwarding failures, disabled modes,
provider failure, coarse-capability compatibility and deny-only policy contracts.
Restart revocation is exercised by clearing the process-key slot and reloading the
adapter to simulate a fresh process; it is not a live app restart test.

The listener suite uses a real temporary loopback-only TCP listener plus `lsof`,
and parser fixtures for unsafe bindings. No application traffic or database is
involved. Browser cookie delivery, a full Next server launch, reverse proxies and
multi-worker operation are not verified or enabled. No UI changed, so desktop/
mobile visual inspection is not applicable. Legacy browser actor selection remains
independent until an explicitly approved later integration slice.

Re-run the six selected suites with inherited database flags cleared, adding
`tests/server/local-actor.test.ts` and `tests/server/loopback-listener.test.ts` to
the M1-A command above. Run scoped lint, a no-emit TypeScript check including the
Vitest setup/new tests, and formatting/diff checks. Do not run database suites,
migrations, seeds or the full browser suite against the development instance.

### Gate B and rollback boundary

**Gate B PASS — isolated contract/security baseline, 2026-10-22.** Six selected
suites passed all 116 tests (the unchanged 57 Gate A tests plus 59 M1-B cases).
Application and new-test TypeScript checks passed without emit/cache; scoped
ESLint, formatting, whitespace and document-reference checks passed. No database,
schema, fixture identity, environment file, existing session helper or existing
command route was changed. Browser/live Next topology verification was not run.

Gate B covers these opt-in contracts and their isolated security/compatibility
checks only; it is not shared-access readiness. Runtime activation remains off.
Before M1-C, separately authorize its scope, verify the actual intended local Next
listener/process topology without bypasses, and specify which caller adopts the
new actor contract. Do not assume browser selection already updates session
helpers. Unresolved operational grants, provider/account mapping, vendor identity
mapping, People authority and D8 decisions remain gated for their approved slices.

Rollback removes only the M1-B files and this section. Existing APIs/helpers need
no reversal, and no database/configuration recovery is needed. Removing the
adapter or restarting the process invalidates its ephemeral sessions; stale
browser cookies carry no authority without it. Preserve M0 and M1-A artifacts.

## M1-D integration record

M1-D replaces the historical fixture/header API bridge with the trusted local
cookie and canonical PostgreSQL People. The earlier M1-A/B sections are historical
characterization, including the formerly unauthenticated booking GET. They do not
permit header fallback after this integration. See
[M1-D evidence, file scope and rollback](M1_D_CANONICAL_API_INTEGRATION.md).
Command-specific policy, coarse capabilities, legacy receipts and deferred gates
are preserved. People CRUD authority remains outside M1-D.
