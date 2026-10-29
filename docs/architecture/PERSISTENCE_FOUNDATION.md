# Slice 10 — Local booking persistence foundation

Status: **development prototype, not production-ready**. The approved architecture decision in `docs/engineering/ADR_001_BACKEND_AUTH_STORAGE.md` selects Supabase (PostgreSQL, Auth, Storage). There is no Supabase project configured; this slice uses local PostgreSQL 17 and a private `booking` schema. Do not infer that Supabase Auth, Storage, RLS, production authorization, or operational media persistence are enabled.

## Run locally

Set `ASSETHUB_DATABASE_URL` to a local PostgreSQL database. Run `npm run db:booking:migrate`; for demo asset identities and legacy occupancy snapshots run `npm run db:booking:seed`. Set `NEXT_PUBLIC_ASSETHUB_BOOKING_ENABLED=true` for both build and runtime, then run `npm run dev`. The seed is restricted to loopback databases. `.env.example` documents the variables; do not commit actual secrets.

The browser still chooses an allowlisted prototype Person, sent as `x-prototype-actor-id`. This is **not authentication**. The booking API is disabled without a configured URL and public flag; production-mode preview is limited to a loopback database. Never expose this bridge as a public production service. Replace it with verified identity and server-side authorization before deployment.

## Authority and transaction

`booking.requests` owns stable UUID identity, display number, status, usage and operational windows, version, review cycle, actor snapshot and non-media request fields. `booking.request_items` owns stable UUID identity, physical Asset FK, quantity and item-level `actual_inbound_at`. Group membership references RequestItem UUIDs and enforces same-Request membership. WBS references, assignments, review history, audit events and command receipts are relational. Demo legacy requests are occupancy snapshots only, excluded from persisted Request reads.

Submit and resubmit run inside PostgreSQL transactions. Individual Asset rows are locked in sorted ID order before overlap checks and writes, so two simultaneous overlapping submissions for the same Asset cannot both commit. Operational windows are half-open `[outbound, inbound)`. Blocking statuses are all except Draft, Rejected and Cancelled. A past scheduled inbound without an item-level receipt remains blocking. A receipt for one item never releases its siblings. `Completed` alone never proves return. A Reservation table is deliberately absent; occupancy derives from RequestItems, Request status/windows and each item's receipt. A UUID command key plus fingerprint/receipt prevents duplicate submission on retry. Resubmit uses version checks and preserves RequestItem IDs by Asset identity, replacing removed items and allocating UUIDs for new ones.

Client availability and calendar are still preview projections over fixture/loaded Request arrays and can differ from the database under concurrent changes. The trusted submit/resubmit boundary repeats operational date, booth 30-day, basic field, item identity, Asset class/readiness and reservation checks. Some event/master-data and attachment policies remain client-side; therefore this is not a complete production command boundary.

Reviewer assignment and decision on persisted Requests are transactional and reload after refresh. They still use the insecure prototype actor bridge and fixture People. Final routing and authorization are not implemented.

## Mixed-state limits

ReturnReceipt, inspection, issues, maintenance, transfer execution, People/Auth, media, operational Assets/master data, financial references and most dashboard/report data remain in-memory fixtures. Supporting-document metadata is saved, but base64 content is deliberately stripped from the database payload; it will not reopen after refresh. Physical execution is **not durable**. Quantity-based Inventory/Assets are rejected by durable booking until a stock allocation model exists; this is safer than allowing unprotected pooled stock. Demo legacy occupancy snapshots are not a real migration path. No destructive schema reset should be run on a database with user data.

Request Completed is not Return Received; a planned transfer is not a received transfer; Vendor Work Completed is not Maintenance Accepted; approval is not physical movement.

## Validation

Run unit tests with `npm test`. Run transactional database tests against an isolated database ending in `/assethub_test` using `ASSETHUB_DATABASE_URL=... NEXT_PUBLIC_ASSETHUB_BOOKING_ENABLED=true npm run test:booking:db`. The test suite deletes its own non-demo Requests in that test database; do not point it at development or production data. For persistence E2E, build with `NEXT_PUBLIC_ASSETHUB_BOOKING_ENABLED=true`, then run `ASSETHUB_DATABASE_URL=... npm run test:booking:e2e`. Run `npm run typecheck`, `npm run lint`, `npm run test:e2e`, `npm run build`, and `git diff --check` separately on the final tree.
