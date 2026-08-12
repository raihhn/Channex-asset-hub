# Location Model

## Location types
At minimum support:
- Internal warehouse/storage
- External vendor storage
- Temporary in-use/deployment context

## Governed location record
Warehouse/vendor locations should support:
- Name
- Type
- Active/inactive
- Optional address/contact metadata
- Scope/division if needed

## Current location
Every active physical asset should have an interpretable current location or explicit unknown state. Avoid silent nulls.

## Movement
Changing an asset's current location should create history with timestamp and actor. Booking transitions may update operational location/status according to the workflow.
