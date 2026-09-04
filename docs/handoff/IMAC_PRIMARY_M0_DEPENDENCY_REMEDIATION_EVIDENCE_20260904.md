# GEO-SEO M0 dependency vulnerability remediation evidence

## Scope and status

- Date: 2026-09-04 (Asia/Hong_Kong)
- Worktree: `/Users/hymanwong/Documents/dev/my-products/GEO-SEO-m0-dependency-remediation-20260904`
- Branch: `codex/geo-m0-dependency-remediation-20260904`
- Base and current uncommitted HEAD: `947dcb9535a65f4e8f5211d522b8595381661dbd`
- Runtime: Node `v22.23.2`, Corepack `pnpm 11.25.0`
- Scope: production dependency advisory remediation plus the minimum RichEditor compatibility changes required by the Tiptap v2-to-v3 major upgrade. Interface impact: RichEditor retains its explicit Link (`openOnClick: false`), Placeholder, and transaction-driven toolbar state behavior; no server/API contract change. Migration: dependency/lockfile resolution plus one editor component and one focused regression test; no schema or data migration.
- This evidence is not G1/G2, merge, deployment, release, or production approval. No web, worker, database, Docker, provider, CMS, distribution, notification, publishing, payment, or production action was run.

## Initial audit diagnosis

The official npm advisory endpoint was available. Before changes, `corepack pnpm audit --prod --registry=https://registry.npmjs.org --json` exited `1` and reported `8` advisories: `1 low`, `1 moderate`, and `6 high`.

| Dependency | Before | Advisory / affected path | Remediation |
|---|---:|---|---|
| `browserslist` | `4.28.2` | `GHSA-c83g-rgw3-j3cx`, `GHSA-73wf-gq98-2v4g`; Sentry/Babel/webpack and Next/`styled-jsx` paths | override to `4.28.7` (first patched version) |
| `fast-uri` | `3.1.5` | `GHSA-5jgf-p345-68v8`, `GHSA-f65p-4m7j-42xc`, `GHSA-fph4-wmhf-6fwf`, `GHSA-jqff-g426-hqxp`; `@sentry/nextjs > webpack > schema-utils > ajv` paths | override to `3.1.6` (first patched version) |
| `postcss-selector-parser` | `6.1.2` | `GHSA-w9m9-85wc-3x92`; `tailwindcss-animate > tailwindcss` paths | override to `6.1.3` (first patched version) |
| `@tiptap/core` | `2.27.2` | `GHSA-cp6q-959q-f8rh`; direct Link, Placeholder, React, StarterKit and all StarterKit extension paths | co-version direct Tiptap packages to `3.30.4`, the first patched release |

`@tiptap/core` has no patched v2 release. A core-only override would violate the direct packages' v2 peers. The direct `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `@tiptap/pm`, `@tiptap/react`, and `@tiptap/starter-kit` declarations were therefore co-versioned exactly to `3.30.4`. `@tiptap/react` permits its Bubble/Floating Menu dependencies to float; they initially resolved to `3.31.2` and required matching core/pm peers. The workspace policy consequently pins only those two transitive Tiptap packages to `3.30.4`, producing one peer-consistent Tiptap graph.

Independent review found three v3 compatibility risks. `StarterKit` v3 includes Link while RichEditor also deliberately configures Link, so RichEditor now uses `StarterKit.configure({ link: false })` and retains the explicit Link extension. Tiptap React v3 defaults `shouldRerenderOnTransaction` to false; RichEditor renders toolbar `editor.isActive(...)` values directly, so it explicitly opts into `shouldRerenderOnTransaction: true` for v2-compatible transaction subscription behavior. Finally, the initial v3 lock graph contained two `prosemirror-model` and two `prosemirror-view` versions; the policy now resolves one installed graph and is covered by a real headless Editor regression.

## Policy and resolved-version changes

`pnpm 11.25.0` emitted this warning when a trial `package.json#pnpm.overrides` was used: the `pnpm` field is no longer read and `pnpm.overrides` is ignored. That trial was removed. The durable policy source for this repository is `pnpm-workspace.yaml`.

Workspace override changes:

