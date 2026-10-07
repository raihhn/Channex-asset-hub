# AssetHub Design System

## Direction
Use shadcn-style primitives as implementation foundation, but do not ship a default/generic shadcn aesthetic. AssetHub needs its own visual hierarchy and domain components.

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

AssetHub uses official shadcn/ui source components as its base primitive layer. New shadcn additions use the React Aria base with the `aria-maia` style and preset `b1ZQ7FcEK` (Inter, blue theme, Mist base, default radius, Lucide icons). Inter Variable is the shared application font; see `DESIGN_TOKENS.md` for the authoritative role scale. Existing `src/components/ui` primitives remain unchanged until they are deliberately migrated. Components are owned in the repository and themed through AssetHub semantic tokens; shadcn defaults must not dictate the product visual identity.

Use official primitives for appropriate interactions: Button, Input, Textarea, Select, Checkbox, Radio Group, Tabs, Badge, Card, Sheet, Drawer, Dialog, Popover, Command, Dropdown Menu, Tooltip, Calendar, Separator, Scroll Area, Breadcrumb, Alert, and Skeleton. AssetHub shared and domain components compose these primitives with product-specific behavior and content.

## Layout and spacing policy

Tailwind utilities are the default layout system for grid, flex, gap, padding, margin, sizing, max-width, positioning, and responsive composition. Use tight `gap-1`/`gap-2`, control `gap-2`/`gap-3`, component `gap-4`, section `gap-6`, and page `gap-8`. Use responsive page padding of approximately `px-4` on mobile, `px-6` at medium widths, and `px-8` on desktop. Prefer intrinsic content sizing and `min-h-*`/`aspect-*` over arbitrary fixed heights.

Do not introduce page-specific arbitrary values such as `mt-[13px]`, `gap-[19px]`, `w-[347px]`, or custom breakpoints. Exceptions are limited to official shadcn implementation details, safe-area calculations, and controlled media viewports. AssetHub tokens provide visual semantics; they do not replace the Tailwind layout scale.

## CSS ownership and surface policy

The styling inventory is intentionally small: `src/app/globals.css` is the single global stylesheet and currently contains base normalization plus legacy feature compositions under migration; `src/styles/tokens.css` is the authoritative token source; `src/components/ui/` contains vendored official shadcn source; there are no CSS Modules or inline `style` geometry in the application. New feature layout belongs in Tailwind composition, not new global selectors.

All shadcn floating surfaces use portal-backed components with semantic `bg-popover`/`text-popover-foreground`, `bg-card`/`text-card-foreground`, and `bg-background`/`text-foreground` mappings. The overlay policy is: base content 0, sticky action layers 5, local menus 10, and portal surfaces 50. Do not add `z-[9999]` patches or parent overflow that clips portals.

The remaining `!important` declarations are limited to the reduced-motion accessibility override. Feature-level `!important` styling was removed during normalization.
## Media aspect-ratio policy

Asset discovery and request cards use square (`1:1`) artwork previews for fast comparison. Full asset detail/gallery media uses a wide (`16:9`) frame. The ratio is applied through shared/domain compositions, not page-specific image markup.
