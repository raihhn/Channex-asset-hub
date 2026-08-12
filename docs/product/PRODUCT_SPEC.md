# AssetHub Product Specification V2

## 1. Product definition
AssetHub is the central operational home for event assets: visibility, availability, location, lifecycle, booking/request, approval, and basic operational reporting.

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
Provide operational visibility and exportable listings. Reporting is not financial analytics.

## 4. Primary modules

### Inventory
The source of truth for assets. Must support search, filters, useful mobile cards, asset detail, location, availability, age, condition, last used, and lifecycle/review state.

### Requests / Booking
Availability check, new request, approval, reservation/use status, return, and request history.

### Master Data
Brand, category, warehouse/vendor, division, users, user mapping, and approval matrix/configuration. These are governed records, not free-text substitutes.

### Report
Asset listing and operational breakdowns such as availability, in-use/borrowed, maintenance/review, brand, category, and location.

## 5. Product principles
- Search before create.
- Location is operational truth, not decorative metadata.
- Availability is date-aware when a booking period is supplied.
- Age and lifecycle remain visible because an available asset may still be unsuitable.
- Mobile tasks optimize for speed and action.
- Administration may be richer on desktop without weakening mobile operational use.
- The interface should show what needs attention, not only passive totals.
- Reuse existing system vocabulary; avoid uncontrolled free-text for governed dimensions.

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
