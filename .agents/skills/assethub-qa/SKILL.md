---
name: assethub-qa
description: Verify AssetHub changes and review scoped diffs with proportional checks, desktop/mobile browser inspection, and accessibility review. Use for AssetHub QA, regression checks, or code review; separate observational checks from data-writing tests.
---

# AssetHub QA

Provide evidence for the requested change without expanding its scope. This is an instruction-only, project-local adaptation of selected ECC practices, not an ECC plugin installation.

## Establish scope and authority

- Confirm the repository/package and inspect Git status, staged/unstaged changes, and relevant untracked files. Preserve unrelated work; review the requested diff rather than assuming the previous commit is its baseline.
- Read root `AGENTS.md`, `AI_GUIDE.md`, and `docs/00_README.md`, then the documents named there for the affected feature. Follow their authority order and implementation boundaries. Flag unresolved conflicts rather than inventing policy.
- For UI changes, apply `.agents/skills/heroui-react/SKILL.md` and its documentation workflow. Preserve HeroUI v3, shared tokens in `src/styles/tokens.css`, Tailwind layout conventions, Lucide, and shared/domain compositions. Before Next.js code changes, consult the relevant installed Next.js guides required by AGENTS.md.
- Preserve server/domain/repository boundaries, permissions, validation, audit behavior, and current persistence/feature flags. Local PostgreSQL and session-state flows coexist; do not silently enable cloud services or persist prototype operations.
- For request changes, read `docs/experience/CORE_USER_FLOWS.md` and relevant domain specs. Preserve Usage & Dates → Select Assets → Fulfillment → Review & Submit, with inline readiness. Approval is not physical receipt; a return is not automatic availability.

## Select proportional verification

Read current `package.json` scripts and relevant test/configuration files before running commands; names alone do not establish their effects.

- For application code, perform the required typecheck and relevant operational tests from project guidance, adding scoped lint checks where appropriate. Prefer existing tests covering the changed behavior. Add meaningful regression coverage for behavior changes; do not create tests that merely mirror cosmetic implementation details.
- For instruction/documentation-only changes, validate structure, references, and the diff; application builds and browser checks are normally unnecessary.
- Run a build when the change warrants it. Account for the active dev server and shared `.next` output before starting one. Do not start or replace servers blindly.
- Broaden checks only for a demonstrated dependency, failure, or unresolved risk. No blanket coverage target, mandatory TDD, timed verification loop, or automatic dependency installation.
- Keep raw diagnostic output and actual exit statuses. Do not hide failures with output filters or print credentials/contact payloads during investigation. Scope formatting checks; do not run repository-wide write-formatting as QA cleanup.

## Keep observational and mutating checks separate

**Observational browser QA:** confirm the URL, identity, and persistence mode. Inspect navigation, scrolling, search/filter behavior, and opening/closing controls only when these do not save data. Check for autosave or mutation handlers before interacting with forms. Stop before submission, deletion, dispatch, receipt, uploads, or other state-changing actions unless the task authorizes that test. A localhost URL does not make data disposable.

**Data-writing tests:** require task authorization covering the writes and a verified isolated test environment. Inspect setup/cleanup, target URL/database, environment overrides, and server reuse first. Never target `assethub_dev` or user records. If isolation or authorization is unclear, leave these checks unrun, explain why, and continue independent observational verification.

Current hazards to re-check rather than assume away:

- `playwright.config.ts` can reuse the running localhost server; a browser suite may exercise real development data.
- `npm test` excludes booking persistence tests but can include vendor persistence tests when `ASSETHUB_VENDOR_TEST_DATABASE_URL` is set. Check inherited configuration without exposing secret values.
- Booking/vendor database tests apply schema or delete test records. Require a loopback `assethub_test` target and inspect cleanup scope. Booking persistence E2E uses its separate configuration/server.
- Migration, seed, and import commands are not verification shortcuts. The booking migration script runs all numbered migrations; some import previews also write files. Do not invoke them automatically or change environment flags to make tests pass.

## Inspect changed UI on desktop and mobile

Use existing browser tooling and project viewport conventions. Record actual viewport dimensions and routes. Inspect the affected state at both desktop and mobile widths; include tablet/breakpoint boundaries when the change concerns navigation or responsive layout.

- Check hierarchy, density, long names, field alignment, overflow, image fallbacks, and loading/empty/error states relevant to the change.
- Scroll to the final action. Ensure pagination and primary actions clear fixed navigation and device safe areas; verify dropdowns/dialogs stay usable within the viewport.
- Exercise non-writing keyboard paths: focus visibility/order, accessible control names and labels, dropdown selection, Escape dismissal, and focus return. Check touch targets, contrast, and status meaning beyond color.
- Inspect relevant console/network errors using available tooling. Use existing accessibility scanning tools when available; do not install one automatically or equate a clean scan with full accessibility compliance. State manual/screen-reader checks not performed.
- Capture useful evidence without exposing PIC details, credentials, tokens, or signed media URLs. Without an approved screenshot baseline, report visual regression comparison as inconclusive; distinguish that from an observed layout check.

If browser access is unavailable, report desktop/mobile inspection as unverified. Tests alone do not establish UI completion.

## Review and report

Read changed code with its callers and guards. Prioritize concrete regressions, authorization/data exposure, stale state, incorrect operational transitions, and architecture drift. Report actionable findings with severity, file/line, trigger, and user impact. Separate confirmed defects from uncertainty; zero findings is valid. Avoid speculative refactors and style preferences unsupported by project rules.

Report concisely:

- Scope and exact files changed.
- Checks with **PASS / FAIL / NOT RUN / INCONCLUSIVE**, commands and exit status where applicable, routes/viewports and evidence references for browser checks.
- Findings, unresolved risks, and limitations; explicitly identify data-writing tests omitted and any unverified UI states.

Do not claim checks passed unless executed and observed. Report readiness only for the verified scope. This skill grants no permission to install plugins/MCP servers, add hooks, change global settings or credentials, run migrations/resets, commit/push, spawn agents, or enable continuous learning or automatic memory updates. Preserve the user's authorization and existing project instructions.

## Attribution and pinned sources

Adapted from selected verification, browser/accessibility QA, and contextual code-review practices in [affaan-m/ECC (Everything Claude Code)](https://github.com/affaan-m/ECC), revision **90606c8315ee09cafc303515c5f33024db6b9882**:

- [Verification loop](https://github.com/affaan-m/ECC/blob/90606c8315ee09cafc303515c5f33024db6b9882/skills/verification-loop/SKILL.md)
- [Browser QA, including accessibility](https://github.com/affaan-m/ECC/blob/90606c8315ee09cafc303515c5f33024db6b9882/skills/browser-qa/SKILL.md)
- [Code reviewer](https://github.com/affaan-m/ECC/blob/90606c8315ee09cafc303515c5f33024db6b9882/agents/code-reviewer.md)

These are attribution references, not additional instructions to load or execute. Global setup, automatic learning, coverage mandates, and proactive agent execution are intentionally excluded. Upstream [MIT license](https://github.com/affaan-m/ECC/blob/90606c8315ee09cafc303515c5f33024db6b9882/LICENSE):

MIT License

Copyright (c) 2026 Affaan Mustafa

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
