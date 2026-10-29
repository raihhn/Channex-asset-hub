# Testing Strategy

## Domain tests
- Age calculation
- Booking overlap/quantity availability
- Request state transitions
- Approval eligibility and stale decisions
- Asset lifecycle/status transitions
- Master-data deactivation behavior

## Authorization tests
For each protected mutation/read, test allowed and denied role/scope cases.

## UI tests
Priority mobile flows:
- search/filter;
- asset detail;
- request;
- My Requests;
- approval;
- return/condition where applicable.

## Responsive QA
Test representative small mobile, large mobile, tablet, and desktop widths. Validate composition, not merely absence of overflow.

## Error tests
- network failure;
- conflicting booking created after initial availability check;
- unauthorized action;
- stale approval;
- missing/deactivated master data;
- failed image/data load.

## Regression
Every slice should preserve earlier slice acceptance criteria.
