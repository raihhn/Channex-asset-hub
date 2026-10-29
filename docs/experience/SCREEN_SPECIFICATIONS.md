# Screen Specifications

## Priority screens for first design/implementation

### 1. Mobile Home
Purpose: orient the user and surface immediate work.
Must include search, role-aware attention items, useful quick access, and recent/relevant activity.

### 2. Asset Discovery
Search-first inventory. Mobile cards; filter sheet; availability/location/age/condition visible without opening every record.

### 3. Asset Detail
Visual asset identity + operational truth + lifecycle context + request action.

### 4. Request Asset
Staged mobile booking flow with date-aware availability before final submission.

### 5. My Requests / Request Detail
Status, requested asset/date/context, approval timeline, next action.

### 6. Approval Inbox / Approval Detail
Mobile-friendly actionable queue for authorized approvers.

## Secondary screens
- Desktop Home
- Desktop Inventory
- Request operations queue
- Report/listing
- Master Data lists/forms
- User Mapping
- Approval Matrix
- Asset create/edit
- Return/condition confirmation
- Activity/history

## Design rule
Do not create separate screens merely because every data entity exists. Prefer drawers, sheets, inline states, and detail sections when they preserve clarity.
# Consolidated prototype screens

Asset Detail includes identity, tracking type, media documentation, health, issues, lifecycle, and history. New Request includes search/filter/multi-select and a selected-items summary. The destination choice supports registered event venues and registered vendor workshops (including multiple addresses per vendor); ad-hoc purposes are restricted to the requestable policy list and PIC defaults to the signed-in account. The selected-items rail owns the Back/Continue actions, with those actions visually outside the selected-item list surface. Fulfillment groups expose pickup and return date/time separately from event/activation dates; these controls stay collapsed until the requester chooses Edit details. Review uses compact grouped metadata rather than a long narrative block. Asset Operations is an actionable queue. Add Asset and Return Inspection are guided, authorized-operation flows. A reusable setup is exposed through Asset Operations and remains editable in the New Request picker.

Request Readiness is represented inline in Select Assets and Review & Submit. Condition, confirmed location, booking period, quantity, and restrictions are checked per item before selection where possible and revalidated on review. View details opens an official shadcn Sheet in the active request flow, reusing the shared gallery and issue components; it must not navigate the requester away to the Asset Detail route.

Booth-loan New Request also captures a project name, editable full address, borrowing-period dates, requesting PIC (signed-in account default), project-site PIC, optional venue dimensions and notes, optional PDF/image supporting documents (floor plan/layout, loading-in letter, loading-out letter), a separate manual budget code, and optional manual WBS references while WBS ownership/required contexts remain unresolved. Loading-in and loading-out date/time are edited in Fulfillment separately from the borrowing period. Prototype file contents are available for review only within the current browser session; durable upload/storage is not implemented.
