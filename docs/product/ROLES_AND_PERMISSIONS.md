# Roles and Permissions

V2 should implement capabilities rather than relying on page-level hiding alone. Final organization-specific role names may be configured later.

## Capability groups

### Standard user / requester
- Browse/search assets
- View asset details and availability
- Create booking requests
- View own requests and status/history
- Cancel/withdraw own eligible request where policy allows

### Approver
Includes standard-user capabilities plus:
- View requests assigned for approval
- Approve/reject with reason where required
- See relevant asset/date conflict context

### Asset operator / warehouse or asset PIC
- Maintain asset operational status and current location
- Confirm dispatch/in-use/return where applicable
- Update condition and lifecycle/review data
- Access operational request queues relevant to assigned scope

### Administrator
- Manage master data
- Manage users/mappings
- Configure approval matrix/rules
- Correct governed records
- Access administrative reports

### Management/read-only
- Browse aggregated operational visibility and listings
- No operational mutation unless separately granted

## Permission rules
- Server-side authorization is authoritative.
- Navigation visibility is convenience, not security.
- Master-data mutation must be restricted.
- Approval actions must validate that the current user is an eligible approver.
- Asset status/location changes should be auditable.
- Users should only see protected user/admin fields when authorized.
