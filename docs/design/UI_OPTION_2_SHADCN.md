# UI Option 2: merged into the AssetHub product

The separate `/ui-option-2` showcase has been retired as a second product surface. That path now redirects to `/`, and the actual product routes are the single source of truth for visual and interaction review.

The chosen shadcn/ui React Aria base remains configured through `components.json` (`aria-maia`, preset `b1ZQ7FcEK`). Its generated primitives in `src/components/ui-option-two/` are preserved for incremental adoption; they are not a second app. The approved latest AssetHub visual direction (Inter, blue accent, neutral canvas, card-based mobile layout) is applied to the product routes, and New Request follows the four-step Usage & Dates → Select Assets → Fulfillment → Review & Submit flow.

Migration is incremental: some existing feature compositions still use HeroUI and should be moved to shared shadcn-based compositions when those screens are next changed. Do not revive the isolated showcase route to avoid maintaining duplicate product flows.
