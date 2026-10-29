# Maintenance Workflow — Slice 5 prototype

Maintenance is an in-memory operational record for one individually tracked physical Asset. It is not a production work order, Vendor portal, financial record, or persisted media store. Reloading resets new records and uploaded images. There is no production authentication or role enforcement; the prototype's signed-in fixture records internal actions, while Vendor completion captures the reporting person's name. A Custom Booth requirement or quantity-based inventory line cannot acquire physical Maintenance without a real Asset.

## Model and canonical linkage

`MaintenanceRecord.assetId` is the canonical physical Asset link. Optional `issueId`, `sourceRequestId`, and `sourceRequestItemId` retain context; RequestItem linkage requires a confirmed `ReturnReceipt` for that exact item. One active record per Asset is enforced; historical Accepted/Cancelled records remain. Canonical Vendor IDs come from the shared Vendor fixture also shown in Master Data. A legacy Asset maintenance summary without a detailed record is treated as active and blocks creating a duplicate; it cannot be silently invented into a new record.

The record stores reason, status, Vendor ID, condition before/after, original availability, separate Before/After photo IDs, creator, assigner, work-completion reporter, internal acceptor, timestamps, notes, and activity. Asset maintenance summary and availability are projections for existing readiness/UI consumers; they do not replace the record.

## State and evidence rules

| Transition | Required evidence | Asset eligibility |
| --- | --- | --- |
| Create → Draft | Physical Asset and reason or linked Issue | Blocked immediately |
| Draft → Vendor assigned | Registered Vendor | Blocked |
| Vendor assigned → In progress | Actual image Before Photo linked to this record | Blocked |
| In progress → Work completed | Actual image After Photo linked to this record and named reporter | Blocked; not accepted |
| Work completed → Accepted | Explicit internal decision and condition after | Available only when no other blocker remains |
| Work completed → On hold → In progress | Rejection reason; new After Photo on rework | Blocked |
| Active → Cancelled | Cancellation reason | Unavailable pending reassessment |

Before and After photos reuse the Asset photo list with a real browser-selected image data URL, `maintenanceId`, and semantic `maintenancePurpose`. Before is accepted only before work starts; After is accepted only in progress. The UI caps files at 5 MB. Rework retains earlier historical media but clears the current After evidence requirement. A stage transition validates linked media records, not merely a populated filename or count.

Acceptance may explicitly resolve only the linked Issue and may explicitly clear an inspection hold. Unrelated Issues remain. `Needs review`, open blocking Issues, an uncleared inspection, and prior reserved/in-use state keep availability blocked after acceptance. Reservation overlap remains evaluated by the booking eligibility layer; acceptance is not a reservation release. Maintenance neither changes physical receipt nor `actualInboundAt`, location, or custody.

## Surfaces

- Asset Detail shows active record and historical records, with a Create Maintenance entry.
- Operations lists new Maintenance records and has a Create Maintenance entry. Legacy fixture maintenance remains visible in the existing operational queue.
- Return inspection offers a manual handoff after Confirm Received; no inspection or Issue automatically creates maintenance.
- Request Detail links records that came from its RequestItems.
- Maintenance Detail shows context, Vendor, separate Before/After evidence, stage actions, acceptance, rework, cancellation, and activity.
- Asset Discovery reads live in-session Assets so maintenance availability changes appear in inventory.

## Deferred decisions

The named StoreDev acceptance role, exact Vendor authentication, notification routing, media storage/retention, and production concurrency/idempotency need their own decisions. The prototype does not assert that any account may perform these actions in production. No PR/PO/invoice/cost workflow is added.
