<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Mandatory project workflow

- These instructions apply automatically to every task in this repository; the user does not need to invoke them again.
- Before implementation, read `AI_GUIDE.md` and `docs/00_README.md`, then the relevant feature/domain/experience documents named there. These files contain the existing application flow and product guardrails; HeroUI documentation does not replace them.
- Follow the documentation authority order in `docs/00_README.md`. Preserve the requested implementation slice and its scope boundaries.
- For request-flow work, read `docs/experience/CORE_USER_FLOWS.md` and the relevant booking/review domain specifications. The New Request sequence is `Usage & Dates -> Select Assets -> Fulfillment -> Review & Submit`; readiness is inline validation, not a separate step.
- Automatically apply `.agents/skills/heroui-react/SKILL.md` for UI tasks, without waiting for a skill mention. Read it before implementation and use the `heroui-react` MCP server for relevant component/theme documentation. Do not call UI documentation tools ceremonially for unrelated backend or prose tasks.
- If the MCP server is unavailable, state the limitation and use the skill scripts plus installed package types. Never claim a successful MCP call without an actual response.
- Keep these rules project-local. Do not change global agent instructions or save personal memories to enforce them.

## AssetHub UI standard: HeroUI React v3

- Use the project skill at `.agents/skills/heroui-react/SKILL.md` for UI work.
- HeroUI v3 is the single component library. Use `@heroui/react` and its compound components; do not introduce shadcn/ui, Radix UI, or HeroUI v2 APIs.
- Fetch relevant v3 component docs through the `heroui-react` MCP server before implementation. When the server is unavailable, use the installed skill's scripts and verify against the locally installed package types.
- MCP project configuration is in `.codex/config.toml`. It supplies current documentation, not permission to upgrade dependencies. Check installed versions before using newly documented APIs.
- Keep theme, typography, spacing, radius, and semantic colors in `src/styles/tokens.css`; use shared layout rules and semantic component variants. Avoid independent visual constants for each page.
- Keep Lucide as the icon set. Use consistent sizes and accessible names for icon-only actions.
- Keep asset image ratios, fit, loading, and fallbacks in shared domain components. Follow the media/card sizing policy in `docs/design/DESIGN_SYSTEM.md`: constrain the whole preview card, reserve equal content slots with ellipsis for long names, align adjacent summary panels on desktop, and support `1:1`, `4:5`, or `16:9` media rather than forcing square previews everywhere.
- Use `onPress` for HeroUI Button actions. Preserve existing business validation, permissions, persistence, responsive behavior, and keyboard accessibility when migrating components.
- CSS customizations should handle layout or a demonstrated product need; avoid overriding HeroUI component internals merely to imitate another library.
- Verify typecheck, relevant operational tests, and desktop/mobile browser flows. Remove legacy component files and dependencies only after all consumers have migrated.

## UI delivery expectation

- Treat UI implementation as a coherent visual revamp of the requested screen, not merely replacing primitives. Review hierarchy, typography, spacing, content density, responsive composition, long-copy behavior, and consistency across every step/state in scope.
- Use the HeroUI skill and MCP, then visually inspect actual desktop and mobile renders. Passing tests alone does not establish visual completion. Remove legacy styling from the touched compositions when it conflicts with the shared design system. Preserve business rules and validation.
