# Design Tokens

Define tokens centrally before broad UI implementation.

## Token groups
- Background: app, surface, elevated
- Text: primary, secondary, muted, inverse
- Border: subtle, default, strong
- Brand/accent: primary + interaction states
- Semantic: success/available, warning/review, danger/unavailable, info/reserved/in-use as appropriate
- Radius scale
- Spacing scale
- Typography scale
- Elevation/shadow scale
- Motion duration/easing where used

## Rules
- No hard-coded hex colors in feature/page code.
- Avoid arbitrary Tailwind values when a token/scale exists.
- Do not create a new semantic color for a one-off screen.
- Status components consume semantic tokens, not raw colors.
- Mobile and desktop share tokens even when composition differs.
# Token usage consolidation

Use the existing semantic color, spacing, radius, border, elevation, typography, and motion tokens only. Status uses semantic labels and token colors consistently. Operational rows use dividers and grouped facts; rounded elevated surfaces are reserved for meaningful interactive or grouped objects.

## Typography roles

Use Inter Variable across the application, with `Inter`, `ui-sans-serif`, and `system-ui` fallbacks. Do not mix a second display family into page-specific screens.

| Role | Size | Weight | Line height |
|---|---:|---:|---:|
| Page title | `clamp(1.875rem, 3vw, 2.25rem)` | 600 | 1.17 |
| Section title | 1.25rem | 600 | 1.33 |
| Card / drawer title | 1rem | 600 | 1.5 |
| Body | 1rem | 400 | 1.5 |
| UI label / button | 0.875rem | 500 | 1.5 |
| Secondary / metadata | 0.875rem | 400 | 1.5 |
| Small caption | 0.75rem | 400 | 1.25 |

Use these roles through the shared tokens in `src/styles/tokens.css`. Component-specific exceptions must be rare, purposeful, and must not create a second scale for the same role.


The scale follows HeroUI typography sizes and weights. Operational section titles use the h4 visual size, card titles use h6, and secondary copy uses body-sm. Page titles adapt from 30px on mobile to 36px on desktop. Body line height stays compact for operational forms. HeroUI controls own their font sizing and weight; do not force controls to inherit a surrounding label weight. Use semibold for primary entity names, medium for labels, and regular for addresses and editable values.
