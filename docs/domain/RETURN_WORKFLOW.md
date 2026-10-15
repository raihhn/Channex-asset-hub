# Return Workflow and Authoritative Inbound

## Slice 4 prototype boundary

This is an in-memory, frontend-only workflow. It does not add Supabase, persistence, production authentication, role permissions, background notifications, or backend Slice 1. Reloading resets actions to fixture state. The underlying unit of return is one physical RequestItem with a stable `requestItemId`; a Custom Booth requirement without a physical Asset has no return receipt.

## Evidence and transitions

| Action | Meaning | Physical effect |
| --- | --- | --- |
| Start Return | Holder indicates return is underway | Records initiator/time only; does not create actual inbound or move Asset |
| Confirm Received | Receiver accepts the physical item | Records actual inbound timestamp, receiving PIC, registered receiving location, observed condition, and optional notes; updates actual Asset location/custodian/condition and enters Inspection Pending |
| Inspection Clear / On Hold | Explicit post-receipt decision | Clear can restore availability only if no separate blocking issue or active maintenance exists; Hold keeps unavailable |

The `ReturnReceipt` model carries canonical `requestItemId`, contextual `requestId` and `assetId`, `initiatedAt/By`, optional `receivedAt/By`, `receivingLocationId`, `conditionAtReceipt`, notes, and optional inspection timestamp/outcome. Lookup and reservation derivation resolve the specific RequestItem first, so two items referencing one Asset cannot share receipt state. Existing fixture receipts were assigned explicit item IDs; a legacy record without one can be normalized only if its request-and-asset pair matches exactly one item. Ambiguous records remain unresolved rather than guessed. `confirmed receivedAt` is the only source for reservation `actualInboundAt` and calendar Inbound Completed. Neither Request status, item status, Start Return, nor elapsed planned inbound is physical receipt evidence. Outbound remains planning-only because there is no authoritative outbound confirmation in this slice.

## Partial and early returns

Each item is independent. Confirming one item does not complete its siblings or the whole Request. An outstanding item after planned inbound is Overdue, not Missing. Early physical receipt releases that item's occupied reservation interval for future conflict checks, while its inspection-pending/unavailable Asset state continues to block a new request. Planned inbound remains visible alongside actual inbound; it is never silently rewritten.

The Operations calendar and Request/Asset Detail read the same receipt-backed state. A received item has a completed inbound phase and, when actual and planned dates differ, a separate receipt marker. Late and held counts exclude physically received items. An unreceived item keeps its planned window and Late state. `Completed` Request status alone cannot release a physical reservation or create Inbound Completed. A legacy Completed item without receipt remains blocked after planned inbound and is labeled as missing receipt evidence, not as physically returned.

## Scenarios represented by fixtures

- Normal return can be initiated and then confirmed through the Return screen.
- `REQ-2026-030` has two physical items: Colorfit Pavilion received; Colorfit Product Wall remains overdue and outstanding.
- `REQ-2026-031` has an early-received counter; its planned inbound remains distinct and inspection stays pending.
- `REQ-2026-032` has a received item with Needs review and an existing issue; receipt does not erase that issue.

## Explicitly deferred

Slice 5 adds a manual [Maintenance Workflow](MAINTENANCE_WORKFLOW.md) handoff after Confirm Received. It requires the exact physical RequestItem and its confirmed receipt. Creating or accepting Maintenance never changes actual inbound, receipt, Asset location, or custody.

No automatic Missing inference, maintenance creation, background reminder delivery, production role enforcement, stock/quantity allocation, or per-component reconciliation is implemented. Durable attachment/document upload remains deferred. A quantity greater than one on a single RequestItem is not a per-unit return ledger. Durable receipt storage, idempotent concurrent writes, production outbound persistence, timezones, and reconciliation of legacy Completed-without-receipt records need later decisions before production use.

## Loading-out letter at return initiation

The optional Start Return form accepts up to five PDF/image loading-out letters, 5 MB each, on the exact physical RequestItem. They are stored on its ReturnReceipt as local data URLs in the current frontend session and remain visible after receiving/inspection. Uploading or starting return does not establish actual inbound; Confirm Received remains the only receipt authority. Durable attachment storage remains deferred.

## Actual outbound follow-up

Approved Request dispatch and usage-destination receipt are now implemented as explicit frontend prototype evidence. See [Approved Request Outbound](OUTBOUND_WORKFLOW.md). Historical records are not inferred. This supersedes the planning-only outbound limitation for newly recorded handovers; automatic linked Return tasks and in-app reminders now follow `../experience/BOOKING_TRACKING.md`. Durable operational records and background notification delivery remain pending.

New actual receiving-location selections use the same database Vendor warehouse projection as Requests and Transfers; legacy receipt history remains unchanged. Internal receiving locations retain their existing references. The projection supplies only active, complete Vendor destinations and never substitutes demo vendors when unavailable.
