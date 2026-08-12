# Responsive Rules

## Principle
Responsive does not mean shrinking desktop. Mobile is the primary operational design.

## Pattern mapping
| Desktop | Mobile |
|---|---|
| Persistent sidebar | Bottom navigation + secondary menu |
| Dense table | Cards/list; table only when genuinely usable |
| Inline filter bar | Filter sheet/drawer |
| Multi-column dashboard | Prioritized vertical sections |
| Wide modal | Dialog or bottom sheet depending task |
| Side-by-side detail panels | Stacked hierarchy |
| Hover affordance | Explicit touch affordance |

## Breakpoint behavior
Use project-standard Tailwind breakpoints unless a real UX need requires otherwise. Do not invent per-screen breakpoints.

## Navigation
Primary mobile nav should remain compact. Admin/master-data functions live in secondary navigation unless the role/workflow proves otherwise.

## Sticky actions
Booking/approval primary actions may be sticky on mobile when they remain contextually safe. Respect safe-area inset.

## Tables
Do not horizontally squeeze desktop tables into unreadable mobile layouts. Provide card/list representation or deliberately scoped horizontal scroll only when necessary.
