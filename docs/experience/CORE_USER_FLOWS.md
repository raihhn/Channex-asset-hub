# Core User Flows

## A. Find and understand an asset
Home/Assets -> Search/filter -> Asset card -> Asset detail -> understand availability/location/age/condition.

## B. Book an asset
Asset detail -> Usage & Dates -> Select Assets (preselected item remains editable) -> Fulfillment Groups -> Review & Submit (final readiness validation) -> pending approval -> approved/reserved -> in use -> return due -> inspection pending -> completed.

New Request enters the same flow at Usage & Dates. A request contains one or more request items; partial availability, replacement, extension conflicts, and outstanding returns are resolved per item without restarting the request.

Registered-event discovery uses an optional Brand filter and searchable event combobox. The relationship remains Brand -> Campaign/Activation -> Event Instance. Selecting an event derives its brand and context; the requester can then edit the asset-needed dates using human labels such as Need from and Return by.

From Readiness, View details opens contextual asset inspection inside the request flow. It does not navigate to the general Asset Detail route.

Dates are known before selection. Date-aware eligibility starts in the picker; the final review revalidates the complete request after fulfillment configuration. Fulfillment represents source-to-destination movement, and an event venue is a suggested destination rather than a mandatory destination.

## C. Track a request
My Requests -> status card -> Request detail -> approval timeline/current state -> next action.

## D. Approve
Needs Attention/Approval Inbox -> Request detail -> verify asset/dates/context -> approve or reject -> decision recorded.

## E. Dispatch/use/return
Approved/reserved -> operational handoff -> In Use -> return reconciliation (dispatched/received/outstanding) -> inspection -> Available/Maintenance/Review. A recorded return is never an automatic Available transition.

## F. Maintain asset
Authorized operator -> Asset detail/admin edit -> update governed operational fields -> save -> audit/history.

## G. Manage master data
Admin -> Master Data -> entity list -> add/edit/deactivate -> validation -> save. Deactivation should preserve historical references.

## H. Report/list
Report -> choose operational view/filter -> inspect listing/breakdown -> export if enabled.
# Consolidated operational flows

New Request: select one or more independent assets (or begin with a preselected detail item) -> adjust quantity and selection -> usage context -> dates -> item-level readiness/availability -> review -> submit -> approval -> movement/use -> return inspection. Step 1 only hides operationally unusable assets; it does not make date availability claims.

Asset Ops: open issue or return inspection -> health review -> maintenance when needed -> condition/documentation update -> Available or Review Required.
