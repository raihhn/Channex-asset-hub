# EAMS PRD v2.0 Merge

This document merges the uploaded `EAMS_PRD_v2.0.pdf` into the AssetHub V2 product baseline without pretending that a fixture-only frontend prototype is already a production EAMS implementation.

## Adopted EAMS model

- Eventual surfaces are a Web Dashboard for internal control and Mobile for field execution.
- Assets are reusable physical units with stable identity, location, holder/responsible party, condition, availability, history, and documented photos.
- Composite assets may have parent-child components with independent condition, location, status, and movement history.
- Vendor, event, store, warehouse, and PIC destinations are governed master records. Field flows search existing records instead of creating destinations ad hoc.
- Transfer/Handover is first-class: destination, responsible party, condition evidence, confirmation, approval policy, receiving confirmation, and history entry.
- Condition inspection requires front, side, and detail evidence, plus damage evidence where applicable.
- Requests contain one or more request items and progress through pending, approval, reservation, dispatch, return, and closure milestones.
- Internal users receive full lifecycle visibility; vendor users receive only related history and no internal-only PIC data.
- Reuse, rebuild, recycle, retirement, and recovered material stock are explicit lifecycle outcomes.

## Current prototype mapping

Already represented:

- asset discovery, filters, detail, photos, issues, age/condition/location visibility;
- multi-item request picker with quantity and date-aware availability;
- registered event context and vendor workshop fixtures;
- pickup/delivery fulfillment groups with pickup and return date-time;
- a fixture-only Transfer / Handover screen at `/transfers` with governed destination selection, responsible party, condition, and required photo-view checklist;
- request review, approval fixture, return inspection direction, and operations queue;
- responsive web composition using official shadcn/ui primitives.

Deferred:

- persistence, API/live updates, production auth, and authorization enforcement;
- native/offline mobile execution and QR scanning;
- vendor-facing accounts and scoped history enforcement;
- governed Vendor/Event/Store/Warehouse/PIC master-data CRUD;
- persistent Transfer/Handover approval and receiving confirmation (the prototype now covers the preparation step only);
- mandatory inspection-session/photo validation;
- parent-child component records and partial component reuse;
- reservation/dispatch state transitions, bulk requests, notifications, exports, recycling, and material stock.

## Conflicts resolved

1. The PRD wins over free-text ad-hoc destinations for operational movement. Ad-hoc may remain a request purpose, but governed destinations must come from existing records.
2. PIC master data is centrally governed. The prototype may default requester contact to the signed-in account for UX, but that is not the authoritative PIC master record.
3. Declared value, production cost, recovered material value, and cost-avoidance metrics are reserved by the PRD but deferred while the current product scope excludes financial/procurement workflows.
4. The current Next.js app is a responsive web prototype, not the final Mobile execution platform.

## Next implementation order

1. Normalize governed master-data entities and relationships.
2. Add parent-child asset/component modeling.
3. Build Transfer/Handover and guided Condition Inspection.
4. Add role-scoped history and approval policy boundaries.
5. Add persistent request reservation/dispatch/return lifecycle.
6. Implement vendor/mobile execution, notifications, reporting, and recycling/material-stock workflows.
