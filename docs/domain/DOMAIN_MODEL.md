# Domain Model

## Core entities
- **Asset**: a reusable event asset or managed inventory item.
- **Asset Unit / Quantity Record**: physical unit or quantity representation where tracking requires it.
- **Location**: current controlled location such as internal warehouse, external vendor storage, or temporary deployment context.
- **Brand**
- **Category**
- **Division**
- **User**
- **User Mapping**: relationship between user and organizational/approval scope.
- **Booking Request**
- **Approval Step / Decision**
- **Asset Movement / History**
- **Lifecycle Review**

## Relationships
An Asset belongs to a Brand and Category, has a current operational status/location, and carries lifecycle fields. Booking Requests reference one or more requested asset quantities/units and a date range. Approval rules determine the eligible approval path. Asset movements/history preserve operational changes.

## Modeling rule
Do not use free-text fields as substitutes for governed entities when the value drives filtering, permissions, approval, or reporting.
