# AssetHub Design System

## Direction
Use HeroUI React v3 as the implementation foundation. AssetHub needs its own visual hierarchy and domain components.

The visual direction should feel operational, calm, modern, and image-aware. Avoid generic admin-dashboard patterns with excessive boxed KPI cards.

## Foundation
- Accessible React primitives
- Tailwind-based tokens/utilities
- Controlled semantic status styles
- Strong typography hierarchy
- Restrained borders/shadows
- Mobile-safe spacing and touch targets

## Component discipline

Base primitives provide a limited button vocabulary (primary, secondary, ghost, destructive) and consistent fields. AssetHub shared components own repeated field, search, section, and action patterns; domain components own asset status, health, location, condition, request item, and issue presentation. Prefer rows and dividers for operational facts; use cards only for meaningful grouped or actionable objects.

## Visual hierarchy
Asset imagery and operational state are first-class. Location, availability, age, and condition should be scannable.

## Status semantics
Status meaning must be consistent everywhere. Do not use arbitrary colors per page. Color is supplemental; labels/icons/structure must preserve meaning.

## Interaction
- Clear primary action
- Predictable sheets/drawers/dialogs
- Strong focus/keyboard accessibility on desktop
- Touch-first targets on mobile
- Avoid decorative motion that slows operational tasks

## Reference usage
External UI references may inform hierarchy, density, navigation, and interaction patterns. Do not clone brand styling or copy layouts literally.
## Base component layer

AssetHub uses HeroUI React v3 primitives and compound components from `@heroui/react`, with styles from `@heroui/styles`. Inter Variable is the shared font; Lucide provides icons. AssetHub semantic tokens own color, radius, field, surface, overlay, and status styling. See `DESIGN_TOKENS.md` for typography roles.

Use HeroUI Button, Input, TextArea, Select, Checkbox, RadioGroup, Tabs, Chip, Card, Modal, Popover, Dropdown, and Tooltip where appropriate. Shared/domain components compose them with product behavior and content.

## Layout and spacing policy

Tailwind utilities are the default layout system for grid, flex, gap, padding, margin, sizing, max-width, positioning, and responsive composition. Use tight `gap-1`/`gap-2`, control `gap-2`/`gap-3`, component `gap-4`, section `gap-6`, and page `gap-8`. Use responsive page padding of approximately `px-4` on mobile, `px-6` at medium widths, and `px-8` on desktop. Prefer intrinsic content sizing and `min-h-*`/`aspect-*` over arbitrary fixed heights.

Do not introduce page-specific arbitrary values such as `mt-[13px]`, `gap-[19px]`, `w-[347px]`, or custom breakpoints. Exceptions are limited to official HeroUI implementation details, safe-area calculations, and controlled media viewports. AssetHub tokens provide visual semantics; they do not replace the Tailwind layout scale.

## CSS ownership and surface policy

`src/styles/tokens.css` is the authoritative token source. HeroUI owns primitive styling and interaction; Tailwind utilities own feature layout. `src/app/globals.css` contains imports, normalization, and existing product composition rules under migration. There are no vendored shadcn primitives or feature CSS Modules.

HeroUI floating surfaces use semantic `--overlay` / `--overlay-foreground` and `--surface` / `--surface-foreground` tokens. Use the library's portal and stacking behavior; do not patch dropdowns with arbitrary high z-index or transparent page-specific backgrounds.

The remaining `!important` declarations are limited to the reduced-motion accessibility override. Feature-level `!important` styling was removed during normalization.
## Media aspect-ratio policy

Asset preview media supports three explicit composition ratios: `1:1` (square), `4:5` (portrait), and `16:9` (landscape). Select the ratio for the asset content and available layout; never force every view into `1:1`. Full asset detail/gallery uses `16:9`; existing inventory/request compositions may retain square previews where appropriate.

Control the complete card's width and grid before sizing its media. Do not shrink only an image inside an oversized card or add empty padding to simulate a smaller card. Summary preview cards reserve consistent content slots rather than growing for each name. Asset name: at most two lines with ellipsis; Brand/category: at most two lines; location: at most two lines; age/condition: compact one-line values. Keep the full name in the accessible link label and full values in title attributes; the linked detail view displays complete information. Status labels remain visible. Detail views retain content-driven height. Media ratio is separate from overall card ratio.

