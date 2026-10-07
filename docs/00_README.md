# AssetHub V2 Documentation

## Purpose
This documentation pack is the canonical handoff for rebuilding the Booth Activation & Event Asset Management prototype into a mobile-first operational application.

## Authority order
When documents or the existing prototype conflict, use this order:
1. `product/PRODUCT_SPEC.md`
2. `product/EAMS_PRD_V2_MERGE.md`
3. Domain specifications under `domain/`
4. Experience specifications under `experience/`
5. Design and engineering rules
6. `product/REQUIREMENT_RECONCILIATION.md`
7. Archived V1 material and the existing prototype

The V1 prototype remains a behavioral/reference input. It is not the final specification.

## Product in one sentence
AssetHub is the central place to find, understand, book, track, and manage event assets.

## Core questions
A user should be able to answer quickly:
- Do we already have this asset?
- Where is it now?
- Is it available for the period I need?
- How old is it and what condition is it in?
- Can I request/book it?
- What is happening with my request?

## Read before implementation
- Product work: `product/PRODUCT_SPEC.md`
- Asset work: `domain/ASSET_MODEL.md` + `domain/ASSET_LIFECYCLE.md`
- Booking work: `domain/REQUEST_BOOKING_MODEL.md` + `domain/APPROVAL_MODEL.md`
- Operational booking windows and planning calendar: `domain/OPERATIONAL_CALENDAR_AND_RESERVATIONS.md`
- Physical returns and authoritative inbound: `domain/RETURN_WORKFLOW.md`
- Physical Asset maintenance, evidence, Vendor work, and acceptance: `domain/MAINTENANCE_WORKFLOW.md`
- Organizational People, multi-role scope, current-user identity, and prototype audit: `domain/PEOPLE_ROLES_SCOPE_AND_AUDIT.md`
- Manual Request reviewer assignment, decisions, revision cycles, and reservation compatibility: `domain/MANUAL_REQUEST_REVIEW.md`
- Bounded Operational History, source derivation, filters, CSV, and manual financial references: `domain/OPERATIONAL_REPORTING.md`
- Mobile UI: `experience/MOBILE_EXPERIENCE.md` + `design/RESPONSIVE_RULES.md`
- UI components: `design/DESIGN_SYSTEM.md` + `design/COMPONENT_ARCHITECTURE.md`
- Backend, identity, and media infrastructure: `engineering/ADR_001_BACKEND_AUTH_STORAGE.md`
- Production persistence, authority, concurrency, migration, and risk map: `architecture/PRODUCTION_READINESS.md`
- Slice 10 local PostgreSQL booking implementation and its non-production boundaries: `architecture/PERSISTENCE_FOUNDATION.md`
- Slice planning: `delivery/IMPLEMENTATION_PLAN.md`

## Non-negotiables
- Mobile is the primary operational experience.
- Do not reduce the product to a generic stock dashboard.
- Asset age/lifecycle from V1 remains a core requirement even when later feedback does not explicitly mention it.
- Booking/request is now a core workflow, not a side feature.
- Master Data is explicit governance, primarily admin-oriented.
- Do not add financial, budget, procurement, or full event-management scope.
- The uploaded EAMS PRD v2.0 defines the eventual platform capability set; deferred infrastructure and mobile capabilities require their own approved implementation slices.
# Domain update: Asset classification and manual WBS

See [Asset Classification and Manual WBS References](domain/ASSET_CLASSIFICATION_AND_WBS.md) for the `ASSET` / `INVENTORY` physical classification policy, derived disposal-review recommendation, manual multi-WBS request relation, future enterprise integration boundary, and unresolved business decisions.
