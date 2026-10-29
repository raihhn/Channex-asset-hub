# Home / Today

The product Home at `/` uses HeroUI React v3 and the shared app shell. It is an operational entry point, with search and follow-up before passive summaries.

## Composition

1. Greeting from the canonical current Person.
2. Inventory search by asset name, brand, or location; Enter and Search inventory open `/assets?q=...`. Clear resets the input.
3. Needs attention: return/request follow-up and asset health. Rows open existing Request or Asset detail; they do not perform a mutation.
4. Requests in motion and available asset previews, including location, condition, and age.
5. Recent submissions, newest first.

The home search form has a maximum width of `max-w-2xl`; the duplicate header search is hidden on Home. Navigation owns Inventory, New Request, and Operations entry points; do not repeat these as page shortcut cards. Contextual follow-up and View all links remain alongside their lists.

Mobile uses a vertical sequence and two-column asset previews. Ready to reuse shows up to four currently available assets in a 2×2 grid. Complete cards are bounded by `max-w-60` (240 px) with a consistent 208 px content area and edge-to-edge `16:9` media. Shared previews also support `1:1` and `4:5`; follow the media/card sizing policy in `docs/design/DESIGN_SYSTEM.md`. Keep metadata visible and use Inventory for the full list. Desktop splits related lists into columns. Layout uses Tailwind utilities; theme and primitives remain owned by the shared tokens and HeroUI.

## Data and meaning

- Read the existing provider state; do not add a parallel home fixture dataset.
- Request and asset lists are labeled as workspace views, not personal ownership claims. Existing prototype visibility is not a production authorization boundary.
- Assigned approval follow-up requires a pending assignment in the current review cycle for the current Person. Do not derive reviewer assignment from a role label.
- Revision follow-up requires a Needs update Request submitted by the current Person's canonical ID.
- Return follow-up uses explicit Return due, Overdue, and Inspection pending states. Do not invent physical receipt from approval or completion.
- Asset health includes unresolved issues, maintenance, condition review, and existing lifecycle notes. Count unresolved issues only.
- Requests in motion excludes Completed, Rejected, and Cancelled. Sort by submission timestamp; recent submissions excludes Draft.
- Available means the asset's current status. It does not promise availability for a requested date range or suitability despite condition/issues.
- Asset previews reuse the shared artwork fallback; placeholders are not real asset photographs.
- The New Request action enters the existing Usage & Dates → Select Assets → Fulfillment → Review & Submit flow.

Desktop Requests in motion stretches to the height of the adjacent asset section; blank space is permitted. Preview names and locations use two-line limits with ellipsis and full-value titles; detail routes provide complete information.

Ready to reuse uses neutral outline availability and semantic condition Chips. The first existing preview uses long name and location copy to demonstrate truncation directly inside the four-card grid. This display-only example does not change persisted asset records; do not add a separate example card or disclosure.
