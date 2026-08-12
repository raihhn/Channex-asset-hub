# Asset Model

## Required business information
Each asset should support:
- Stable asset ID/code
- Name
- Photos
- Brand
- Category/type
- Size/dimensions or variant where relevant
- Internal/external ownership/storage classification where needed
- Current location
- Quantity and unit of measure where quantity-based
- Availability/status
- Produced/acquired/registered date used for age calculation
- Computed age
- Condition
- Last-used date/context where known
- Lifecycle/review state
- Notes
- Created/updated timestamps and actor where auditable

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
