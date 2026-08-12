# Request and Booking Model

## Purpose
Booking is a core V2 workflow.

## Minimum request information
- Requester
- Requested asset/unit/quantity
- Start date
- End date
- Destination/location of use
- Event/purpose/context
- PIC/contact where needed
- Submission timestamp
- Current request status
- Approval history
- Optional notes

## Suggested request states
Draft -> Submitted -> Pending Approval -> Approved -> Reserved -> In Use -> Returned -> Closed

Alternative paths:
- Rejected
- Cancelled/Withdrawn
- Conflict/Needs Revision where product policy requires

Do not expose unnecessary state complexity to the user if states can be grouped in the UI.

## Availability
Availability for a date range must consider overlapping approved/reserved/in-use bookings and available quantity.

The UI should distinguish:
- available;
- partially available/quantity constrained;
- unavailable/conflicting;
- operationally unavailable due to maintenance/retirement.

## Booking flow
Asset discovery/detail -> Request Asset -> Select dates -> Check availability -> Enter usage context -> Review -> Submit -> Approval -> Reservation/use -> Return.

## My Requests
Mobile users need a simple view of:
- pending;
- approved/upcoming;
- active;
- completed;
- rejected/cancelled.

Each request detail should explain the current state and next expected action.
