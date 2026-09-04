---
type: feasibility-receipt
project: geo-seo
lease: L0 auth-boundary-feasibility
status: F0_NOT_SATISFIED
failure_class: HARNESS_PREFLIGHT_BLOCKED
boundary_feasibility: NOT_EVALUATED
created: 2026-09-04
base_sha: a56039169644997efd2fefa5d09127da791f333b
candidate_sha: d8e433d8b469ac459148e9ef5d201d54123dcf92
activation: FORBIDDEN
---

# GEO-SEO Auth Boundary Feasibility L0 — F0 NOT SATISFIED

## Decision

**F0 NOT SATISFIED / HARNESS PREFLIGHT BLOCKED.** The only authorized runtime
sequence stopped during its redacted fixture bootstrap, before middleware HTTP
execution. It produced none of the required authoritative-state
available/timeout/unavailable HTTP evidence. This is not evidence that the
Node.js middleware -> Prisma -> isolated PostgreSQL boundary is infeasible;
that boundary's runtime feasibility was **not evaluated**.

The focused unit, type, lint, production-build, network-control configuration,
PostgreSQL-readiness, and migration gates passed. Configuration inspection is
not a functional proof of zero external egress.

This receipt does not authorize L1, merge, activation, G1/G2, release, or
production. It does not claim that authentication is fixed. Per the contract,
the coordinator must stop implementation and decide whether the contract and
lease matrix need revision.

## Exact scope and state

- Worktree: `GEO-SEO-auth-l0-boundary-feasibility-20260904`
- Branch: `codex/geo-auth-l0-boundary-feasibility-20260904`
- Exact base: `a56039169644997efd2fefa5d09127da791f333b`.
- Exact evidence-only candidate SHA:
  `d8e433d8b469ac459148e9ef5d201d54123dcf92`.
- The candidate contains only the three source/test files that were actually
  exercised. It is `DO NOT MERGE`, activation-forbidden, and not release code.
- Owned repository changes only: `src/middleware.ts`,
  `src/lib/auth/state-probe.ts`,
  `src/middleware-auth-state-probe.test.ts`, and this receipt.
- Package manifests, lockfile, Prisma schema/migrations, Auth.js core,
  response adapter, routes, and default test configuration were not modified.

## Environment

- Evidence window: 2026-09-04 21:41–21:52 Asia/Shanghai
- Node.js: 22.23.2 for verification commands
- pnpm: 11.25.0
- Next.js: 15.5.25
- Docker Engine: 29.2.1
- PostgreSQL image: pre-existing local `postgres:16-alpine`; no pull
- Runtime secret files such as `.env` and `.env.local` were absent and were not
  read or created. The tracked `.env.example` exists and was not read as
  runtime configuration.

No runtime URL, port, password, database credential, probe key, Auth.js secret,
cookie, token, or user identifier is recorded in this receipt or command
output. Temporary values existed only as process variables and task resources.

## Executed evidence

| Gate | Sanitized command summary | Exit/result |
|---|---|---|
| Initial custody | status, HEAD, worktree, branch, stash inventory | PASS; exact base/HEAD matched; clean; stash count 0 |
| Offline install | pnpm offline frozen install | PASS, exit 0; 801 packages reused from local store, 0 downloaded |
| Focused unit | Vitest on the injected-loader auth-state helper test | PASS, exit 0; 1 file, 4 tests; no Prisma/HTTP runtime coverage |
| TypeScript | project typecheck | PASS, exit 0 |
| Production build | Next production build | PASS, exit 0; middleware compiled; 78/78 static pages generated |
| Lint | project ESLint | PASS, exit 0 |
| Diff hygiene | `git diff --check` | PASS, exit 0 |
| Schema/migrations | exact-base diff of schema and migration tree | PASS, exit 0; unchanged |
| Forbidden imports | owned probe files scanned for CASTR, Redis, BullMQ, worker, scheduler, brand monitor, and provider imports | PASS; none found |
| Secret literals | refined owned-file scan for connection URLs, private-key markers, and common credential literal formats | PASS; none found |

The exact sanitized command strings and exact temporary resource names were
not retained by the original harness and are therefore recorded as **NOT
RETAINED**, rather than reconstructed after the fact. The table above is a
sanitized stage/result summary, not an exact-command transcript.

An earlier deliberately broad secret scan returned exit 1 because it matched
safe field/identifier names such as `mustChangePassword`, `token`, and the
existing `process.env.AUTH_SECRET` reference. No value was matched. The refined
value-oriented scan above passed; the broad result is not represented as a
secret finding.

## Runtime harness evidence