Home's Ready to reuse section uses up to four cards in a two-column grid. Each complete card has a maximum width of 240 px and a fixed 208 px content area, with edge-to-edge `16:9` media by default. Whole-card maximum height depends on the ratio: 343 px for `16:9`, 448 px for `1:1`, and 508 px for `4:5`. Tokens in `src/styles/tokens.css` own these limits. Cards with the same width and media ratio must have equal height even when text differs. Shared AssetPreviewCard accepts `1:1`, `4:5`, or `16:9` through its `aspectRatio` prop. Use responsive column counts only when the card content stays readable; a four-card count does not require four columns.

On desktop, the Requests in motion panel stretches to match the adjacent Ready to reuse section. Empty space is acceptable; do not invent rows to fill it. Mobile panels retain natural height. Full lists remain accessible via View all and Inventory.

Future real photos must apply the chosen ratio, appropriate fit, loading behavior, and fallback through the shared asset media component. Ratios are layout choices, not HeroUI interaction states.

Preview text uses compact Card.Header spacing (`gap-2`, `p-3`) and natural text flow, with the remaining alignment space before the footer rather than fixed empty space between every field. Available uses a neutral tertiary Chip with a semantic border: the installed HeroUI 3.2.4 secondary variant does not supply an outline. Condition uses soft semantic Chips: Good = success/green, Fair = warning/yellow, Needs review = danger/red. These mappings are product meaning applied through HeroUI variants.

## Request workspace search and form layout

New Request and its final review hide the global header search. Select Assets owns one HeroUI SearchField with clear action, full available width on mobile and `max-w-md` on desktop. Keep search beside or below its section heading rather than stretching across the workspace. Form fields use one column on mobile and two from `sm`, aligned at the top so long event or location names do not stretch neighboring inputs. HeroUI Card compound headers and Button variants own surfaces and selection states; keep the four-step booking sequence and existing validation intact.

## New Request visual composition

The request workspace uses a bounded `max-w-6xl` container, a shared four-step progress strip, a two-thirds content column and one-third sticky summary on desktop, and one operational column on mobile. HeroUI Card sections share border, padding and type hierarchy across usage, venue information, documents, fulfillment and final review. Selected-item summaries use compact bounded rows. Select Assets places Back and Continue to fulfillment inside the sticky Request summary on desktop. Mobile uses a fixed compact summary card with both actions and an expandable selected-items panel; the panel shares the same actions and validation. Other steps retain their section actions.

The request picker uses two equal-height cards per row with edge-to-edge 16:9 media, two-line names, bounded warning previews with full tooltip text, semantic condition Chips, and a consistently anchored selection footer. This richer operational picker is separate from the compact 240 px Home discovery preview. Fulfillment choices use HeroUI RadioGroup with descriptions rather than multiline text squeezed into standard-height buttons. Verify keyboard selection and all four desktop/mobile steps before treating the UI as complete.

The accepted local HeroUI comparison (`request-preview-heroui.png`, retained as a local reference outside the repository) guides New Request: soft secondary fields, compact intrinsic-width usage buttons, calm white section cards, a two-column form and an illustrated empty summary. Registered Event begins with Brand and Event / activation, followed by read-only derived project name/address. Only pre-use documents appear in New Request; loading-out evidence is collected in Start Return.

## Booking screens: tracking first

Requests, Booking Detail, linked Return and separate Transfers use a shared journey timeline and semantic HeroUI Cards/Chips. The default view explains the current stage, actual progress and one next action. Operational forms open after an explicit action; never render every review, handover, return and inspection form together. Past/project/financial details remain in closed HeroUI Disclosures.

The orders list includes every Request status, uses a bounded search, compact project/asset summary, and stage filters. Mobile filter tabs scroll without wrapping labels or overflowing the page. Shared compact timelines use horizontal stage labels; detailed tracking stacks vertically on mobile. Long project/asset names clamp to two lines in summaries, with full titles retained; full details remain available.

Due/overdue reminders are compact initially and expand into links to the original booking return. The header bell opens the same actionable reminders. Preserve per-item partial progress, actual timestamps, review permissions and physical confirmation guards. A legacy Completed booking without receipt cannot be displayed as a physically completed order. Historical handover phases remain explicitly unverified.

See ../experience/BOOKING_TRACKING.md for the flow and prototype notification boundary.

Closed operational/detail forms mount on first expansion and stay mounted after closing to preserve unsaved inputs. Use shared WorkflowDisclosure so hidden React Aria inputs do not create SSR attribute mismatches. Record timestamps and the local reminder clock use deterministic hydration snapshots before adopting browser-local formatting.
