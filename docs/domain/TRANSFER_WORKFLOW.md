# Warehouse and workshop transfers

## Frontend scope

Transfers are a separate physical movement journey for warehouse/workshop relocation, not usage booking or return from an event. A submitted TransferPlan stores asset identity, source-location/custodian snapshot, governed destination, explicit planned receiving PIC, purpose, condition, selected photo-view checklist, notes and submission timestamp. The checklist is a prototype selection, not uploaded photo evidence. Transfer approval policy, durable storage, cancellation/revision policy and photo upload remain deferred; submission is not an approval decision.

Confirm dispatch requires an active recording actor and explicit sending PIC. The source must still match the plan, source/destination must be warehouse/workshop types and different locations, and the asset must be operationally clear. Current booking holds and outstanding movements prevent a conflicting transfer. Duplicate dispatch is rejected. Actual sending timestamp/actor/PIC are recorded, asset availability becomes unavailable, and confirmed location/custody remain unchanged during transit.

Confirm arrival requires prior dispatch, active actor, explicit receiving PIC, observed condition and a non-reversed timestamp. Duplicate receipt is rejected. Only this receipt updates physical location, custody and condition. Needs review or independent health/maintenance holds keep the asset unavailable; a receipt does not erase a blocking issue. Planned receiving PIC remains separate from the actual receiver and recording actor.

Provider actions append TRANSFER_PLANNED, TRANSFER_DISPATCHED and TRANSFER_RECEIVED audit events; physical actions also append Asset movement history. Operational History retains the plan row and derives execution rows solely from actual dispatch/receipt timestamps. Planned transfers do not become received records merely through elapsed time.

The Transfers screen starts with tracking records; New transfer opens preparation separately and closes after submission. Mobile navigation exposes Transfers through Me. All movement evidence is in-memory prototype state and resets on a full reload.

Vendor destinations now come from the active database projection at `/api/vendor-locations`; internal warehouse references remain local fixtures. Plans keep warehouse UUID and a destination snapshot. Planning and dispatch revalidate current Vendor eligibility, while receipt applies the recorded destination snapshot. See VENDOR_MASTER_PERSISTENCE.md for local identity and persistence boundaries.
