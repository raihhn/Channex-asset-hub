# AssetHub Product Specification V2

## 1. Product definition
AssetHub is the central operational home for event assets: visibility, availability, location, lifecycle, booking/request, approval, and basic operational reporting.

The eventual EAMS platform has a Web Dashboard for internal control and a Mobile execution surface for internal field teams and vendors. This repository is the responsive web prototype for that target; it does not yet provide the production mobile, persistence, or live-operational layers.

The application exists to prevent teams from producing or sourcing an asset simply because they cannot see that an appropriate asset already exists.

## 2. Problem
Event assets can exist across internal warehouses, external vendors, active deployments, reuse pools, and other storage contexts. Users need a reliable source of truth before creating or requesting something new.

The product must make five answers obvious:
1. Do we have it?
2. Where is it?
3. Is it available when needed?
4. How old / usable is it?
5. How do I book it?

## 3. V2 product pillars

### Discover
Search and browse assets by useful business attributes. Surface image, brand, category/type, location, availability, age, condition, and last-use context.

### Book
Request an existing asset for a date range and usage context. Prevent or clearly flag availability conflicts. Track request and approval status.

### Manage
Authorized users maintain asset records, current location/status, lifecycle data, and controlled master data such as brand, category, warehouse/vendor, division, user mapping, and approval configuration.

### Report
Provide bounded, chronological Operational History with source-linked filters and filtered CSV. Reporting is not financial analytics; manual WBS/PR/PO/Invoice identifiers are reconciliation references only.

## 4. Primary modules

### Inventory
The source of truth for assets. Must support search, filters, useful mobile cards, asset detail, location, availability, age, condition, last used, lifecycle/review state, and documented asset photos/issues.

Assets are reusable physical units, not permanent campaign bundles. An independently reusable counter, rack, lightbox, table, stool, or supporting item is its own asset with location, history, health, and availability. Reusable setups may recommend combinations of those assets but never own them.

### Requests / Booking
Availability check, new request, approval, reservation/use status, return, and request history.

One booking request may contain multiple assets across categories, such as a booth with POSM, display, and supporting assets. New Request begins with a searchable/filterable multi-select item picker; starting from Asset Detail preselects that asset while allowing the requester to add, remove, or replace items before dates and availability are evaluated.

Requests capture either a registered Event/Activation or ad-hoc usage. Registered selection follows Brand -> Campaign/Concept -> Event/Activation Instance and derives standardized usage context; it does not expand AssetHub into event planning.

Assets may be individually tracked or quantity-based. A request item carries its requested quantity where relevant; availability is evaluated per item and may be partial or conflicting.

### Asset Operations

Authorized Asset Ops users work from an actionable queue for review-due assets, open issues, maintenance, missing documentation, and returns. The operational lifecycle includes movement, return inspection, condition review, and maintenance; this is not a generic analytics dashboard.

### Master Data and operational reports

AssetHub includes Brand, Category, Warehouse & Vendor, Division, User, User Mapping, and Approval Matrix reference areas. The canonical Report shows dated operational events and manual reference associations. Financial calculations, validation, procurement, and payment workflows remain out of scope.

The EAMS target additionally treats Transfer/Handover, guided Condition Inspection, role-scoped History, and explicit reuse/rebuild/recycle outcomes as first-class operational capabilities. Their current prototype status and sequencing are recorded in `product/EAMS_PRD_V2_MERGE.md`.

### Master Data
Brand, category, warehouse/vendor, division, users, user mapping, and approval matrix/configuration. These are governed records, not free-text substitutes.

### Report
One chronological Operational History report at `/reports`, requiring a date range and supporting Brand, Event/Activity, Request, physical Asset, Vendor, WBS, type/status, and manual reference filters. It is distinct from Audit and Calendar; see `domain/OPERATIONAL_REPORTING.md`.

## 5. Product principles
- Search before create.
- Location is operational truth, not decorative metadata.
- Availability is date-aware when a booking period is supplied.
- Age and lifecycle remain visible because an available asset may still be unsuitable.
- Mobile tasks optimize for speed and action.
- Administration may be richer on desktop without weakening mobile operational use.
- The interface should show what needs attention, not only passive totals.
- Reuse existing system vocabulary; avoid uncontrolled free-text for governed dimensions.
- Asset documentation must make operational condition visible: a primary photo is not a substitute for required multi-view documentation or issue evidence.

## 6. Explicit non-goals
AssetHub does not manage:
- budget or asset cost;
- procurement workflow;
- event ROI or financial performance;
- full event planning/project management;
- vendor commercial contracts;
- campaign planning;
- general task management.

An event/purpose may be captured as booking context, but AssetHub does not become the event-management system.

## 7. Success conditions
A typical user can find an asset and understand its current usability without contacting multiple people or checking separate files. A requester can complete and track a booking from mobile. An authorized operator can keep the asset source of truth current. An approver can act on pending requests without navigating an admin-heavy interface.
