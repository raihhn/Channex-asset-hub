# Audit and History

## Audit-worthy events
- Asset creation/update of material operational fields
- Location/status change
- Condition/lifecycle review
- Booking submission/cancellation/state transitions
- Approval/rejection
- Master-data create/update/deactivate
- User mapping / approval matrix changes

## History presentation
User-facing asset history should be understandable and concise. Administrative audit may contain more detail.

## Principles
- Append material events rather than silently overwriting history.
- Store actor, timestamp, event type, entity, and relevant before/after or structured payload.
- Do not expose sensitive admin audit details to unauthorized users.
