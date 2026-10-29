# Asset Model

## Required business information
Each asset should support:
- Stable asset ID/code
- Business classification: `ASSET` or `INVENTORY`; Expense is not a physical Asset record.
- Name
- Photos: multiple documented views per asset. Front, left side, and right side are the baseline required views unless an explicitly incomplete record is being resolved; rear, detail/close-up, installed/in-use, and other views may be added.
- Brand
- Category/type
- Size/dimensions or variant where relevant
- Internal/external ownership/storage classification where needed
- Current location
- Handling profile (portable/pickup eligible, delivery only, or coordinated delivery) where it constrains fulfillment
- Quantity and unit of measure where quantity-based
- Availability/status
- Produced/acquired/registered date used for age calculation
- Computed age
- Condition
- Last-used date/context where known
- Lifecycle/review state
- Notes
- Created/updated timestamps and actor where auditable

## Physical tracking and setups

An Asset is a physical reusable unit. Individually tracked records represent one physical instance per Asset ID, with their own history, location, photos, health, and booking state. Some existing fixtures expose `availableQuantity`/`totalQuantity` and allow requesting multiple units of an item, but those fields do not establish a stock ledger or cross-request allocation engine. Whether reusable Inventory should be individually serialized or quantity-based remains an open business decision.

`ASSET` and `INVENTORY` both remain in the same physical location, custody, movement, request, return, condition, issue, and maintenance lifecycle. `INVENTORY` means reusable physical marketing material that is not classified as a capitalized Asset; it does not imply Reuse Pool membership or quantity-based stock. Existing records without classification default to `ASSET` until explicitly classified. Classification authority and serialized-versus-quantity policy remain unresolved.

For Inventory, a disposal review may be recommended only when a reliable `lastUsedAt` date is available and is at least two years old. This is a review signal only; it never disposes, deletes, archives, or moves an item automatically. Capitalized Asset review and stock-opname dates remain future governance fields; no dates are fabricated in the prototype.

An Asset Setup / Setup Template is a reusable suggested combination of independent assets. Setup membership never transfers ownership: items may occur in multiple setups and their availability is always checked as individual request items. Fixed/integral parts remain part of their parent asset unless they are independently reusable.

## Asset health and maintenance

Asset Health combines condition, open issues, documentation completeness, lifecycle review state, maintenance state, and last inspection/update. A Maintenance record captures reason, linked issue where relevant, type, start date, PIC/vendor, notes/evidence, status, expected completion, and completed date. Maintenance is a material lifecycle record, not only an availability badge.


## Core display hierarchy
For mobile discovery, prioritize:
1. Photo
2. Brand + asset name/type
3. Availability
4. Current location
5. Age
6. Condition
7. Last used

Do not force users to open a detail screen merely to learn whether the asset is usable.

## Status vocabulary
Keep operational status vocabulary small and semantically distinct. Suggested baseline:
- Available
- Reserved
- In Use
- Maintenance
- Unavailable / Retired

Lifecycle/review state is separate from booking availability where possible.

## Age
Age is computed from the authoritative produced/acquired date. Do not manually store strings such as “2 years old” as the source of truth.

## Condition
Baseline controlled values may include Good, Fair, Poor, with notes/photos for meaningful changes. Exact vocabulary can be configured but must remain controlled.

## Location
Location should resolve to a governed Location record when it represents warehouse/vendor storage. Temporary deployment context may reference booking usage context while preserving history.

## Photo documentation and issues

Capture full, unobstructed assets in adequate lighting. Damage/detail photos must be clear and avoid unnecessary people. Incomplete required documentation is an explicit operational state.

An asset may have zero or more structured issue records: controlled issue type (Scratch, Dent, Broken, Missing part, Stain/cosmetic damage, Structural issue, or Other), affected area, severity (Minor, Moderate, Major), notes, evidence-photo references, reported date/actor, and status. Issue records and evidence form part of asset history; they do not by themselves define lifecycle policy.

## Prototype approval visibility

The frontend prototype may show an authorized approver queue with pending requests, approve/reject controls, and an optional comment. This is local browser-session state for reviewing the booking-management UX only; it is not approval authorization or approval-matrix execution.

## Booking request items

A booking request contains one or more request items, rather than a single asset reference. Each item identifies the asset and requested quantity where the asset supports quantity. The request owns the shared booking dates, destination, purpose, contact, notes, and approval state. Availability must be evaluated per request item, so a request may show a partial/conflicting fixture result before it can be submitted.

## Quantity/UoM capture and borrowing — local prototype

Each asset may carry `unitPolicy` with `stockUnit`, optional `packageUnit`, and a validated positive whole-number `unitsPerPackage`. Unknown conversions are never inferred. Intact or unknown-content Dus/Box/Pack uses that unit directly; loose borrowing requires a configured conversion to Pcs. Package choices describe equivalent quantities, not a guarantee of sealed packaging. Single-unit records retain quantity one. Existing fixtures without a policy use Set for Booth and Unit for other categories.

Add Asset captures the opening count in the selected unit; opened-package stock is converted once into Pcs. Request quantities, eligibility and downstream receipt quantities remain in the stock unit. A multi-unit picker is shown only for configured conversions with enough stock for one package; fixed-unit records display their unit without a picker. Plus/minus changes are clamped in whole selected packages, never a fraction of a package. No stock-opname ledger or cross-request quantity allocation engine is established by this slice.

Add Asset now registers an in-memory, audited record for prototype StoreDev/Super Admin users. It is unavailable with inspection pending and no fabricated documentation or acquisition date. Refresh loses these records. This does not create persistent PostgreSQL asset records or production scope-based registration authorization; durable booking cannot book session-only asset IDs. Existing documentation/inspection guards are retained. Asset spreadsheet import is separate and has not been run.