| Override | Before | After |
|---|---:|---:|
| `browserslist` | absent | `4.28.7` |
| `fast-uri` | `3.1.5` | `3.1.6` |
| `postcss-selector-parser` | absent | `6.1.3` |
| `@tiptap/extension-bubble-menu` | absent | `3.30.4` |
| `@tiptap/extension-floating-menu` | absent | `3.30.4` |
| `prosemirror-model` | unpinned (`1.25.7`, `1.25.11`) | `1.25.11` |
| `prosemirror-view` | unpinned (`1.41.8`, `1.42.3`) | `1.42.3` |

The regenerated lockfile resolves `browserslist@4.28.7`, `fast-uri@3.1.6`, `postcss-selector-parser@6.1.3`, and a single `@tiptap/core/@tiptap/pm` 3.30.4 graph. It contains none of `browserslist@4.28.2`, `fast-uri@3.1.5`, `postcss-selector-parser@6.1.2`, or `@tiptap/core@2.27.2`. It also contains only `prosemirror-model@1.25.11` and `prosemirror-view@1.42.3`; installed-graph inspection found no older second instance.

## Executed verification

All commands ran from the stated worktree with `/usr/local/opt/node@22/bin` first in `PATH`. Bounded npm-registry retry settings were used for networked install/audit calls: one retry, 10-second fetch timeout, 1–5-second retry backoff. The registry responded; no unavailable-registry pass claim is made.

| Command | Exit | Result |
|---|---:|---|
| `corepack pnpm install --lockfile-only --registry=https://registry.npmjs.org` | 0 | regenerated lockfile |
| second `corepack pnpm install --lockfile-only --registry=https://registry.npmjs.org` | 0 | before/after `pnpm-lock.yaml` SHA-256 matched (`7b688c33c37b2477bcc2463672e69f38365cea5f05e6970317dbb117dfc1ca9a`) |
| `corepack pnpm install --frozen-lockfile --registry=https://registry.npmjs.org` | 0 | frozen install completed |
| `corepack pnpm peers check` | 0 | no peer dependency issues |
| `corepack pnpm audit --prod --registry=https://registry.npmjs.org --json` | 0 | `0` info, low, moderate, high, and critical vulnerabilities |
| `corepack pnpm audit --prod` | 0 | `No known vulnerabilities found` |
| `corepack pnpm peers check` after singleton overrides | 0 | no peer dependency issues |
| `corepack pnpm exec vitest run src/components/editor/RichEditor.test.ts` | 0 | configuration plus real installed-graph headless Editor regression passed |
| real headless Editor regression | 0 | no duplicate ProseMirror diagnostic; `toggleBlockquote` and an independent `splitBlock` both returned true with asserted JSON |
| `corepack pnpm typecheck` | 0 | TypeScript passed after editor compatibility changes |
| `corepack pnpm lint` | 0 | ESLint passed |
| `corepack pnpm test` | 0 | 35 files; 152/152 tests passed |
| `corepack pnpm build` | 0 | independent exclusive Next.js 15.5.25 production build passed |
| `git diff --check` | 0 | no whitespace errors |
| high-confidence secret-literal scan of the task diff | 0 | no credential-like literal found |
| exact owned-file diff check | 0 | only the six approved task files changed |

The unit suite's expected fallback/error-path diagnostic messages were emitted by its fixtures; the suite exited 0 and completed all 152 tests. An earlier build cache collision occurred while two builds shared `.next`; it was an execution-concurrency issue, not a product failure, and is excluded from the product result. The subsequent coordinator exclusive build passed, and this task's final exclusive build also exited 0.

## Rollback and handoff

- Roll back before merge by reverting this task's dependency declarations, seven workspace-policy override lines, RichEditor compatibility edit, focused editor regression, and matching `pnpm-lock.yaml` changes together; then run the frozen install, editor regression, and audit again. No schema/data rollback is needed.
- Current task diff is limited to `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `src/components/editor/RichEditor.tsx`, `src/components/editor/RichEditor.test.ts`, and this evidence file. No commit or push was made.
- Remaining scope: independent review/acceptance and an authenticated browser/manual RichEditor smoke for selection-driven toolbar state, Link dialog behavior, and Placeholder rendering, then any separately authorized merge/release decision. This task does not clear unrelated M0 findings (offline worker profile, Docker/runtime, PDF/browser egress, or API response-contract work).
