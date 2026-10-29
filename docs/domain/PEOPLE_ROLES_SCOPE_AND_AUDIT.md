# People, Roles, Scope, and Audit — Slice 6 prototype

## Boundary

Slice 6 establishes organizational identity and mutation history in the in-memory prototype. It does not add login, production authorization, persistent storage, approval levels, or approval routing. UI visibility is a review aid, never a security boundary. Data resets on a full reload.

## Canonical Person

`Person` has a stable ID, name, email, `ACTIVE`/`INACTIVE` status, one or more roles, Brand/Category/Area/DC scope IDs, an optional canonical Vendor ID, and created/updated timestamps. People Master supports search, create, edit, and activate/inactivate. Deletion is intentionally absent, preserving references and audit history. The current prototype user is selected from this same Person collection; the development switcher in Me is not authentication.

The role set is `REQUESTER`, `STORE_DEV`, `BRAND`, `VENDOR`, `SUPER_ADMIN`, and `MANAGEMENT`. A Person may have multiple roles. Roles describe organizational functions; they are not the final permission matrix. StoreDev without Brand or Category scope receives a configuration warning rather than silently gaining universal scope. Vendor-role People link to an existing Vendor record by `vendorId`; Vendor workshops continue to be represented by `Location.vendorId`. The Vendor and Location relationship was not inverted.

Brand and Category scopes reference canonical Master Data IDs. Area and DC are organizational scope references, distinct from physical Asset Locations and Vendor workshops. Scope selectors are available to future domain work, but they do not currently filter Brand data, route StoreDev approval, or produce authorization decisions. HO does not imply every DC.

## Identity and operational PICs

The current user supplies the actor identity for prototype mutations. An operational PIC is separate business data: Request PIC, origin PIC, transfer PIC, receiving PIC, Vendor contact, and maintenance handover contacts remain explicit records or fields. Current User is not automatically Origin PIC. Existing PIC names and contacts were not migrated into People records or reinterpreted as app users. The Request form's prior account-default PIC behavior remains a form convenience, not an identity equivalence.

## AuditEvent

The central append-only in-memory AuditEvent has `id`, ISO timestamp, canonical `actorUserId`, `actorNameSnapshot`, action, entity type, entity ID, human-readable summary, optional compact field changes, and optional related Request/RequestItem/Asset IDs. Actor snapshot preserves readable history after a Person name change. Events are emitted inside provider/domain mutation actions after validation, not by buttons or page components. Audit data does not copy raw uploaded media, secrets, or full contact payloads.

The global Audit Trail lives in Administration. It shows newest events first, supports actor/entity/action filters, and reveals compact change or related-record detail on demand. Only the Super Admin prototype role sees its navigation and contents. Direct URL guarding is UI-level only; server-side enforcement remains future work.

Current instrumented actions include Person create/update/activation, Event save, Request submission/status, Asset photo documentation, Transfer plan, Return start/receipt, Inspection, Issue report, and the existing Maintenance lifecycle (create, assign Vendor, start, complete, evidence, accept, rework, cancel). A submitted Transfer plan has its own in-memory record and audit ID, but does not move an Asset or confirm handover. Static Master Data tables without real CRUD remain read-only; a rendered but non-persistent Add Asset form is not falsely recorded as a created Asset. Additional real mutations should be instrumented at their domain/store boundary when implemented.

## Explicitly deferred

No L1/L2/L3 approval, Brand bypass, StoreDev auto-routing, Excom threshold, production authentication, persistence, or server-side RBAC is established by this slice. WBS rules and prior Slice 1–5 operational behavior remain unchanged.
