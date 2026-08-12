# Authentication and Access

## Requirements
- Authentication is required for protected application areas.
- Authorization is enforced server-side for reads and writes that depend on role/scope.
- User mappings may determine division/asset/approval scope.
- Admin/master-data mutation is restricted.
- Approval eligibility is validated at action time.
- Protected user fields are projected only to authorized consumers.

## Navigation
Role-aware navigation may hide irrelevant sections, but hidden navigation is never the security boundary.

## Audit
Record actor and timestamp for approval decisions and material asset/master-data mutations.
