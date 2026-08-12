# AI_GUIDE.md - AssetHub

## Read this first
Before implementing any task, read `/docs/00_README.md` and the documents named for the relevant feature.

## Source of truth
Current V2 docs override V1 prototype behavior when they conflict.

## Product guardrails
- AssetHub is asset visibility + lifecycle + booking + operational management.
- Mobile is the primary operational experience.
- Preserve asset age/lifecycle.
- Booking is core.
- Master Data is governed/admin-oriented.
- Do not add cost, budget, procurement, or full event-management scope.

## UI architecture
Use:
Route -> Feature -> Domain/Shared Component -> Base Primitive.

Do not:
- build large page-specific UI from arbitrary Tailwind;
- introduce new colors/radii/spacing outside tokens;
- modify a base primitive to fix one screen;
- clone default shadcn demos;
- shrink desktop layouts and call them mobile.

## Base primitives
Treat `components/ui` (or the project's equivalent) as vendored/foundation primitives. Reuse and extend through shared/domain components.

## Mobile
For mobile tasks, read:
- `/docs/experience/MOBILE_EXPERIENCE.md`
- `/docs/design/RESPONSIVE_RULES.md`
- relevant screen/domain specs.

## Domain integrity
Availability, permissions, approvals, and material state transitions are server-authoritative. Revalidate at mutation time.

## Implementation slices
Follow `/docs/delivery/IMPLEMENTATION_PLAN.md`.
When asked to implement one slice:
- implement that slice completely;
- preserve earlier slices;
- do not pre-build later slices unless required as a minimal dependency;
- report files changed, tests run, known limitations, and explicit stop boundary.

## When uncertain
Do not invent business policy. Prefer a configurable/default rule where V2 already identifies one (for example lifecycle review threshold). Flag genuine unresolved business policy separately from implementation.
