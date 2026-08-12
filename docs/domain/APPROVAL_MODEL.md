# Approval Model

## Goal
Support controlled booking approval without turning the product into a generic workflow builder.

## Approval configuration
The requested Approval Matrix should be governed master data/configuration. It may resolve approvers based on organizational attributes such as division, requester mapping, asset scope, or other approved business rules.

## Requirements
- Determine eligible approver(s) server-side.
- Store each decision, actor, timestamp, and optional reason/comment.
- Prevent unauthorized approval/rejection.
- Prevent stale approval actions after the request changes materially.
- Surface availability/conflict context to approvers.
- Preserve audit history.

## UX
Approvers need a mobile-friendly inbox showing:
- requester;
- asset;
- requested dates;
- destination/purpose;
- conflict/availability state;
- approve/reject actions.

Configuration of the approval matrix is admin-oriented and may be desktop-first.
