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

## Managed infrastructure decision

The initial managed provider is Supabase PostgreSQL, Supabase Auth, and Supabase Storage. This is an accepted infrastructure decision, not a Supabase-coupled application architecture. See [ADR 001](ADR_001_BACKEND_AUTH_STORAGE.md).

The application remains PostgreSQL-oriented. Feature/UI code must use domain/application services and repository or storage boundaries; it must not query Supabase directly. Supabase dependencies and configuration are introduced only in the slice that needs them.

## Architecture principles
- Domain logic is not embedded only in UI.
- Availability/approval authorization is server-authoritative.
- Shared components are reused.
- The interactive prototype keeps UI-only state in `PrototypeProvider`; asset photo documentation and issue reporting deliberately remain browser-session fixtures until the selected backend architecture is implemented.
- Mobile and desktop consume the same business rules.
- Prototype mock data is not treated as production persistence.
- Environment-specific secrets never live in client code.
- Provider SDK calls are isolated behind server-side repository, identity, and storage adapters.
- Binary asset media lives in object storage; PostgreSQL stores metadata and object references.

The current interactive prototype keeps fixture-backed domain data in `PrototypeProvider` and TypeScript contracts under `src/types`. New prototype rules should extend this existing boundary; do not introduce a parallel `domain/*.js` model or database layer. Manual WBS references are normalized as a separate entity related to requests by reference IDs. They remain in-memory until a persistence slice.
