# Authentication and Access

## Requirements
- Authentication is required for protected application areas.
- Supabase Auth is the initial authentication provider; it must implement the application-level identity boundary defined in [ADR 001](ADR_001_BACKEND_AUTH_STORAGE.md), not leak into feature code.
- Application code uses provider-neutral contracts such as `getCurrentSession()`, `getCurrentUser()`, and `hasCapability()`.
- Authorization is enforced server-side for reads and writes that depend on role/scope.
- User mappings may determine division/asset/approval scope.
- Admin/master-data mutation is restricted.
- Approval eligibility is validated at action time.
- Protected user fields are projected only to authorized consumers.
- Identity must be verified server-side from a trusted provider claim/user response. Do not authorize from an unverified browser session payload.
- RLS is defense in depth where appropriate; it does not replace application authorization or domain validation.
- Service-role credentials or equivalent privileged secrets are server-only and must not be used by browser code.

## Navigation
Role-aware navigation may hide irrelevant sections, but hidden navigation is never the security boundary.

## Audit
Record actor and timestamp for approval decisions and material asset/master-data mutations.
