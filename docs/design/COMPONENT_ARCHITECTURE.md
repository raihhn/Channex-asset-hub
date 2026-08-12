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

Avoid:
Route -> large one-off JSX + arbitrary Tailwind + duplicated interaction logic.
