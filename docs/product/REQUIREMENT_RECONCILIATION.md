# Requirement Reconciliation

This document records how V1 intent, the existing prototype, and post-prototype user feedback resolve into V2.

| Area | V1 / Prototype | User feedback | V2 decision |
|---|---|---|---|
| Inventory | Core asset browse/search and status | Keep inventory as a main module | **KEEP + REFINE** |
| Asset location | Internal/external, warehouse/vendor context | Warehouse & Vendor explicitly requested | **KEEP + FORMALIZE** |
| Availability | Core visibility | Booking requires availability | **KEEP + MAKE DATE-AWARE** |
| Asset age | Core lifecycle question | Not emphasized in feedback | **KEEP; DO NOT DROP** |
| Condition/lifecycle | Review/reuse intent | Not emphasized in feedback | **KEEP + SIMPLIFY FOR OPERATIONS** |
| Request | Existing/basic request direction | App should become booking home | **EXPAND TO CORE WORKFLOW** |
| My Requests/history | Present direction | Needed for booking home | **KEEP + REFINE** |
| Approval | Conceptual workflow | Approval/approval matrix requested | **EXPAND + FORMALIZE** |
| Master Data | Attributes existed as data | Explicit Master Data module | **NEW FORMAL MODULE** |
| Brand/category | Existing asset attributes | Explicit master data | **FORMALIZE** |
| Division | Not prominent | Explicitly requested | **ADD** |
| User mapping | Roles/users existed conceptually | Explicitly requested | **ADD/FORMALIZE** |
| Report | Dashboard/control-tower style | Report + asset listing requested | **REFINE TO OPERATIONAL REPORTING** |
| Dashboard | Passive metrics/activity | Need operational home | **REFINE TO ACTION-ORIENTED HOME** |
| Event | Request context | Booking context | **KEEP AS CONTEXT; DO NOT EXPAND TO EVENT MANAGEMENT** |
| Cost/budget | Not required for core problem | Not requested | **OUT OF SCOPE** |
| Mobile | Prototype includes mobile direction | Majority usage expected on mobile | **ELEVATE TO PRIMARY EXPERIENCE** |

## Interpretation rule
A requirement omitted from later feedback is not automatically removed. V1 requirements that still support the product's core problem remain unless V2 explicitly removes them.

## Important preserved V1 value
Asset age, condition, location, availability, and lifecycle visibility distinguish AssetHub from a generic booking form. They remain part of the V2 product.
# Consolidated V2 product model

The accepted V2 model treats an asset as a reusable physical unit. Campaigns and setups do not own assets; a reusable setup is a suggestion of independently tracked request items. Requests contain one or more items, with quantity and item-level availability where relevant. Asset health, movement/return inspection, maintenance, and governed operational roles are in scope; cost, procurement, vendor commercial work, event ROI, and full event management remain out of scope.
