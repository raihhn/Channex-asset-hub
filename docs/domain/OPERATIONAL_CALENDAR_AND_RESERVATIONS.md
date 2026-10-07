# Operational Calendar and Reservations

## Slice 3 planning and Slice 4 return prototype scope

This document describes the request-derived planning model currently used by the AssetHub frontend prototype. It is not a production persistence or concurrency design.

## Three distinct phases

| Phase | Meaning | Current request fields |
| --- | --- | --- |
| Outbound | Planned pickup/departure or delivery toward the usage destination | `pickupDate`, `pickupTime` |
| Event / project usage | Planned time the asset is needed at the activity | `startDate`, `endDate` |
| Inbound | Planned return/arrival back after use | `returnDate`, `returnTime` |

Usage dates are not logistics dates. Booth duration continues to use inclusive calendar days from `startDate` through `endDate` only. A long outbound-to-inbound window does not increase the Booth usage duration. Slice 3 adds no hardcoded lead/lag offsets.

Physical RequestItems get a derived reservation spanning `[outboundAt, inboundAt)`. Half-open timestamp semantics allow one reservation to begin exactly when another ends; any positive overlap conflicts. Sequencing validation requires `outbound date ≤ usage start date ≤ usage end date ≤ inbound date`, and inbound timestamp must not precede outbound timestamp. Same-day boundaries are allowed. The prototype uses local `YYYY-MM-DDTHH:mm` strings and browser-local date interpretation; no timezone framework or UTC conversion is introduced.

Older requests with no logistics date/time values fall back to `startDate` at 00:00 and `endDate` at 23:59. This is a compatibility fallback, not an offset policy.

## Reservation derivation and blocking statuses

Reservations are derived from `PrototypeRequest.items`, matching physical Assets, the request usage context/event, and Fulfillment dates. No booking array is stored on the Asset, no independent Asset lifecycle is created, and a Custom Booth request with no physical RequestItems derives no reservation. Additional physical items in that request are treated normally.

Current prototype statuses that block operational availability:

```text
Pending approval, Approved, Ready, Return due, Inspection pending,
Overdue, In use, Needs update, Completed without confirmed receipt
```

Non-blocking statuses:

```text
Draft, Rejected, Cancelled
```

**Prototype reservation activation point: `Pending approval`. This is not a finalized production policy.** Submission currently holds availability before approval. The blocking-status rule is centralized in `src/lib/domain/reservations.ts`. Rejected/cancelled requests release their reservation; `Completed` is a business status, not physical return evidence. A physical item in a Completed request with no confirmed receipt remains blocking, including after its planned inbound time. Confirmed receipt shortens that item's effective reservation endpoint to actual inbound. A Custom Booth-only request has no physical reservation or receipt requirement.

Each Asset ID is one reservable identity in the current reservation check. Any overlapping blocking reservation conflicts, including for individually tracked Assets even if a capacity field is present. Slice 1's fixture-level `availableQuantity` check for a single request item remains in the picker for explicitly quantity-supporting records. Slice 3 no longer aggregates quantities across reservations or treats `totalQuantity` as an allocation engine. Whether reusable Inventory should ultimately be serialized or stock-based is still undecided.

Conflicts are evaluated per Asset. Existing maintenance, issue, inspection, and static fixture eligibility checks continue to apply independently. Conflict context identifies the existing activity, window, and request reference. Changing Usage or Fulfillment dates recalculates the selected items' readiness; an item that becomes conflicted remains selected and must be removed/resolved before the flow can progress or submit.

The prototype also retains the pre-existing `Asset.blockedRanges` fixture check against Usage dates as a separate legacy/static schedule constraint. It is not derived from a Request reservation and has no durable master-data source; Slice 3 leaves it intact while adding operational-window overlap checks.

## Reservation is not movement

A reservation means planned occupancy only. It does not alter `Asset.location`, custodian, availability/lifecycle status, or Movement/Transfer records. Current location and custodian remain tied to actual operations.

The Transfer/Handover screen remains local-only and does not create authoritative outbound evidence. Slice 4 adds an in-memory ReturnReceipt canonically linked by `requestItemId`; `requestId` and `assetId` retain context and lookup value. Only Confirm Received records `receivedAt`, receiving PIC/location, condition, and notes. Reservation `actualInboundAt` is derived from that item receipt, never from a planned date or Request/item status. Start Return alone is not receipt. See [Return Workflow](RETURN_WORKFLOW.md).

Planned state derivation uses browser-local current time:

- Outbound: Upcoming before the planned date, Due on the planned date, Awaiting confirmation after that date. None of these proves departure.
- Usage: `Scheduled for use` outside the planned window or `Planned usage window` within it; neither proves physical use.
- Inbound: Upcoming before the planned date, Due on that date until the planned time, Late after the planned time without confirmed receipt. `Completed` requires linked Confirm Received evidence. An early receipt leaves the planned date visible separately.
- Late is not Missing; no Asset is marked missing automatically.

## Operational calendar

The calendar is inside `/operations` and does not add a top-level navigation item. It displays a month grid and a traceable booking list for the selected month with Asset, Event/Activity, Brand, destination/location, planned outbound timestamp, usage period, planned inbound timestamp/state, actual inbound when confirmed, and Request ID. Filters cover Brand, Asset, Event/Activity, and Destination. The grid derives Outbound, Event usage, Inbound planning, and a distinct actual Receipt marker when its date differs. Booking list links to Asset Detail and Request Detail. Summary cards show outbound today, inbound today, late inbound, and availability-held counts. Received items are not late or held; outstanding items remain so even after the planned inbound time. Availability held is a reservation concept and does not assert current physical location. There is no Gantt, drag-to-reschedule, route optimization, storage capacity, or notification system.

Calendar availability and phase indicators are derived planning views. Event identity is taken from the selected child/sub-event referenced by the request; destination remains a separate location/address value.

## 30-day Booth policy

The existing policy remains unchanged: at most 30 inclusive calendar usage days based only on `startDate → endDate`. `pickupDate`/`pickupTime` and `returnDate`/`returnTime` do not affect the limit. Regular Booth remains an existing physical Booth Asset and uses the common reservation model. Custom Booth remains request-level and creates no physical reservation by itself.

## Deferred decisions

The following remain intentionally unresolved and must not be guessed in this slice:

1. Default outbound/inbound offsets and whether offsets vary by Asset category.
2. Who may override logistics dates.
3. Exception approval behavior for reservation conflicts.
4. Production reservation activation point (draft, submit, approval, or another lifecycle milestone).
5. Warehouse spatial capacity, bins, and rack rules.
6. Late inbound reminder/escalation cadence.
7. Whether/when maintenance windows become availability blockers beyond existing readiness checks.
8. Backend concurrency/locking strategy and durable receipt storage.
9. Timezone policy for persisted timestamps.
10. How to reconcile legacy `Completed` Requests whose physical items have no receipt evidence. The prototype conservatively keeps those items reserved; it never fabricates a receipt, actual inbound, or Inbound Completed marker.
