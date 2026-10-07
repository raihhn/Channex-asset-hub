# Request and Booking Model

## Purpose
Booking is a core V2 workflow.

## Minimum request information
- Requester
- Requested asset/unit/quantity
- Project name
- Borrowing period start and end date
- Full project/venue address
- Destination/location of use
- Event/purpose/context
- Requesting PIC/contact (defaults to the signed-in account)
- Project-site PIC/contact
- Budget code, entered manually and kept distinct from WBS references
- Submission timestamp
- Current request status
- Approval history
- Optional notes
- Optional manually entered WBS references; who must provide WBS and in which request contexts it is mandatory remain unresolved.
- Optional space dimensions, event details, floor plan/layout, and loading-in/loading-out letters.

## Suggested request states
Draft -> Submitted -> Pending Approval -> Approved -> Reserved -> In Use -> Returned -> Closed

Alternative paths:
- Rejected
- Cancelled/Withdrawn
- Conflict/Needs Revision where product policy requires

Do not expose unnecessary state complexity to the user if states can be grouped in the UI.

## Availability
Availability for a date range must consider overlapping approved/reserved/in-use bookings and available quantity.

In the current frontend prototype, physical-item availability also considers the full operational reservation window derived from request Fulfillment dates: outbound/pickup through inbound/return. Usage dates remain separate and authoritative for event duration and the Booth 30-day rule. The prototype uses a half-open timestamp interval `[outboundAt, inboundAt)`, so windows touching at the exact boundary do not overlap. No preparation/return buffer or H-3/H+1 offset is implied.

The current lifecycle mapping treats every physical RequestItem as availability-blocking except those in `Draft`, `Rejected`, or `Cancelled` requests. `Pending approval` is the **temporary prototype reservation activation point**, not a finalized production policy. `Completed` is a Request business status and does not prove physical return: without confirmed per-item receipt, the reservation remains blocking. Confirmed receipt ends the item's effective reservation at actual inbound. An overlapping blocking reservation conflicts by Asset ID. The pre-existing quantity-supporting fixture fields continue to limit the quantity of one selected item, but no cross-request stock allocation or generic Inventory engine is implemented.

The UI should distinguish:
- available;
- partially available/quantity constrained;
- unavailable/conflicting;
- operationally unavailable due to maintenance/retirement.

## Request eligibility and fulfillment

Request eligibility is derived per item from physical readiness, date-window availability, requested versus available quantity, blocking issues, maintenance/hold, inspection state, documentation warnings, and relevant location/logistics constraints. Current status alone is not a future-date booking decision: an item currently In Use may be eligible after its confirmed return buffer.


Booking windows may include configurable preparation/pickup, event use, teardown, and return/logistics buffers. Approval is against a request version/snapshot; material asset, date, or quantity changes require reapproval. Cancellations release applicable reservations, extensions recheck future availability, early returns may release remaining occupancy, and substitutions remain recorded.

Request status is separate from per-item fulfillment. A request may aggregate Pending Approval, Approved, Partially Fulfilled, Completed, or Cancelled while items independently progress through Reserved, Ready for Dispatch, In Transit, In Use, Return Pending, Inspection Pending, Returned, or Outstanding.

## Booking flow
Asset discovery/detail -> request items -> usage (registered event, registered vendor workshop, or policy-limited ad-hoc purpose) -> operational dates -> readiness/booking check -> fulfillment -> review -> submit -> approval -> reservation/use -> return.

In the item picker, the card surface is the multi-select control. Media navigation, photo preview, quantity controls, and detail links remain separate interactive targets. Cards show stable physical identity, condition, and current confirmed location; they must not imply date availability before dates are entered.

Registered Event selection derives Brand, Campaign/Concept, Event name, venue, city, and event dates. An Event may have a single optional parent Event and may be displayed with its child instances. A request stores the selected Event ID. A request can also target a registered vendor workshop address; vendor identity alone is insufficient because one vendor can have multiple workshops. The default PIC is the current account owner; it is not copied from the Event record in the prototype. Operational pickup/return dates may extend around event dates according to configurable rules. Ad-hoc purpose remains limited to the existing approved purpose list, and a new outside place remains request-scoped pending governance.

Booth-loan requests capture an editable Project Name and full project address, borrowing-period dates, project-site PIC, optional space dimensions and event notes, and optional supporting documents categorized as Floor plan / venue layout, Loading-in letter, and Loading-out letter. Loading-in and loading-out date/time are entered in Fulfillment separately from the borrowing/event period. The requesting PIC remains the signed-in account by default. Budget code is required in the current booth-loan prototype and is separate from WBS; neither is verified against a finance system. Local document selections are encoded in frontend memory so they can be reviewed in this prototype only; they are not uploaded to durable storage.

