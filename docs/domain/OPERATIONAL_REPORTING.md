# Slice 8 — Operational History and Manual Financial References

## Boundary

`/reports` is the one canonical, read-only Operational History view. It is a bounded, chronological statement of recorded business operations, not an Audit Trail, Calendar, finance ledger, procurement workflow, or budget engine. From Date and To Date are mandatory before results or CSV export exist. Filters use AND semantics and the default order is newest first. The in-memory prototype has no pagination; production query limits, retention, export permissions, and data-warehouse integration remain open.

Phase 1 WBS, PR Number, PO Number, and Invoice Number are entered manually and are not externally verified. WBS remains optional, reusable, and many-to-many through existing `WbsReference` IDs. PR/PO/Invoice use separate typed `FinancialReference` records on a Request or Maintenance record; multiple values of each type are allowed and no global uniqueness is imposed. Event linkage is derived through Request for now. AssetHub does not create financial WBS, PR, PO, or Invoice source records. Approved enterprise integrations may later supply and validate these references; SAP/TFM/MARS integration is not part of this slice.

## Projection and sources

`src/lib/domain/reporting.ts` builds `ReportEntry` from current canonical prototype state. Entries have occurrence time, business-readable category/type/summary/status, source entity identity, optional Request/Asset/Event/Vendor/actor context, WBS IDs, and current manual reference numbers. The projection is recomputed, not separately mutable. Current reference associations are displayed for reconciliation; the Audit Trail preserves add/edit/remove history rather than turning each historical row into a financial snapshot.

| Report event | Authoritative source |
| --- | --- |
| Request submitted/resubmitted | Request review history; legacy Request `submittedAt` only when an explicit date exists |
| Review Approved/Rejected/Needs Update | Decided `ApprovalAssignment` with `decidedAt`; never inferred from Request status |
| Transfer planned | `TransferPlan.submittedAt`; no physical transfer-received event exists yet |
| Return started/received | `ReturnReceipt.initiatedAt` / confirmed `receivedAt` |
| Return inspection | `ReturnReceipt.inspectedAt` and outcome |
| Maintenance created, Vendor assigned, work started/completed, accepted, sent back, cancelled | `MaintenanceRecord.activity` timestamps |
| Issue reported/resolved | Specific issue mutation AuditEvent, translated into business language because the Issue model lacks complete authoritative timestamp history |
| Manual reference added/updated/removed | Specific financial-reference AuditEvent, translated into business language |

Request Completed does not create Return Received. A plan does not create Transfer Received. Vendor Work Completed does not create Maintenance Accepted. Calendar continues showing scheduled windows, not report transactions. Audit continues showing system mutations and before/after values, not this business projection. Legacy records with `Today` or an unparseable timestamp are omitted rather than assigned an invented time; legacy `DD Mon YYYY` dates retain day precision without claiming a time.

Brand filtering uses canonical Brand IDs resolved from Request, actual Event, then physical Asset name only as a legacy fallback. Brand names absent from current Brand Master cannot be assigned a fake ID. Registered Event filtering uses the selected Event ID, not its parent; ad-hoc activity uses a Request-scoped key without polluting Event Master. Asset filters use physical Asset IDs, including `ASSET` and `INVENTORY`. Custom Booth has no physical Asset row. Vendor filters use Vendor Master IDs from Request destination or Maintenance. WBS matches membership in the Request's reference IDs without duplicating rows. Area/DC cannot be reliably attributed when People have multiple scopes and the business owner rule is unresolved, so no Area/DC filter is fabricated. Physical Location remains separately labelled.

## Editing and audit

Request Detail and Maintenance Detail allow the prototype Super Admin to add, edit, and remove typed manual PR/PO/Invoice references. Blank values are rejected; whitespace is trimmed; no external status or format verification is claimed. Each mutation emits `FINANCIAL_REFERENCE_ADDED`, `FINANCIAL_REFERENCE_UPDATED`, or `FINANCIAL_REFERENCE_REMOVED` at the provider mutation boundary with the current canonical Person actor and compact value changes. This guard is not production RBAC. Reports cannot mutate references.

CSV export contains only the currently applied date range and AND-filtered result set. Its filename contains the bounded dates; columns are business-readable, UTF-8, ISO-like occurrence values, and spreadsheet-formula-leading values are escaped. There is no all-history export.

## Open decisions

Source-of-truth mapping with SAP and legacy Excel; future automatic PR/PO/Invoice supply; invoice amount; official ownership and cross-Request/WBS invoice associations; financial approval relationship; budget snapshots; production pagination, retention, and export permissions; Area/DC attribution; scheduled reports; data warehouse/BI; WBS status validation; financial close/TECO synchronization. None is silently decided by this prototype.