### Internal-network feasibility check

The first bounded harness attempts used the task-owned custom internal network.
Docker retained a `127.0.0.1` HostConfig binding but did not create a runtime
port mapping; a bounded host TCP check failed. No migration or HTTP request ran
in those attempts. Each attempt cleaned the exact task resources to 0/0/0.

The coordinator then authorized one final alternative only: a task-owned
custom bridge with both
`com.docker.network.bridge.enable_ip_masquerade=false` and
`com.docker.network.bridge.host_binding_ipv4=127.0.0.1`, explicit loopback port
publication, and loopback-only container DNS. No default bridge was used.

### Final authorized runtime attempt

Observed non-sensitive markers, in order. Exact resource identities and raw
inspect output were **NOT RETAINED**:

1. task-owned resource-name precheck PASS;
2. validated-free loopback port precheck PASS;
3. network-control configuration inspect PASS: custom bridge,
   masquerade disabled, HostIp exactly `127.0.0.1`, exact selected HostPort,
   loopback DNS, cached local image;
4. isolated PostgreSQL readiness PASS;
5. existing migration deployment PASS, exit 0;
6. parent harness exit 1 before the fixture-success marker.

The failing child command was the redacted authoritative-user fixture
bootstrap. Its exact sanitized command, child exit code, and direct diagnostic
were not retained:
the harness redirected its output into a task temporary file and the mandatory
cleanup removed that file. The direct cause is therefore **UNKNOWN**. It is not
valid to infer a Prisma, schema, credential, application, or Docker root cause
from the available evidence.

Per the coordinator's one-attempt ruling, no second runtime path, default
bridge, fallback boundary, or retry was attempted.

### Required HTTP rows not covered

| Runtime row | Result |
|---|---|
| Authoritative state available through production middleware | NOT RUN / no HTTP evidence |
| Locked/slow PostgreSQL read returns bounded 503 fail-closed | NOT RUN / no HTTP evidence |
| Stopped/unavailable PostgreSQL returns bounded 503 fail-closed | NOT RUN / no HTTP evidence |
| No `Location`, JSON envelope, and `Cache-Control: no-store` for failures | NOT RUN / no HTTP evidence |

Because all four runtime rows are absent, successful build-time Prisma loading
cannot be promoted to middleware runtime feasibility. F0 remains not satisfied,
and boundary feasibility remains not evaluated.

## Cleanup and side effects

- Final exact resource inventory: task container 0, task volume 0, task network
  0.
- Only the named L0 container, volume, and network were created and removed.
- No Redis, worker, scheduler, brand monitor, provider, real account,
  publishing, deployment, paid action, or production data was used.
- No public IP, DNS name, or external URL was contacted to test egress.
- The no-masquerade setting and loopback binding were configuration controls
  whose presence was inspected. Their functional zero-egress effect was not
  tested and is not claimed.
- The isolated temporary database received existing migrations before the
  fixture bootstrap failed; its task-owned volume was then removed. No schema
  or migration source file changed.

## Known L1 risk retained

The probe's `Promise.race` timeout bounds the middleware's fail-closed HTTP
decision, but it does **not** cancel the underlying Prisma query. A timed-out
query may continue consuming a connection until PostgreSQL completes or fails
it. L0 does not solve or prove connection-level cancellation, statement
timeouts, pool recovery, or backpressure. Any revised contract or future L1
must treat those as explicit design and load-test concerns.

## Repository integrity at receipt time

- Exact source/test candidate is
  `d8e433d8b469ac459148e9ef5d201d54123dcf92`.
- The candidate commit contains `src/middleware.ts`,
  `src/lib/auth/state-probe.ts`, and
  `src/middleware-auth-state-probe.test.ts`. This receipt is a subsequent
  evidence artifact and is not part of the candidate SHA.
- Stash count: 0.
- Schema SHA-256:
  `71ac5e95dd4c9d8fa8a6009af00b28e54dab6a9197e9ef9baf416129e956ee37`.
- Migration-tree SHA-256:
  `540ef2a9dab5668144d06f12ba657d6d94132246bcc70dbb198c596045ad9c95`.
- Candidate evidence commit: performed after the run to bind the unchanged
  exercised source/test content to an immutable SHA. Push, merge, activation,
  rebase, reset, stash, and destructive deletion were not performed at receipt
  drafting time.

## Rollback boundary

This probe is unactivated and forbidden from product merge. The accepted
product rollback point remains the exact base SHA above; the candidate commit
exists only to preserve failed-run evidence. The coordinator owns any later
decision about this disposable worktree. No reset, stash, destructive deletion,
merge, or activation was performed.