Requests optionally identify `boothType` as Regular Booth or Custom Booth. Regular Booth requires selecting an existing physical Booth asset in the ordinary multi-item picker. Custom Booth is a request-level requirement and does not produce a physical Asset or require one in the picker. Booth use is limited to 30 inclusive calendar days measured from request usage dates, not fulfillment pickup/return dates. Above 30 days blocks normal flow and reports extension approval required; the extension approver/workflow is not modeled.

## My Requests
Mobile users need a simple view of:
- pending;
- approved/upcoming;
- active;
- completed;
- rejected/cancelled.

Each request detail should explain the current state and next expected action.

## Lifecycle flow (authoritative V2)

The request is a container for one or more `RequestItem` records. The approved prototype flow is:

1. Usage & Dates (registered event or ad-hoc purpose, destination, PIC, asset-needed dates)
2. Select Assets (date-aware, multi-select, quantity-aware picker and selected-items summary)
3. Fulfillment (source-to-destination Fulfillment Groups)
4. Review & Submit (final readiness and coherence validation)

Asset Detail -> Request Asset preselects one item, but the picker remains editable so the request can combine booth, POSM, display, and supporting assets.

## Fulfillment and return

Outbound fulfillment is modeled as one or more Fulfillment Groups grouped by source location, handling requirements, and method. A request may have multiple sources and mixed pickup/delivery methods. Return Groups are separate because the return route can differ from outbound fulfillment.

The event venue is a default suggestion for registered events, not the only permitted destination. A destination may be an event venue, internal warehouse, vendor warehouse/workshop, or another approved operational location. One registered vendor can have many workshop addresses and each request stores the selected workshop location. Requesters can revise assets from later steps without reselecting unchanged items.

Fulfillment details include separate pickup date/time and return date/time. For booth borrowing, the UI labels these as Loading in and Loading out. The event/activation date, shipping-to-workshop date, loading-in window, and loading-out window are distinct operational concepts; review must show them separately.

Each request item records a fulfillment method such as Pickup or Delivery, with handling constraints derived from the item (for example delivery-only booth components). Slice 4 prototypes an explicit per-physical-item Start Return → Confirm Received → manual inspection sequence. Confirm Received is the sole source of actual inbound, receiving PIC/location, and receipt condition. The resulting state is inspection pending until a manual Clear or Hold decision. Partial returns leave other items outstanding; an outstanding item is not automatically Missing. Quantity-level reconciliation, component checks, and document evidence remain deferred rather than silently inferred. See [Return Workflow](RETURN_WORKFLOW.md).

### Operational reservation window (Slice 3)

For each selected physical RequestItem, the prototype derives a planned reservation linked back to its Request and Asset. Its window is `outboundAt → usageStartAt → usageEndAt → inboundAt`; current fields are `pickupDate`/`pickupTime` and `returnDate`/`returnTime` for outbound and inbound respectively. Historical fixture requests without logistics dates fall back to usage start/end, using local date/time strings. Validation requires outbound date ≤ usage start, inbound date ≥ usage end, and inbound timestamp ≥ outbound timestamp; equality is allowed. Dates are compared in the browser's local-time convention without introducing UTC conversion or fixed offsets.

Availability checks compare operational windows per physical Asset while selecting and submitting. A selected item that becomes conflicted after Fulfillment dates change stays selected but blocks progression/submission until removed or otherwise resolved. Request submission and elapsed planned dates do not change an Asset's current location or custodian. A Custom Booth requirement alone produces no physical reservation; any additional selected physical RequestItems do.

The Operations screen contains a month calendar with Brand, Asset, Event/Activity, and Destination filters. It derives Outbound and Event usage **planning** phases plus planned Inbound from reservations. Upcoming, Due, Awaiting confirmation, and Late are not proof of physical execution. Inbound `Completed` and `actualInboundAt` now derive only from a linked confirmed ReturnReceipt. Late inbound is never converted to Missing. The receipt is in-memory prototype state, not persisted backend evidence. See `OPERATIONAL_CALENDAR_AND_RESERVATIONS.md` and `RETURN_WORKFLOW.md` for status mapping and open decisions.

## Manual WBS references

Phase 1 supports optional, manually entered WBS references. The UI's `ABC12345` example is illustrative, not a prescribed format. The prototype trims whitespace, skips empty entries, removes exact duplicate codes, and reuses an existing exact-match reference where available. A request may link to multiple references; the reusable reference entity can be linked from multiple requests. Codes are not format-validated or externally verified. Who must enter WBS and which request contexts require it remain unresolved; do not enforce a universal requirement until that policy is approved.
