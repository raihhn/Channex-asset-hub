# Location Model

## Location types
At minimum support:
- Internal warehouse/storage
- External vendor storage
- Temporary in-use/deployment context

## Governed location record
Warehouse/vendor locations should support:
- Name
- Type
- Active/inactive
- Optional address/contact metadata
- Scope/division if needed

## Current location
Every active physical asset should have an interpretable current location or explicit unknown state. Avoid silent nulls.

## Movement
Changing an asset's current location should create history with timestamp and actor. Booking transitions may update operational location/status according to the workflow.
# Location model consolidation

AssetHub distinguishes confirmed current physical location from an expected request destination. Confirmed movement/handover changes an asset location; selecting an event does not.

Supported contexts are Internal Warehouse, Vendor Warehouse, Temporary Event/Activation location, In Transit, and other approved operational locations. Permanent warehouse/vendor records may include storage area, zone, rack, and position. Temporary event venues can remain an activation context rather than Master Data.
Fulfillment destinations are structured operational locations, not a single event-venue string. A request may move assets from an internal warehouse, vendor warehouse, vendor workshop, or another approved source to an event venue, internal warehouse, vendor location, or other approved operational destination. Registered-event venues are suggested defaults only.

Registered vendors may own multiple workshop locations. A workshop selection therefore stores vendor identity and workshop location identity separately; the UI must show the full workshop address/city so two locations for the same vendor are not ambiguous.

Ad-hoc Event destination type distinguishes Store from Outside Store. A Store should use an existing canonical Store/Location when available. Outside Store prefers a registered destination where available. A newly entered place remains request-scoped and must not be silently created as canonical Location data; place verification and promotion governance remain open.
