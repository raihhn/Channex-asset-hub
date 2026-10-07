# Mobile UI Consistency QA

## Comparison setup

- Source visuals: user-provided mobile dashboard `/var/folders/w5/pz85x15s4klf0k0ntd84fw480000gp/T/codex-clipboard-81f7b7d4-bafe-4676-8501-34253fb023fc.png` (756 × 1648 px), Inventory `/var/folders/w5/pz85x15s4klf0k0ntd84fw480000gp/T/codex-clipboard-10005fe8-5c51-4b7b-948a-b033ef314e1d.png` (784 × 1672 px), and selected-request summary `/var/folders/w5/pz85x15s4klf0k0ntd84fw480000gp/T/codex-clipboard-a2122bc9-3448-4b9b-9954-3ce695e1f653.png` (764 × 744 px).
- Implementation captures: local browser captures at `http://localhost:3000/`, `http://localhost:3000/assets`, `http://localhost:3000/assets/wardah-glow-pavilion`, `http://localhost:3000/me`, and `http://localhost:3000/request/new`. Captures were viewed inline through the selected in-app browser and were not persisted as image files.
- Viewport: 390 × 844 CSS px; implementation captures were 390 × 844 px at device scale factor 1. Source screenshots are higher-resolution attachments; they were viewed scaled to fit and compared as mobile-layout references, not pixel-perfect clones. The supplied dashboard and request screens represent different content/states.
- State: Dashboard resting state; Inventory first page; Asset Detail at top; Profile; New Request with one selected item and selected-items Sheet open.
- Interaction checks: selected an available asset; opened the mobile selection Sheet; confirmed item, readiness, and Review request action; removed the item and confirmed the empty state and disabled review action. Did not submit a request.
- Browser console: no errors reported in the preview tab.
- Full-view evidence: compared dashboard, Inventory, and request-selection captures against the supplied mobile references in the same browser QA pass. Also checked Profile and Asset Detail separately for layout collisions.
- Focused evidence: inspected Inventory grid tracks/artwork ratio, the selected-items Sheet and CTA bounds, and Asset Detail horizontal overflow. No separate crop was needed after these focused checks.

## Fidelity surfaces

- Fonts and typography: Inter Variable is loaded and used through shared font tokens. The documented role scale is applied: page titles 700, section/card titles 600, body 400, UI labels 500, secondary/captions 400, with shared sizes and line heights. The visual hierarchy is consistent across inspected screens; mobile labels wrap without collision.
- Spacing and layout rhythm: mobile page gutters and shared token spacing are retained. Inventory is a two-column grid at 390 px with two `173 px` tracks and square (`1:1`) card artwork. Full Asset Detail artwork uses `16:9`. Dashboard action cards are one column on narrow screens; selected-items access sits above the bottom navigation after selection.
- Colors and visual tokens: semantic AssetHub blue, neutral surfaces, and status colors remain in use; reference palettes were not copied as independent themes.
- Image quality and asset fidelity: existing AssetHub fixture artwork remains the current illustration placeholder because the prototype does not provide real asset photography. No reference photos or logos were repurposed as product assets.
- Copy and content: selection count is singular/plural aware; summaries identify selected asset, category, location, and readiness. Existing product copy and request logic are preserved.

## Comparison history and fixes

1. Initial mobile inspection found the empty selection dock covering the Usage Context form. The dock now appears only after at least one asset is selected. Post-fix browser evidence showed no dock before selection, and a reachable count/Review action after selection.
2. Initial Dashboard inspection found action-card descriptions placed in a third grid column, visually competing with titles. Explicit icon/title/description/arrow grid placement and a single-column mobile action layout fixed the overlap. Post-fix comparison showed clear, separate title and supporting-text rows.
3. Asset Detail initially exceeded the 390 px viewport because nested grid min-content sizing let the history filter row widen its parent; the sticky Request Asset action also covered detail copy. Page and content grids now have constrained tracks, the filter row scrolls within its own width, and the mobile action follows the content. Post-fix browser measurement reported document width 390 px at a 390 px viewport, with no horizontal page overflow.
4. One-item selection initially displayed “1 assets”. Count labels now use singular/plural forms. The Sheet removal interaction was rechecked; removing the final item shows the empty state and disables review.

## Findings

- No actionable P0, P1, or P2 findings remain in the inspected mobile screens.

## Open questions

- None blocking this pass. Product photography can replace fixture artwork when approved asset images are available.

