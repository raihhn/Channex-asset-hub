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
