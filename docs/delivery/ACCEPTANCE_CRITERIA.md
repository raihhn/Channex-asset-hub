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
