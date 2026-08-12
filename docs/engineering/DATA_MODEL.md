# Data Model - Logical Specification

This is a logical model; physical schema may adapt to the selected backend.

## Tables/entities
- users
- divisions
- user_mappings
- brands
- categories
- locations
- assets
- asset_photos
- asset_history / movements
- booking_requests
- booking_request_items
- approval_rules / approval_matrix
- approval_steps / decisions
- lifecycle_reviews

## Integrity
- Stable IDs; display names are not primary keys.
- Historical records should survive master-data deactivation.
- Booking date overlaps must be queryable.
- Asset age derives from an authoritative date.
- Current status/location must reconcile with material history.
- Approval decisions are immutable audit events; corrections use explicit subsequent actions where appropriate.

## Indexing concerns
Plan indexes for asset search/filter, current status/location, booking date overlap, requester/request status, approver queue, and history by asset.
