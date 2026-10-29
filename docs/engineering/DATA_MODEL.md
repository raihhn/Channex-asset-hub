# Data Model - Logical Specification

This is a logical PostgreSQL-oriented model. Supabase PostgreSQL is the initial managed provider; see [ADR 001](ADR_001_BACKEND_AUTH_STORAGE.md). Physical schema, migration tooling, and repository implementation are selected in the relevant delivery slice.

## Tables/entities
- users
- divisions
- user_mappings
- brands
- categories
- locations
- assets
- asset_photos / media metadata records
- asset_history / movements
- booking_requests
- booking_request_items
- approval_rules / approval_matrix
- approval_steps / decisions
- lifecycle_reviews
- wbs_references
- booking_request_wbs_references (many-to-many relation)
- financial_references (typed manual PR/PO/Invoice links to Request or Maintenance in Slice 8 prototype; final ownership is unresolved)

## Integrity
- Stable IDs; display names are not primary keys.
- Historical records should survive master-data deactivation.
- Booking date overlaps must be queryable.
- Asset age derives from an authoritative date.
- Current status/location must reconcile with material history.
- Approval decisions are immutable audit events; corrections use explicit subsequent actions where appropriate.
- Media metadata records reference object storage; binary files are not stored in normal relational fields. Store a stable media ID, owning entity, provider, bucket/container, object key, MIME type, file size, metadata, timestamps, and uploader/actor where relevant.
- Object keys and media metadata must remain portable across Supabase Storage and a future S3-compatible provider.
- A WBS reference is a manually entered external identifier, separate from Request and Event records. Requests may link to many WBS references and a WBS reference may be linked to many requests. Do not add a single `request.wbsCode` or `event.wbsCode` as the canonical relation.
- Operational `ReportEntry` is a read-only projection of source events, not a mutable ledger table. The prototype's PR/PO/Invoice references are optional, multiple, manually entered, and audited; they have no external verification state.

## Indexing concerns
Plan indexes for asset search/filter, current status/location, booking date overlap, requester/request status, approver queue, and history by asset.
