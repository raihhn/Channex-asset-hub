# Booking tracking and linked returns

## User journey

New Request stays the accepted four-step checkout. Requests then behaves like an order list: All requests, Approval, Delivery, Use & returns, and Closed. Search is bounded to max-w-md and matches the booking, project, destination, or asset. Every canonical status is represented; physical completion requires evidence rather than a Completed label alone.

Booking Detail defaults to tracking: Submitted → Approval → Delivery / use → Return → Inspection. It shows the current state, progress counts and next action. Approval and delivery forms open only after Manage approval / Manage delivery. Review controls retain canonical manual assignment and decision guards. Supplemental project documents, routes, references and history remain closed initially. Nonphysical Custom Booth requirements do not show fictitious shipment/return stages.

The linked return is part of the original booking, not a new Request or generic Transfer. Actual dispatch derives a stable return task for each dispatched RequestItem and its agreed return window. Arrival at the usage destination enables preparation. Undispatched siblings do not acquire tasks; unreceived shipments cannot be returned. Historical in-use/return/Completed fixtures remain supported, with outbound evidence explicitly unavailable rather than fabricated.

Return tracking shows Scheduled → Prepare return → Return underway → Received back → Inspection. Prepare return collects loading-out letters and initiates the existing per-item return. Receiver confirmation records actual inbound and observed condition; manual inspection follows. Partial shipments/receipts/returns remain independent. Inspection clear completes a return task; Hold remains actionable and does not restore asset availability. Neither due dates nor starting a return changes physical location.

## In-app reminders

Home, Requests, Operations and the header bell derive the same due/overdue reminders from outstanding tasks. Deadlines are checked against browser-local time and refreshed each minute while mounted. A started but unreceived return remains overdue after its deadline; confirmed receipts leave the due queue while inspection stays tracked separately. Reminders link directly to the existing booking return. The Super Admin sees workspace reminders; other prototype users see bookings with their canonical submittedByUserId. Historical PIC strings are never guessed as account identity.

These are live in-app projections, not scheduled notifications. Background jobs, email, push, read/dismiss history and durable movement storage remain deferred. Existing optional database booking/review persistence does not make outbound/return/transfer records durable; those reset on full reload. Navigation inside the prototype preserves them.

## Separate transfers

Transfers uses the same tracking composition in its own module: Planned → Dispatch → In transit → Received. See ../domain/TRANSFER_WORKFLOW.md. Event returns never create transfer plans and transfer plans never create booking return tasks.
