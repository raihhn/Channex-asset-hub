# Component Architecture

## Layer 1 - Vendored/base UI primitives
Examples: Button, Input, Sheet, Drawer, Dialog, Tabs, Badge, Calendar, Select, Command, Tooltip.

Treat these as foundation. Do not modify a global primitive to solve a one-screen visual request.

## Layer 2 - AssetHub shared components
Examples:
- AppHeader
- MobileBottomNav
- SearchField
- FilterSheet
- EmptyState
- AttentionCard
- ActivityItem
- MetricSummary
- PageSection
- StatusBadge

## Layer 3 - Domain components
Examples:
- AssetCard
- AssetPhoto
- AssetAvailability
- AssetLocation
- AssetAge
- AssetCondition
- LifecycleIndicator
- RequestCard
- ApprovalCard
- BookingPeriod
- ApprovalTimeline

## Layer 4 - Feature compositions
- AssetDiscovery
- AssetDetail
- RequestFlow
- MyRequests
- ApprovalInbox
- MasterDataManager
- OperationalReport

## Layer 5 - Routes/screens
Routes compose features; they should not reinvent visual primitives.

## AI rule
Prefer:
Route -> Feature -> Domain/Shared component -> Base primitive

Field, SearchField, EmptyState, and navigation are shared components; Button owns the four standard action variants. RequestFlow composes usage selection, event summary, dates, and readiness rows rather than creating a route-local visual system.

Avoid:
Route -> large one-off JSX + arbitrary Tailwind + duplicated interaction logic.
# Operational prototype components

Reusable domain components should support Asset Health summaries, issue/maintenance records, documentation checklist, request item lists, availability rows, selected-item cart, and operational queue entries. Setup suggestions compose existing asset/request-item UI; they do not become a parallel asset hierarchy.
## Layering rule

`components/ui/` contains the existing official shadcn/ui primitives. New additions use the React Aria `aria-maia` base configured in `components.json`. Product routes are the single source of truth; `/ui-option-2` redirects to `/` and must not grow into a second app. `components/shared/` contains reusable AssetHub compositions, and `components/domain/` contains asset/request domain compositions. Features compose those layers; they do not introduce bespoke controls when a shadcn primitive is suitable. Existing feature-level HeroUI usage is legacy migration surface and should be replaced incrementally with shared shadcn-based compositions without changing product behavior.

New Request uses Popover + Command for Event / Activation discovery, Select for Brand filtering, Badge for readiness and semantic status, Input for dates and ad-hoc fields, and Sheet for contextual asset inspection. The responsive sheet becomes a bottom-oriented surface on mobile through composition styling, without creating a second primitive.

Layout ownership is separate from primitive ownership: Tailwind utilities own responsive grid/flex composition and spacing, while AssetHub tokens own semantic colors, typography, radius, and status meaning. Shared/domain components such as AssetCard, AssetGallery, AssetStatus, RequestStatus, FulfillmentGroup, ReadinessItem, and AssetHealthSummary remain valid product patterns and should compose shadcn primitives rather than duplicate them.

## Foundation inventory

- KEEP: `src/components/ui/*` official shadcn primitives, `src/styles/tokens.css`, `src/lib/utils/*`, and shared/domain compositions.
- REFACTOR: legacy feature selectors in `src/app/globals.css` as screens are touched; move ordinary layout to Tailwind utilities and keep only global normalization or justified product composition rules.
- REMOVED: dead bespoke event menu and legacy asset-context overlay rules after migration to shadcn Popover/Command and Sheet.
- ABSENT: CSS Modules and inline style geometry in the current `src` application.

Primitive ownership is not duplicated: Input owns its border/focus surface, Checkbox owns its control, Popover/Command own their portal surface, and Sheet owns its overlay/stacking behavior. AssetHub components add content and domain semantics above those primitives.
