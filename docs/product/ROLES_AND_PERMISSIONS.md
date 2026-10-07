# Roles and Permissions

> The Slice 6 prototype Person/role/scope contract is documented in [People, Roles, Scope, and Audit](../domain/PEOPLE_ROLES_SCOPE_AND_AUDIT.md). This page describes eventual capabilities, not permissions already enforced by the fixture-only app. In particular, Approver and System Admin below are capability-planning labels, not the canonical Slice 6 role IDs, and approval routing is not implemented.

> Slice 7A adds [manual Request review](../domain/MANUAL_REQUEST_REVIEW.md), not an approval matrix. The prototype Super Admin assigns active internal People manually; only the assigned reviewer may decide. These limited guards are not production RBAC.

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
# Prototype role views

AssetHub uses capability-oriented access, with role presets only as review aids: Viewer, Requester, Asset Ops, Approver, and System Admin. A development-only role switcher may demonstrate different UI relevance, but it is not authentication or authorization.

Viewer sees Home, Assets, and Me. Requester adds New Request and My Requests. Asset Ops adds asset creation, health, issues, maintenance, and return inspection. Approver adds the approval queue. System Admin adds governed Master Data, users/access, and approval configuration. Real enforcement remains a future server-authoritative responsibility.
