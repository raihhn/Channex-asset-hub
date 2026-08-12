# Empty, Loading, and Error States

## Empty states
Differentiate:
- no assets exist;
- no search results;
- no available assets for selected dates;
- no requests yet;
- no pending approvals;
- no activity/history.

Provide the next useful action rather than generic “No data.”

## Loading
Use stable skeletons/placeholders that preserve layout. Avoid blocking the entire mobile app for a single card/section refresh.

## Errors
Explain actionable failures:
- availability changed;
- request could not submit;
- unauthorized action;
- stale approval;
- asset/location update conflict;
- network/retry issue.

Never silently fail a mutation.

## Offline/poor connectivity
At minimum preserve safe read/loading/error behavior. Do not claim a booking succeeded until server confirmation is received.