## Implementation checklist

- [x] Inter Variable and documented typography weights standardized.
- [x] Inventory and request-picker artwork normalized to square preview frames; full detail media remains 16:9.
- [x] Inventory mobile grid uses two columns.
- [x] Selected-item summary stays reachable above mobile navigation after selection; item removal and review state work.
- [x] Dashboard action-card text no longer overlaps.
- [x] Asset Detail content no longer overflows horizontally or has a floating action covering copy.
- [x] Mobile guidance updated in `docs/experience/MOBILE_EXPERIENCE.md`.
- [x] Typecheck, production build, and `git diff --check` pass.

## Follow-up polish

- Replace fixture illustration artwork with approved asset photos when the product image library is ready.

final result: passed

---

# Request Flow Booth, WBS, Filters, and Status QA — 2026-10-06

## Comparison setup

- Source visuals: current user references `codex-clipboard-ddd3b22a-1336-415e-b69b-171a55db9fe9.png` (2862 × 1606 px; displayed at 2048 × 1149) and `codex-clipboard-7395a1d5-4d73-4ebf-af7c-27156610e030.png` (2032 × 1636 px; displayed at 1748 × 1408). The mobile asset-selection reference `codex-clipboard-c8751339-7c58-4b67-a0d4-2d076983d51c.png` (742 × 1188 px) was used to inspect picker density and selected-items reachability.
- Implementation screenshots: `/tmp/assethub-request-step1-wide-final.png`, `/tmp/assethub-request-picker-wide-final.png`, and `/tmp/assethub-request-picker-mobile-390x844.png`.
- Viewports / pixel dimensions: Step 1 at 2048 × 1149 CSS px and device scale 1; picker desktop at 1748 × 1408 CSS px and device scale 1; picker mobile at 390 × 844 CSS px and device scale 1. Desktop references are cropped app screenshots; the mobile reference is scaled to fit. Comparison focused on the relevant app content, not shell chrome.
- State: Step 1 with a manual WBS reference added; Step 2 with one selected Booth asset, filters visible, and the mobile selected-items dock present.
- Full-view comparison: reviewed each relevant source and implementation screenshot together. Focused regions were the WBS field/CTA, Booth requirement placement, asset-add affordance, semantic status chips, and mobile selected-items dock.
- Interaction / console: E2E exercised the required-WBS gate, detail-to-request preselection plus adding another asset, booth selection, and the Custom Booth path. Browser console and page errors were empty in screenshot capture.

## Findings and comparison history

- The old Step 1 source shows Booth requirement below Usage Context as a separate block. It is intentionally moved into the Step 2 asset filter row, where it appears first on mobile; Brand and Category use the same shared HeroUI Select wrapper. This is the requested flow change, not visual drift.
- WBS now displays Required, gives `ABC12345` as an example, and blocks progression until at least one manual reference is added. Empty Add reference is disabled; with text entered it uses the active primary style.
- Asset actions use icon-only `+` buttons; selected items use a check action with the same active accent treatment. Unavailable assets remain disabled. The mobile selected-items dock stays visible above bottom navigation.
- Asset and request status patterns now compose the active HeroUI `Chip` primitive with semantic colors. No P0/P1/P2 issues were found in the inspected states.
- The existing app shell and four-step header make the implementation taller than the cropped mobile reference; this is expected because the reference omits that shell and the approved request flow retains its step context.

## Fidelity surfaces

- Typography: existing Inter/token scale retained; labels, selected filter titles, and status chip sizes remain consistent with the active app.
- Spacing/layout: shared filter spacing and responsive two-column mobile filter layout retained; Booth requirement is first on mobile so the sticky summary does not obscure this primary control at the top of the picker.
- Colors/tokens: active usage selection and add actions use the AssetHub blue/accent system; disabled Add reference remains muted. Status colors are semantic HeroUI Chips rather than page-specific status pills.
- Images/icons: existing square asset-card artwork is unchanged; `+`, check, search, and other interface icons use the existing Lucide family.
- Copy: required WBS guidance is explicit; booth helper copy distinguishes Regular Booth asset selection from Custom Booth requirement-only behavior.

## Validation

- `npm run typecheck` — passed.
- `npm run lint -- --no-cache` — passed.
- `npm test` — passed, 10 tests.
- `npm run test:e2e` — passed, 6 tests across mobile and desktop.
- `npm run build` — passed.

final result: passed
