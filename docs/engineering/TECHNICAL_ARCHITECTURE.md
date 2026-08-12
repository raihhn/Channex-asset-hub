# Technical Architecture

## Target direction
Rebuild the prototype as a maintainable React application with a production-capable framework and a documented component/domain architecture.

Recommended baseline for Codex planning:
- Next.js
- TypeScript
- Tailwind CSS
- shadcn-compatible component primitives
- server-authoritative authentication/authorization
- persistent database
- schema-validated server mutations
- audit/history for sensitive operational changes

Exact backend/provider choices should be confirmed from the implementation environment rather than invented from V1 prototype code.

## Architecture principles
- Domain logic is not embedded only in UI.
- Availability/approval authorization is server-authoritative.
- Shared components are reused.
- Mobile and desktop consume the same business rules.
- Prototype mock data is not treated as production persistence.
- Environment-specific secrets never live in client code.
