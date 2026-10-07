# Asset Lifecycle

Lifecycle visibility is retained from V1.

## Purpose
Availability alone is insufficient. An asset can physically exist but be too old, damaged, under maintenance, or due for review.

## Baseline lifecycle
Registered/Active -> Available/Reserved/In Use -> Returned -> Condition Review -> Available, Maintenance, Reuse/Review, or Retired.

## Age review
V1 introduced an 18-month review threshold. Preserve it as a configurable default rather than hard-coding business policy into UI components.

A review-due state means “inspect/reassess,” not automatic retirement.

## On return
Where operationally required:
1. Record return.
2. Confirm current location.
3. Confirm/update condition.
4. Record evidence/notes if condition changed.
5. Resolve resulting availability/lifecycle state.

## Movement and maintenance

The operational path is Approved -> Reserved -> Ready for Pickup/Dispatch -> In Use -> Returned -> Return Inspection -> Available, Review Required, or Maintenance. Movement captures from location, destination, handover date, quantity, receiving/PIC, and return location. A return inspection records returned quantity, component completeness, post-use condition, new damage, refreshed documentation, and return location before the next availability state is chosen.

## History
Preserve material lifecycle events:
- registration;
- location changes;
- booking/use periods;
- return;
- condition changes;
- maintenance;
- lifecycle review;
- retirement/reactivation if supported.

History should answer “where has this been and what happened to it?” without becoming a full event-management log.

## Operational movement, inspection, and custody

Confirmed movement—not arbitrary edits—changes current location. A movement captures from/to, handover and receiving people, date/time, quantity, location, and relevant notes. Temporary event destinations and In Transit context do not need to become permanent Master Data.

Returned does not mean Available. The normal path is Returned -> Inspection Pending -> Available, Review Required, On Hold, or Maintenance. Partial return and outstanding quantity remain visible without assigning blame. Operational Asset History is the human-readable, user-facing record of usage, movement, health, inspections, and maintenance; technical audit logs remain restricted governance records.

## Slice 4 prototype return evidence

The [Return Workflow](RETURN_WORKFLOW.md) records Start Return and Confirm Received separately for each physical RequestItem. Start Return does not move the Asset. Confirm Received supplies actual receiving location and PIC, updates current location/custodian and condition, and sets Inspection Pending and unavailable. A receiver then makes an explicit inspection Clear or On Hold decision. Clear does not bypass an open blocking issue or active maintenance. Existing owner/responsible PIC is not overwritten by temporary custody. No automatic Missing status, maintenance ticket, or location transfer is inferred from a late planned date.

## Slice 5 maintenance handoff

See [Maintenance Workflow](MAINTENANCE_WORKFLOW.md). Inspection or an Issue may motivate a separate manual Maintenance record; neither automatically creates one. Active Maintenance blocks the Asset from new requests until Vendor work is evidenced and an internal user explicitly accepts it. Acceptance does not erase unrelated Issues, reservation conflicts, or unverified inspection holds.
