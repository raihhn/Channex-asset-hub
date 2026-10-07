# Campaign, Event, and Activation Model

## Registered Events

The usage context is Brand → Campaign/Concept → Event. An `ActivationEvent` is a registered Event record with stable ID, brand, campaign, name, venue, city, event dates, PIC, status, optional canonical `locationId`, and optional `parentEventId`. Event is usage context; it is not a Location and selecting an Event does not change confirmed asset location.

`parentEventId` is an optional self-reference to one parent Event. A parent Event may contain child Event instances; an Event without a parent may be standalone or a parent. The prototype exposes the hierarchy in Event Master Data and in Event picker labels. Parent records are not selectable as usage instances when they have children. Brand filters Event options; changing Brand clears an incompatible Event selection. Self-parenting and direct/indirect cycles are rejected. Multi-level hierarchy policy is not introduced.

The Event Master Data route uses the existing in-memory `PrototypeProvider` Event collection. It supports add/edit, optional parent selection, and planned/active/completed status. Referenced Events are not deleted; mark them Completed to remove them from new-request selection. Authorization for who may edit Events remains unresolved and this prototype does not add RBAC.

Selecting an Event retains the Event ID, Brand, Campaign, and name on the request. Event dates are informational context; the request's separately entered usage dates drive availability and booth-duration validation. Fulfillment pickup/return dates do not affect the booth rule.

## Ad-hoc Events

An Ad-hoc Event represents a structured activity not already present in Event Master Data. The request captures Brand, Activity/Event Name, one of the existing purposes (`Photoshoot`, `Training`, `Internal testing`), usage dates, and destination type (`Store` or `Outside Store`). A Store is selected from seeded canonical Store locations where available. Outside Store prefers an existing registered destination and may include a request-scoped new-place value. That value does not create or modify a canonical Location.

Ad-hoc purpose capability restrictions and the governance for verifying/promoting new places remain unresolved. No budget, staffing, procurement, production schedule, ROI, or attendee model is added.

## Booth Requirement

Requests may declare no booth, `Regular Booth`, or `Custom Booth`. A Regular Booth is an existing physical Booth Asset and continues through the normal asset selection, availability, custody, movement, and return lifecycle. At least one available Booth Asset is required for that request type; other asset categories remain selectable too.

A Custom Booth is a request requirement for a new booth, not a physical Asset or inventory record. It may proceed through the existing Select Assets step without selecting a fake Booth Asset; additional real assets remain optional. The prototype does not create an Asset/serial/asset number/location/custodian and does not begin transfer or return lifecycle for a Custom Booth.

For either booth type, usage dates are counted as inclusive calendar dates (start date and end date both count). Up to 30 days may continue through normal review. More than 30 days blocks continuation/submission and communicates that extension approval is required; no extension approval workflow is fabricated. Editing usage dates recalculates the rule. Custom Booth production brief, conversion into an Asset, classification, identifier issuance, extension approver, and extension request behavior remain open governance.
