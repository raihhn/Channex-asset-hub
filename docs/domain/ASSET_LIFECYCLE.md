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
