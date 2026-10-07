# Acceptance Criteria

## Product
- User can search and find existing assets.
- Asset result/detail clearly shows current location, availability, age, and condition.
- User can request an eligible asset for a date range from mobile.
- Availability conflicts are handled authoritatively.
- User can track request state.
- Authorized approver can approve/reject from mobile.
- Authorized operator can maintain relevant asset lifecycle/location/condition.
- Admin can manage required master data and approval configuration.
- Reports provide operational listing/visibility without financial scope.

## Mobile
- Core flows do not require desktop.
- No desktop table is simply squeezed into an unusable mobile width.
- Primary actions have adequate touch targets.
- Search, filters, asset detail, request, and approval are intentionally mobile-composed.

## Consistency
- No feature page introduces arbitrary colors/radii/spacing when system tokens exist.
- Shared/domain components are reused.
- Base primitives are not modified for one-off page needs.

## Security/data integrity
- Protected actions are server-authorized.
- Booking availability is revalidated on mutation.
- Approval eligibility is revalidated on mutation.
- Material mutations create audit/history where specified.

## Scope
- No cost/budget/procurement/full event-management functionality is introduced without approved requirement change.
# Consolidated prototype acceptance

- An asset is represented as an independent physical reusable unit with individual or quantity-based tracking.
- A request contains one or more request items and availability is visible per item.
- Setup suggestions can be edited before request submission.
- Asset Ops can review health, maintenance, documentation, and return-inspection states in the prototype.
- Add Asset, role-aware UI views, and all mutations remain frontend fixture-only until a later backend slice.
- Registered activation selection derives standardized Brand, Campaign/Concept, venue, city, dates, and PIC; ad-hoc use remains possible.
- The request readiness view shows per-item condition, confirmed location, custody, quantity, and restrictions before submission.
## New Request UX refinement

- Event discovery supports optional Brand filtering and searchable matching across event name, campaign, venue, city, and event ID.
- Selecting an event derives and synchronizes its Brand/Campaign context; requester-facing dates use Need from and Return by.
- Readiness View details opens contextual asset information inside the request flow on desktop and mobile; it does not navigate away to Asset Detail.
- New Request presents four steps: Usage & Dates, Select Assets, Fulfillment, and Review & Submit. There is no standalone Selected Assets confirmation or Readiness step.
- Date-aware asset eligibility is surfaced during selection; final review blocks submission when a blocking item or fulfillment issue remains.

## Slice 3 — Operational calendar and reservation window

- Usage dates remain separate from outbound and inbound fulfillment date/time.
- Physical RequestItems derive an operational reservation from outbound through inbound; Custom Booth alone does not.
- Same-Asset overlapping blocking reservations are unavailable and prevent progression/submission, including when edited dates create a conflict.
- Reservation planning does not mutate physical location, custodian, or Movement records.
- Operations exposes a month calendar with Outbound, Event usage, and Inbound phases, core booking context, filters, and late inbound visibility.
- The inclusive 30-day Booth rule remains limited to usage dates.
- WBS remains optional/manual; no offset automation or new approval state is introduced.
