# Asset Classification and Manual WBS References

## Physical item classification

Every tracked physical record is either `ASSET` or `INVENTORY`.

- **Asset**: reusable physical item managed as a capitalized asset.
- **Reusable Inventory**: reusable physical marketing material that is tracked operationally but does not meet Asset capitalization criteria.
- **Expense**: a consumed, single-use, or non-physical event cost. It is not an Asset record and does not enter physical location, custody, movement, return, condition, or maintenance lifecycle.

Both classifications use the same physical lifecycle and may have condition, issues, usage, and return history. Reuse Pool is a separate lifecycle/review concept, not a classification or location. Existing unclassified records default to `ASSET` for compatibility; new fixture items should declare a classification. Classification authority is not decided by this slice.

The two-year unused policy is a **Disposal Review recommendation**, not a disposal action. The recommendation is derived only for `INVENTORY` when an authoritative `lastUsedAt` date exists and is at least two years old. Missing or non-ISO usage dates do not imply staleness. No automated disposal, deletion, archive, or Reuse Pool move exists.

No new quantity ledger, stock allocation, or serialized-versus-quantity policy is introduced. Whether reusable inventory should be individually serialized or quantity-based remains open.

## Manual WBS reference foundation

Requests may include manually entered WBS references; they are optional until an approved policy defines who must provide them and in which request contexts. The field shows `ABC12345` as an example only; AssetHub does not create financial WBS, validate a format, or claim external verification. A Request may link to multiple reusable WBS references, and a reference may be linked to multiple Requests. The logical relation is separate from Event/Activity, so no false one-to-one Event/Request rule is introduced. Future Event/Activity, Vendor Work, PR, PO, or Invoice relations may reuse the reference entity; those workflows are not part of this slice.

Booth-loan request intake also captures a separate manually entered **Budget code**. It is not treated as a WBS reference and is not validated against a finance system. Its authoritative format and source remain to be confirmed with the budget owner.

The current frontend prototype stores references in fixture-backed in-memory state. Entry trims whitespace, ignores blanks, prevents exact duplicates within a request, and reuses exact matches already in the prototype store. Code case is preserved because case-sensitivity rules are not yet confirmed. Request Detail shows linked codes as **Manual reference** only; it does not show Verified, SAP Verified, budget, or status claims.

### Future integration — not implemented

Phase 1 stores WBS references manually. Target-state architecture may consume WBS and related financial/project data from TFM, MARS, SAP, or another approved enterprise system. AssetHub must not become the source system that creates financial WBS. API design, authentication, validation, synchronization frequency, error handling, data ownership, and source-of-truth rules remain pending IT alignment.

## Unresolved requirements

- Whether reusable Inventory is individually serialized or quantity-based.
- Who determines Asset versus Inventory classification, and whether it will eventually come from SAP/accounting.
- Exact WBS format and case-sensitivity rules.
- Who must enter WBS and which request contexts make it mandatory.
- Authoritative budget-code format and source system.
- Which additional user roles, beyond requesters creating a new request, must enter WBS.
- How TFM/MARS/SAP data will later be retrieved and validated.
- How future PR, PO, and Invoice records relate to WBS.
- Custom Booth creation/classification workflow.
- Approval matrix, Brand, StoreDev, and Super Admin permission rules.
