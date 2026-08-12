# Implementation Plan

Implement in vertical slices. Each slice must leave the app coherent and testable.

## Slice 0 - Foundation
- Target framework/app shell
- Design tokens
- Base primitives
- Responsive shell
- Authentication skeleton
- Documentation/AI guardrails
- Development fixtures strategy

## Slice 1 - Identity, Roles, Permissions, Master Data foundation
- Users/divisions/mappings
- Brand/category/location
- Server authorization primitives
- Admin navigation and protected mutations
- Audit foundation

## Slice 2 - Asset Source of Truth
- Asset schema/model
- Asset photos
- Inventory search/filter
- Mobile AssetCard
- Asset detail
- Age/condition/location/lifecycle display
- Desktop inventory

## Slice 3 - Booking / Request
- Date-range request flow
- Availability calculation
- My Requests
- Request detail/status
- Conflict handling

## Slice 4 - Approval
- Approval matrix/rules
- Approver inbox
- Approve/reject
- Approval timeline
- Stale/unauthorized action protection

## Slice 5 - Operational lifecycle
- Reserved/In Use/Return transitions
- Location/condition confirmation
- Lifecycle review due
- Asset history

## Slice 6 - Home and attention system
- Role-aware mobile home
- Needs Attention
- Recent activity
- Useful operational summaries
- Desktop home composition

## Slice 7 - Reports and admin completion
- Operational listing/report
- Breakdown/filter/export as approved
- Remaining master-data UX
- Admin polish

## Slice 8 - Hardening
- Empty/loading/error states
- Responsive QA
- Accessibility
- Authorization tests
- Availability concurrency tests
- Audit verification
- Performance and search quality
- Production readiness

## Slice rule
Do not jump to later visual features by bypassing domain/auth foundations. Each Codex prompt should name the slice and explicitly stop at its boundary.
