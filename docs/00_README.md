# AssetHub V2 Documentation

## Purpose
This documentation pack is the canonical handoff for rebuilding the Booth Activation & Event Asset Management prototype into a mobile-first operational application.

## Authority order
When documents or the existing prototype conflict, use this order:
1. `product/PRODUCT_SPEC.md`
2. Domain specifications under `domain/`
3. Experience specifications under `experience/`
4. Design and engineering rules
5. `product/REQUIREMENT_RECONCILIATION.md`
6. Archived V1 material and the existing prototype

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
- Mobile UI: `experience/MOBILE_EXPERIENCE.md` + `design/RESPONSIVE_RULES.md`
- UI components: `design/DESIGN_SYSTEM.md` + `design/COMPONENT_ARCHITECTURE.md`
- Backend, identity, and media infrastructure: `engineering/ADR_001_BACKEND_AUTH_STORAGE.md`
- Slice planning: `delivery/IMPLEMENTATION_PLAN.md`

## Non-negotiables
- Mobile is the primary operational experience.
- Do not reduce the product to a generic stock dashboard.
- Asset age/lifecycle from V1 remains a core requirement even when later feedback does not explicitly mention it.
- Booking/request is now a core workflow, not a side feature.
- Master Data is explicit governance, primarily admin-oriented.
- Do not add financial, budget, procurement, or full event-management scope.
