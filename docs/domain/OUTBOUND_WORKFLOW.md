# Approved Request Outbound — first lifecycle step

## Scope

This slice adds actual outbound dispatch and destination receipt to Request Detail for approved physical RequestItems. It uses the existing frontend prototype provider, with in-memory records, local document data URLs and prototype actor identity. Data resets on reload. It does not add durable storage, production authorization, background notifications, durable movements or a stock allocation engine. In-app return tasks/reminders and separate Transfer execution are described in `../experience/BOOKING_TRACKING.md`. The approved New Request form and manual approval routing stay unchanged.

## Flow and evidence

Request approval opens outbound execution. For each approved Fulfillment Group, the sender selects its actual departing items, enters the actual sending PIC, and supplies loading-in letters. Local letters already attached to the Request can be reused. The outbound confirmation requires at least one readable PDF/image loading-in letter, at most five files of 5 MB each. One set of letters belongs to the shipment, not one repeated upload per Asset. Required-letter gating is this prototype's outbound gate, not a final corporate document policy.

Confirm dispatched creates one OutboundDispatch with stable Request/Group/RequestItem relationships, per-item Asset/quantity and source-location/custodian snapshots, the approved destination snapshot, actual dispatch timestamp, explicit sending PIC and recording actor. Sending only a subset leaves the other request items undispatched. An item and asset cannot be duplicated within a shipment or dispatched again on the same request item. Maintenance, inspection holds, blocking issues, prior return evidence and outstanding physical movements block dispatch. Historical In-use requests without outbound records are not backfilled with fabricated dispatch evidence.

While in transit, the asset is unavailable for new use. Its location and custodian remain the last confirmed values; an outbound record clearly states that receipt is pending. Approval or elapsed planned dates alone never creates dispatch evidence.

Confirm received at destination selects only outstanding items from that shipment and records explicit receiving PIC, observed condition, recording actor and actual receipt timestamp. Different conditions/PICs use separate confirmations. Only those selected receipts update Asset location/custodian/condition and item state to In use. At least one received item moves the Approved/Ready aggregate Request to In use, while sibling states retain partial dispatch/receipt status. The approved destination is frozen in the dispatch record. Received items cannot be confirmed twice; receipt cannot precede dispatch. These receipts do not create return inbound or mark the Request Completed.

## Integration and boundaries

Provider actions emit OUTBOUND_DISPATCHED and OUTBOUND_RECEIVED audit entries with canonical actors, and add Request/Asset history. Operational reservations retain planned timestamps and optionally expose actualOutboundAt and destinationReceivedAt from matching outbound evidence. Outbound/usage calendar labels distinguish actual handovers from planning. Current location changes cannot silently change the proposed return destination: approved Return Groups or dispatch source snapshots supply the destination fallback in Request Detail.

For items with new outbound evidence, Start Return cannot precede confirmed usage-destination receipt. Legacy Return receipts and workflows remain supported without inventing historical outbound records. Quantity-based RequestItems move their complete requested quantity together; individual-unit reconciliation remains deferred.

Automatic linked Return tasks now derive from actual dispatched items and their agreed return windows. Preparation remains blocked before destination receipt. In-app due/overdue follow-up is a live projection, not a background notification service; see `../experience/BOOKING_TRACKING.md`.
