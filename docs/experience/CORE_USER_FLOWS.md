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
Requests -> order/status filters -> Booking tracking -> one next action. Approval and delivery controls open on demand; the original booking owns its automatic linked Return. See [Booking Tracking](BOOKING_TRACKING.md).

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

New Request: Usage & Dates -> Select Assets (one or more independent assets, with an optional preselected detail item) -> Fulfillment -> Review & Submit -> approval -> movement/use -> return inspection. Dates are established before selection; date-aware eligibility is checked in the picker and revalidated at final review. Readiness remains inline validation rather than a separate step.

Asset Ops: open issue or return inspection -> health review -> maintenance when needed -> condition/documentation update -> Available or Review Required.

## Registered event and document timing update

Choose Brand before Event / activation. For Registered Event requests, project name and full project address derive from the selected master Event and are read-only in the request; selecting a different Event updates them. Usage/borrowing dates remain editable to define when assets are needed. Ad-hoc requests retain editable project information. New Request accepts venue layout and loading-in letters. Loading-out letters belong to the Start Return form, not request creation. Legacy request attachments remain readable during revision; no automatic deletion of historical evidence.

## Request purpose versus physical destination

New Request has two usage choices: Registered Event and Ad-hoc Event. Vendor workshop is a registered physical destination, available through Ad-hoc → Outside Store → Registered destination, with its vendor identity and exact workshop Location ID retained in fulfillment. Workshop use still requires a supported ad-hoc purpose and usage dates. Movement without a usage need belongs to Transfer; repair belongs to Maintenance. Existing historical Vendor workshop request types remain readable/revisable without silently rewriting their history. A request-scoped new place carries no registered workshop/vendor identity.

## Outbound execution after approval

Request Detail → select approved shipment items → sending PIC and loading-in letter → Confirm dispatched → destination PIC and observed condition → Confirm received at destination. Partial dispatch/receipt keeps remaining items outstanding. Actual location changes only on receipt. Dispatch derives automatic per-item Return tasks, with preparation after destination receipt and in-app deadline reminders. Users do not create a second booking Request to return assets. Warehouse/workshop Transfer remains a separate tracking journey.
