# Mobile Experience

Mobile is the primary operational experience.

## Primary mobile jobs
1. Search/find an asset.
2. Check current availability.
3. Check location.
4. Check age and condition.
5. Request/book an asset.
6. Track own requests.
7. Approve requests when authorized.
8. Understand what needs attention.

## Home
Do not lead with a generic wall of KPI cards.

Preferred hierarchy:
- Greeting/context
- Search
- Needs Attention (pending approvals, overdue returns, review-due items relevant to role)
- Quick access
- Relevant asset/request status
- Recent activity

Keep primary action cards vertically stacked on narrow screens so titles and supporting text do not compete for a cramped two-column row.

## Asset discovery
- Search should be prominent.
- Use a two-column grid of compact visual cards rather than desktop tables; keep card copy concise enough to scan in a narrow column.
- Use square (1:1) artwork in inventory and request-picker cards; reserve 16:9 media for full asset detail.
- Filters open in a sheet/drawer.
- Show image, availability, brand/name, location, age, condition.
- Preserve useful filter state while navigating back.

## Asset detail
- Browseable photo gallery with view labels; front, left side, and right side documentation state discoverable near the top
- Name + brand/type
- Strong availability state
- Location
- Age
- Condition
- Last used
- Lifecycle/review cue
- Issue summary/evidence cue when an open issue exists, plus a mobile-friendly Report Issue path for authorized users
- History/secondary information
- Keep the Request Asset action clear and easy to reach without overlaying asset facts, description, or history.

## Request
Use a staged flow rather than one dense form:
1. Selected request items, with a searchable/filterable picker, removal/replacement, and quantities where supported
2. Usage: choose a registered Event/Activation or an ad-hoc use
3. Operational dates
4. Date-aware asset picker and inline readiness, including condition, confirmed location, quantity, and restrictions. View details uses an in-flow bottom Sheet on mobile so selected assets, dates, and fulfillment context remain intact. The final review carries the remaining readiness summary.
5. Review
6. Submit

A distinct mobile New Request primary action starts with a multi-select asset picker and converges on this same staged flow. Asset Detail preselects its asset but exposes the same picker so the requester can add, remove, or replace items before date validation. Availability communicates each item's result, including partial/conflicting states.

After the first asset is selected, keep a compact selection summary available above the mobile bottom navigation. Open the summary in a bottom Sheet for item review, removal, and the Review request action; do not reserve a persistent empty summary before the user selects an item. Fulfillment cards keep pickup/return date-time controls compact and stacked. Vendor workshop destinations show vendor, workshop name, and city so multiple addresses remain distinguishable.

## My Requests
Use status-oriented cards with clear next action. Request detail should make approval state and booking period obvious.

## Approval
Approver inbox must be usable one-handed on mobile. Decision controls should be clear and protected against accidental action.

## Touch rules
- Avoid tiny icon-only targets for primary actions.
- Keep critical bottom actions above device safe areas.
- Use bottom sheets/drawers for mobile filters and compact selections where appropriate.
