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
- `docs/product/EAMS_PRD_V2_MERGE.md` reconciles the uploaded EAMS PRD v2.0 with the current fixture-only prototype. Treat its adopted domain rules as the eventual target and its deferred list as a hard boundary until a slice authorizes the work.

## UI architecture
Use:
Route -> Feature -> Domain/Shared Component -> Base Primitive.

The base primitive layer is the official shadcn/ui source component system. The CLI base is React Aria (`aria-maia`, preset `b1ZQ7FcEK`); use the official shadcn primitive when an interaction exists there (for example Popover + Command for searchable selection, Sheet/Drawer for contextual inspection, Select for filters, Badge for statuses, and Input for fields). Existing `src/components/ui` primitives remain unchanged until deliberately migrated. Extend through AssetHub shared/domain compositions; do not create page-specific replacement primitives or modify a base primitive for one screen. The product routes are the single source of truth. `/ui-option-2` is a compatibility redirect to `/`; it is not a second app or a separate product prototype. Keep the latest approved AssetHub visual direction and request flow in the product routes.

Layout and responsive composition use the standard Tailwind utility scale and breakpoints. Prefer `gap-2`, `gap-3`, `gap-4`, `gap-6`, `gap-8`, `p-4`, `p-6`, `px-4`, `px-6`, `px-8`, `w-full`, `max-w-*`, and `sm`/`md`/`lg`/`xl`. Avoid arbitrary spacing, width, height, and breakpoint values unless a controlled media viewport or safe-area calculation genuinely requires one. AssetHub tokens remain the source for semantic colors, typography, radius, and status meaning.

Use Inter Variable as the shared UI font. Follow the Page Title, Section Title, Card/Drawer Title, Body, UI Label, Secondary/Meta, and Small Caption role weights and line heights in `/docs/design/DESIGN_TOKENS.md`; do not introduce per-screen font families or a second weight scale.

The authoritative New Request flow is `Usage & Dates -> Select Assets -> Fulfillment -> Review & Submit`. Select Assets is the picker itself, not a confirmation step; Readiness is an inline validation state during selection and final review, not a standalone step.

CSS ownership is strict: official shadcn components own primitive interaction surfaces; `src/styles/tokens.css` owns semantic theme aliases and AssetHub tokens; Tailwind utilities own layout/spacing/responsive composition; TypeScript owns state and behavior; shared/domain components own product compositions; `src/app/globals.css` is limited to imports, base normalization, tokens-adjacent global utilities, and legacy composition rules being migrated. Do not add feature-specific global selectors when a component composition can own the layout.

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

For the current prototype, read `docs/domain/PEOPLE_ROLES_SCOPE_AND_AUDIT.md` before changing identity, roles, scope, PICs, or operational mutations. Use one canonical Person record with multiple roles and reference IDs for Brand/Category/Area/DC scope. Keep organizational Area/DC distinct from physical Location. Record significant mutations through the central audit helper at the state/domain action boundary, with the current Person as actor and a stable entity ID. Do not infer approval routing or production authorization from the prototype role/scope model. Current User is not an operational Origin PIC by default.

For Request review work, also read `docs/domain/MANUAL_REQUEST_REVIEW.md`. Slice 7A is a manual reviewer-assignment mechanism only: preserve review cycles/history, keep decision and audit updates together at the provider/domain boundary, and do not derive reviewers from roles, scope, Brand, Booth type, value, or WBS. Approval never implies a physical transfer or receipt.

For reporting or financial-reference work, read `docs/domain/OPERATIONAL_REPORTING.md`. Reports derive bounded business history from authoritative domain records; Audit is not the report and Calendar is not the report. WBS/PR/PO/Invoice are manual, optional external references—not verified financial state or budget amounts. Never infer physical receipt from Request status, transfer execution from a plan, or internal maintenance acceptance from Vendor work completion.

## Infrastructure boundaries
- Read `docs/engineering/ADR_001_BACKEND_AUTH_STORAGE.md` before adding persistent data, authentication, or asset media.
- Supabase is the initial managed provider, not the application architecture. Feature/UI code must not call Supabase directly.
- Preserve the application identity contracts (`getCurrentSession`, `getCurrentUser`, `hasCapability`) and use server/domain/repository or storage boundaries.
- Never expose service-role credentials, database passwords, or other privileged provider secrets to browser code.

## Implementation slices
Follow `/docs/delivery/IMPLEMENTATION_PLAN.md`.
When asked to implement one slice:
- implement that slice completely;
- preserve earlier slices;
- do not pre-build later slices unless required as a minimal dependency;
- report files changed, tests run, known limitations, and explicit stop boundary.

## When uncertain
Do not invent business policy. Prefer a configurable/default rule where V2 already identifies one (for example lifecycle review threshold). Flag genuine unresolved business policy separately from implementation.
