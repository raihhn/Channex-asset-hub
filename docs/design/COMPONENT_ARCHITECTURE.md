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

HeroUI React v3 provides the base primitives. `components/shared/` contains reusable AssetHub compositions, and `components/domain/` contains asset/request domain compositions. Features compose these layers. `/ui-option-2` redirects to `/`; product routes remain the single source of truth.

New Request uses shared HeroSelect for event and filter selection, Chip for semantic status, Input/TextArea for fields, Card for grouped content, and Modal for the mobile selected-assets surface. Preserve its four-step flow and validation.

Tailwind utilities own responsive layout and spacing; AssetHub tokens own colors, typography, radius, and status meaning. AssetCard, AssetGallery, AssetStatus, RequestStatus, FulfillmentGroup, ReadinessItem, and AssetHealthSummary remain shared/domain patterns.

## Foundation inventory

- KEEP: HeroUI v3 dependencies, `src/styles/tokens.css`, shared/domain compositions, and utility helpers.
- REFACTOR: existing feature selectors in `src/app/globals.css` when screens are touched; use Tailwind for ordinary layout.
- REMOVED: shadcn source folders, configuration, and unused Radix/cmdk/vaul/date-picker dependencies.
- ABSENT: feature CSS Modules and inline style geometry.

HeroUI owns field focus/borders, checkbox controls, and portal surfaces. AssetHub compositions add product content and domain behavior.

Shared HeroSelect composes HeroUI v3 Select with Autocomplete.Filter and a SearchField inside its popup. All choice dropdowns, including Event Master Brand/Parent/Status, use this shared composition. Search is case/accent-insensitive and matches all typed words against option labels. Query text never changes the governed selection; only choosing an existing option does. Popups provide a clear-search action, no-match feedback, keyboard navigation and Escape dismissal, with a fresh query on reopen.
