---
type: architecture-contract
project: geo-seo
contract: auth-api-first-login
version: v1.1
status: PROPOSED / L0 HARNESS_PREFLIGHT_BLOCKED / NOT IMPLEMENTED / NOT RELEASE APPROVED
created: 2026-09-04
revised: 2026-09-04
base_sha: a56039169644997efd2fefa5d09127da791f333b
runtime_product_rollback_sha: a56039169644997efd2fefa5d09127da791f333b
f0_1_contract_construction_sha: PENDING_COORDINATOR_APPROVED_V1_1_CONTRACT_COMMIT
supersedes: AUTH_API_FIRST_LOGIN_CONTRACT_V1.md@a56039169644997efd2fefa5d09127da791f333b
---

# GEO-SEO First-Login/API Boundary Contract V1.1

> This is a contract-first design. It is a proposal only: no implementation,
> schema migration, deployment, release, or production approval is implied.

## 1. Purpose and scope

This contract defines the first-login/API boundary between route classification,
the Auth.js JWT session, the password-change flow, API clients, and the seed
fixture. It has one primary safety property:

> A user who must change the initial password may reach the password-change
> page, but may not accidentally receive an HTML redirect when calling a
> protected API. After a successful change, the server state and the session
> agree without requiring a second login.

In scope:

- route-classification and response semantics for pages, protected APIs, and
  unauthenticated APIs;
- the `MUST_CHANGE_PASSWORD` error envelope and defensive parsing only for the
  change-password client, the auth E2E helper, and the contract login/session
  probe;
- authoritative server-state checks and JWT/session refresh after password
  change;
- idempotent seed behavior for existing and fresh users;
- migration, rollback, session-expiry, and acceptance contracts;
- Harness-compatible capability/port boundaries and non-overlapping leases.

Out of scope:

- a Prisma schema or migration change;
- password policy redesign, password-reset product behavior, MFA, or account
  recovery;
- changing the Auth.js provider, cookie names, JWT encryption/signing secret,
  or the 24-hour session policy unless a later auth contract approves it;
- fixing the adjacent `callbackUrl` same-origin/open-redirect issue (a separate
  release-before-ship blocker tracked as an explicit open item in §15);
- any CASTR code, shared product database, shared UI, or cross-repository
  business implementation;
- real providers, real accounts, external publishing, production data, or
  release/G1/G2 approval.

## 2. Current evidence and observed defect

The following is source inspection evidence from base commit
`947dcb9535a65f4e8f5211d522b8595381661dbd`; it is not runtime acceptance
evidence.

1. `src/middleware.ts:16-22` treats every `/api/auth/` route as a middleware
   public exception, and `src/middleware.ts:38-43` returns the standard 401
   JSON envelope for an unauthenticated protected API.
2. `src/middleware.ts:50-52` currently redirects **every authenticated request**
   with `token.mustChangePassword` to `/change-password`, including a protected
   `/api/*` request. The result is a 307 redirect and the client may receive
   HTML after following it. This is the defect addressed by this contract.
3. `src/lib/api/response.ts:30-49` defines the normal `{ data, error }` JSON
   envelope, and `Errors.mustChangePassword()` at lines 81-82 already defines
   the intended code and status (`MUST_CHANGE_PASSWORD`, 403).
4. `src/lib/auth.ts:21` uses JWT sessions with `maxAge: 24 * 60 * 60`, and
   `src/lib/auth.ts:64-76` copies `mustChangePassword` into the JWT and session
   only when the user is present. It does not currently reconcile an old JWT
   after the database flag changes.
5. Both password-change routes update `passwordHash`, `mustChangePassword`, and
   `lastPasswordChangeAt`, but currently return only the normal success body;
   neither route has a specified server-side session refresh contract.
6. `src/prisma/seed.ts:22-32` and `:39-49` use `upsert(..., update: {})` and
   therefore preserve existing user state by default. On a fresh database,
   `mustChangePassword` is derived from `SEED_REQUIRE_PASSWORD_CHANGE`; the
   current member-password fallback is random, so deterministic isolated tests
   must provide explicit fixture inputs.
7. `src/prisma/schema.prisma:122-133` and the initial migration already contain
   `passwordHash`, `mustChangePassword`, and `lastPasswordChangeAt`. No new
   column is required by this contract.

The source-inspection reproduction and all future V1.1 implementation commands
are deliberately listed as **PLANNED / NOT RUN** in §14. This document does not
claim that the observed defect has been re-executed in this worktree. A separate
L0 probe did run build/static gates but stopped before any valid middleware HTTP
row because its fixture-bootstrap retention was incomplete; its precise result
is `HARNESS_PREFLIGHT_BLOCKED`, recorded by the immutable evidence refs in
§8.3, not a runtime boundary finding.

## 3. Harness boundary and invariants

Adopt Harness-lite for this slice. The stable core owns the auth policy and
state transition; volatile Auth.js, cookie, Prisma, and HTTP details remain
boundary adapters.

### 3.1 Stable capabilities/ports

The implementation may expose these internal typed ports, without creating a
general plugin system:

| Port | Stable responsibility | Boundary provider |
|---|---|---|
| `AuthStatePort` | Read the authoritative active-user auth state by server identity | Prisma adapter |
| `AuthPolicyPort` | Classify request as public, page, protected API, or password-change exception | Next middleware adapter |
| `SessionRefreshPort` | Reissue a server-trusted session after a password-change transaction | server-only Auth.js v5 beta `unstable_update` adapter |
| `SeedPolicyPort` | Apply create-only default or explicitly scoped test reconciliation | Prisma seed adapter |
| `ApiEnvelopePort` | Produce the versioned JSON success/error envelope | NextResponse adapter |

The domain core must not depend on a Prisma client, Auth.js callback object,
cookie value, provider SDK, or browser `useSession()` state. No dynamic plugin
loading is proposed.

### 3.2 F0 auth-boundary feasibility taxonomy and fixed boundary

F0 has exactly three outcomes: `PASS`, `BOUNDARY_FAIL`, and
`HARNESS_PREFLIGHT_BLOCKED`. They are mutually exclusive and are classified in
this priority order:

1. `HARNESS_PREFLIGHT_BLOCKED`: the candidate, fixture, harness,
   infrastructure, evidence freeze/retention, exact cleanup, or functional
   zero-egress proof fails such that the run cannot be trusted as a boundary
   verdict. This includes a harness fault after preflight during the single
   runtime attempt. If a boundary assertion failure is mixed with a harness or
   evidence failure and attribution is not conclusive, fail closed to this
   class and do not infer a boundary result.
2. `BOUNDARY_FAIL`: the candidate and harness evidence remain trustworthy, and
   the production build or at least one actual fixed-boundary runtime assertion
   fails conclusively. Remaining rows terminated by that conclusive result are
   recorded as `NOT_RUN_AFTER_BOUNDARY_FAIL`; they do not reclassify the result
   as preflight blocked.
3. `PASS`: every required build, runtime, HTTP-row, retained-evidence, exact
   cleanup, and functional zero-egress gate passes.

Only `PASS` permits the coordinator to consider signing L1. Both non-PASS
outcomes block L1, merge, activation, G1/G2, release, and production.

The sole F0 boundary remains, without substitution:

```text
Next 15 Node.js middleware → Prisma AuthStatePort/probe → task-isolated PostgreSQL
```

F0 must not use a route-handler fallback, a JWT-only decision, the Docker
default network, or a retry on another boundary. It is an independent,
disposable candidate branch/worktree; it is never activated, merged into a
release candidate, or treated as product implementation. A valid PASS proves
Prisma client loading, database connectivity, timeout/unavailable behavior, and
the absence of a middleware bundling/runtime regression against this exact
boundary.

The observed L0 receipt is `HARNESS_PREFLIGHT_BLOCKED`: fixture bootstrap
evidence was not retained, so no authoritative-state HTTP row was evaluated.
It must not be described as a boundary failure. The immutable failed candidate
and evidence receipt are recorded in §8.3 and §12.

### 3.3 F0.1 preflight and single-runtime-attempt rule

F0.1 is a revision-only feasibility lease. Its branch must be created from the
coordinator-approved V1.1 contract commit SHA. The three probe paths are then
materialized as exact blobs from
`d8e433d8b469ac459148e9ef5d201d54123dcf92`; that SHA is blob authority only,
not the F0.1 Git parent. The historical receipt commit must not be cherry-picked.
Before any F0.1 preflight or runtime command runs, the complete
source/test/harness candidate **must be committed to an immutable Git SHA**.
The SHA is then recorded in the task-local stage manifest and every retained
receipt. A mutable worktree, post-run candidate commit, missing candidate SHA,
or probe-blob mismatch is `HARNESS_PREFLIGHT_BLOCKED`.

The fixture/bootstrap harness is a static/local preflight on that same
candidate. It must prove, before runtime, that the candidate-owned bootstrap
test and evidence collector can preserve the required redacted evidence. Only
after this preflight PASS may F0.1 make **one** production-runtime attempt. In
one continuous web/isolated-PostgreSQL lifecycle, that attempt must obtain all
three HTTP rows: available state, locked/slow-query timeout, and PostgreSQL
unavailable. Every failure row must additionally prove JSON media type, absent
`Location`, and `Cache-Control: no-store`. The web runtime must be the traced
task-owned web container described in §12.1; host Next is forbidden.

No second runtime path, default-network fallback, route-handler/JWT-only
fallback, or retry is authorized by this contract. A preflight or evidence
retention failure is `HARNESS_PREFLIGHT_BLOCKED`. Under a trustworthy harness,
a conclusive production-build failure or any conclusive actual fixed-boundary
assertion failure is `BOUNDARY_FAIL`; later rows may be recorded as
`NOT_RUN_AFTER_BOUNDARY_FAIL`. Only completion and PASS of every required
build, runtime, HTTP, evidence, cleanup, and functional-egress gate is `PASS`.
Any mixed harness/evidence/infrastructure and boundary signal whose attribution
is uncertain is `HARNESS_PREFLIGHT_BLOCKED`, with no boundary inference.

### 3.4 Task-local stage manifest

The tracked F0.1 harness exclusively owns this runtime evidence file:

```text
<system-temp>/geo-auth-f0-1-<run-id>/stage-manifest.json
```

The run directory is current-uid-owned mode `0700`; the manifest is a regular,
non-symlink file owned by the current uid with mode `0600`. It is created
exclusively and updated by atomic same-directory replace, or by an append-only
mechanism whose records are independently fsynced and validated. No other
process may write it. Its exact schema is versioned by the harness and contains
at least: `contractSha`, `candidateSha`, `runId`, `stage`, `childExit`,
`errorClass`, `resourceLabels`, `safeInspect`, `namespaceInspect`,
`containerPidInventory`, `tracerSummary`, `httpRowResults`, and
`evidenceFreezeState`. `resourceLabels` must identify the task-owned PostgreSQL
and web containers separately. `tracerSummary` must record the pinned tracer
identity/version, startup-before-main proof, followed-fork/thread coverage,
event-class counts for `socket`, `connect`, `sendto`, `sendmsg`, and `sendmmsg`,
lost-event count, exit status, and PID-tree reconciliation. It must also record
that namespace inspection, all three HTTP probes, and the PostgreSQL stop action
were spawned by the traced candidate supervisor; any syscall or child-coverage
gap is `HARNESS_PREFLIGHT_BLOCKED`.

The manifest’s pre-cleanup `errorClass` is provisional. Cleanup or evidence-
retention failure may only downgrade the final receipt to
`HARNESS_PREFLIGHT_BLOCKED`; it can never upgrade a result.

The manifest must not contain a secret, URL, port, password, connection string,
probe key, cookie, token, private key, or credential value. It is task-local
runtime evidence, not a candidate or product-repository file. Before cleanup,
the harness freezes, fsyncs, and validates the allowed runtime evidence. After
the exact task-resource cleanup attempt, the receipt records the redacted
frozen summary and actual final inventory. Only `0/0/0` can PASS; any residual
task container, volume, or network is `HARNESS_PREFLIGHT_BLOCKED`. Only after
that receipt is committed may the task-local manifest and run directory be
cleaned.

### 3.5 Non-negotiable invariants

- A client-provided session object or JWT claim is never sufficient proof that
  the password-change gate is cleared.
- For a protected API, the gate is an API error, never a redirect and never an
  HTML document.
- `/api/auth/*` remains an Auth.js public route-classification exception, but
  its individual handlers still enforce their own authentication and CSRF
  rules. Public classification does not mean anonymous password change.
- A password-change transaction must update the password hash and policy flag
  atomically from the application’s perspective, then refresh the session only
  after authoritative state is confirmed.
- Seed defaults never overwrite an existing password hash or policy flag.
- A test reconcile mode can change only `mustChangePassword`, only for an
  explicitly scoped isolated test receipt, and fails before any write outside
  that scope.
- No Prisma migration is part of V1.1; this inherits the V1 no-migration
  baseline.

## 4. Request classification and exact response matrix

The middleware must classify the URL before applying the password-change gate.
The API/page distinction is based on the request pathname (`/api/`) and must
not depend on a client-supplied `Accept` header. `Accept` may be used only as a
defensive consistency check, never to turn an API response into HTML.

| Request | Auth state | Required status | Required headers/body | Final URL / notes |
|---|---|---:|---|---|
| Page, e.g. `GET /dashboard` | unauthenticated | 307 | `Location` is an equivalent relative URL or same-origin absolute URL resolving to `/login?callbackUrl=<same-origin pathname>`; redirect response | Browser may follow to `/login`; callback handling is separately scoped |
| Page, any non-exception route | authenticated, `mustChangePassword=true` | 307 | `Location` is an equivalent relative URL or same-origin absolute URL resolving to pathname `/change-password`; no API JSON requirement | Browser-followed final URL is `/change-password` |
| `GET /change-password` | authenticated, `mustChangePassword=true` | 200 | HTML page | Must not redirect to itself |
| `GET /change-password` | authenticated, `mustChangePassword=false` | 307 | `Location` is an equivalent relative URL or same-origin absolute URL resolving to pathname `/dashboard` | Normal users do not remain on first-login page |
| Protected API, any method, e.g. `/api/projects` | authenticated, `mustChangePassword=true` | **403** | `Content-Type` media type is `application/json` (optional parameters such as `charset` are allowed); no `Location`; `{data:null,error:{code:"MUST_CHANGE_PASSWORD",message:<localized stable message>}}` | No HTML body and no redirect following |
| Protected API, any method | unauthenticated | **401** | `Content-Type` media type is `application/json` (optional parameters such as `charset` are allowed); no `Location`; `{data:null,error:{code:"UNAUTHORIZED",message:<localized stable message>}}` | Must remain parseable JSON |
| Protected API, any method | authenticated but authoritative auth state unavailable | **503** | `Content-Type` media type is `application/json`; `Cache-Control: no-store`; no `Location`; `{data:null,error:{code:"AUTH_STATE_UNAVAILABLE",message:<stable generic message>}}` | Handler must not execute; never redirect or fall back to JWT-only |
| Page, any non-exception route | authenticated but authoritative auth state unavailable | **503** | `Cache-Control: no-store`; no redirect `Location`; error page/response appropriate to the page boundary | Must not disguise an unavailable state as login or password-page redirect |
| Protected API, authenticated and cleared | authenticated, `mustChangePassword=false` | handler-defined success/error | Existing API contract | Gate must not alter the handler’s result |
| `/api/auth/*` public-classification route | any | Auth.js handler-defined | Handler-defined JSON/redirect and CSRF semantics | Exempt from the global password gate; not exempt from route authentication |
| `/api/health*`, static assets, and declared public pages | any | existing route-defined | Existing route contract | No password gate |
| Password-change API (`/api/auth/first-login-change-password` or `/api/auth/change-password`) | no session | **401** | Standard JSON `UNAUTHORIZED`; no `Location` | Middleware exception lets the handler return its own auth error |
| Password-change API | valid session and valid transition | **200** | Standard success envelope plus a refreshed session cookie | No second login |
| Password-change API | conditional update/CAS loses a race | **409** | JSON media type; `AUTH_STATE_CHANGED`; no `Location`; no `Set-Cookie` | No user update and no success `AuditLog` |
| Password-change API | transaction-bound direct `AuditLog` insert fails | **503** | JSON media type; `AUTH_AUDIT_UNAVAILABLE`; `Cache-Control: no-store`; no `Location`; no `Set-Cookie` | Transaction rolls back the user update |
| Password-change API | DB commit succeeded but cookie refresh failed | **503** | `Content-Type` media type is `application/json`; `Cache-Control: no-store`; typed `SESSION_REFRESH_REQUIRED`; no `Location`; explicitly says password changed and new password can be used to log in | Must not call this a password-change failure or roll back the password |

For a page redirect, `Location` may be an equivalent relative URL or a same-
origin absolute URL. Parse it against the request URL, require the same origin,
and assert that the parsed pathname is exactly the target (`/login`,
`/change-password`, or `/dashboard` as applicable). The final browser URL after
following the first-login redirect must be `/change-password` (ignoring a
trailing slash only if the application’s canonical URL policy requires it).
For a protected API, `Location` must be absent even when the caller sends
`Accept: text/html`.

The API gate applies to all protected methods (`GET`, `POST`, `PUT`, `PATCH`,
`DELETE`, and equivalent route handlers). It must run before a business handler
can perform a write. The two password-change endpoints are explicit auth-route
exceptions and must perform their own session/state checks.

## 5. JSON error and client parsing contract

The server must use the existing response adapter rather than inventing a
second shape:

```json
{
  "data": null,
  "error": {
    "code": "MUST_CHANGE_PASSWORD",
    "message": "请先修改初始密码"
  }
}
```

The exact localized message may be translated later; the machine-readable code
and HTTP status are stable contract fields. `details` is optional and must not
contain password values, hashes, cookies, JWTs, or secret references.

Only these three surfaces are in scope for this defensive parser in V1.1:
`src/app/change-password/page.tsx`, the auth E2E helper, and the contract
login/session probe. A whole-site fetch wrapper is a separate task and is not
part of A1-A16.

Each of those three surfaces must use this defensive sequence:

1. Inspect `response.status`, `response.headers.get("content-type")`, and the
   response URL before parsing the body.
2. For a 401/403 API response, parse the `Content-Type` media type and require
   `application/json`; parameters such as `charset` are allowed. Reject an
   HTML body as a protocol violation with a bounded generic client error.
3. Parse JSON only after the media-type check; require the envelope shape and
   `error.code` for an error response.
4. With a manual redirect policy in API probes, assert a 403 has no `Location`.
   For a page redirect, accept only a relative or same-origin absolute
   `Location`, parse it against the request URL, and assert its pathname is the
   exact target. With normal browser navigation, assert the page 307’s final
   URL and do not treat the redirected HTML document as an API payload.
5. Never retry a `MUST_CHANGE_PASSWORD` response as if it were a transient
   provider or network error. Route the user to the password-change UI only in
   a page/UI context.

The change-password page must not call `res.json()` blindly. It must handle a
non-JSON response as a transport/protocol error and keep the password form
usable without leaking response HTML into an error message. The E2E helper and
contract login/session probe must apply the same media-type and final-URL
checks. No other site-wide client is claimed covered by V1.1.

## 6. Authoritative state and session/JWT refresh

### 6.1 State source

The authenticated identity may be established from the server-decoded Auth.js
JWT, but `mustChangePassword` is an authorization policy state whose
authoritative value is the active `User` row. A token claim is a cache/hint,
not a client-controlled bypass.

The middleware and password-change handlers must therefore use a single
`AuthStatePort` policy:

- decode identity server-side;
- read the current active user state by that identity;
- deny a missing/inactive user as unauthenticated;
- apply the current `mustChangePassword` value to the request class;
- never allow a stale `false` JWT claim to bypass a current database `true`;
- never force a user to re-login merely because the flag was cleared in the
  same successful transaction.

If a short-lived cache is introduced later, its TTL and invalidation must be a
separate contract. V1.1 defaults to a direct authoritative read at the gate.

If the authoritative read fails, the result is not “unauthenticated” and is
not allowed to use the JWT hint. The API boundary returns HTTP 503 with error
code `AUTH_STATE_UNAVAILABLE`, `Content-Type` media type `application/json`,
`Cache-Control: no-store`, and no `Location`; the protected handler is not
called. The page boundary returns HTTP 503 with `Cache-Control: no-store` and
does not disguise the failure as either a login redirect or a
`/change-password` redirect. An unavailable `AuthStatePort` is therefore a
fail-closed service condition, not a permission decision.

### 6.2 Successful password-change transaction

Both password-change routes must have the following observable sequence:

1. Authenticate the session and obtain the server identity.
2. Re-read the user state from `AuthStatePort`; for first-login, require the
   authoritative `mustChangePassword=true`, not merely the JWT claim.
3. Validate the requested password and current password where the route
   requires it.
4. Enter one Prisma transaction. Perform the route-specific conditional user
   update from §6.4, require exactly one updated row, and directly insert the
   `AuditLog` row described in §6.3 in that same transaction.
5. Commit only when both the conditional user update and direct `AuditLog`
   insert succeed, then re-read or otherwise verify the committed server state
   is `false`.
6. Use the locked server-only Auth.js v5 beta `unstable_update` mechanism to
   issue a fresh Auth.js/JWT session cookie in the same response. Its `jwt`
   callback `trigger="update"` must re-read the authoritative user row and
   ignore client-supplied `role` or `mustChangePassword` fields. The refreshed
   token must carry the current user identity, role, and
   `mustChangePassword=false`; its expiry is calculated from the existing
   24-hour session policy.
7. Return HTTP 200 using the standard success envelope, for example
   `{data:{ok:true,sessionRefreshed:true},error:null}`. The response must not
   expose the hash, token, cookie value, or credential reference.

The client must not call sign-in a second time. After the response, an
immediate `GET /api/auth/session` with the same cookie must expose
`mustChangePassword=false`; a subsequent protected API request must pass the
gate. If session-cookie issuance fails, the operation must fail closed and
return a typed `SESSION_REFRESH_REQUIRED` response (HTTP 503, JSON media type,
`Cache-Control: no-store`, no `Location`). The response must say that the
password has already changed, that the new password can be used to log in, and
that session refresh/reconciliation is pending. It must not call the password
change a failure, must not roll back the committed password, and must not ask
the client to overwrite the state with a browser-side session update.

`unstable_update` is server-only and the session-refresh lease must add
route-level tests that inspect `Set-Cookie` presence and cookie attributes
without recording the cookie value. If this Auth.js beta mechanism is not
available or cannot be made to emit a route-level `Set-Cookie`, stop L2 and
escalate a contract revision. Do not downgrade to
`useSession().update({mustChangePassword:false})` or any other client-trusted
fallback. Only server-confirmed fields from the committed user state may be
written.

### 6.3 Atomic AuditLog and reconciliation outcomes

Both password routes must use the Prisma transaction client to insert
`AuditLog` directly in the same transaction as the conditional `User` update.
They must not call the current best-effort `audit()` helper, because that helper
swallows write failures. L2 does not modify or expand ownership of
`src/lib/audit/logger.ts`.

The transaction inserts one `USER_PASSWORD_CHANGED` row with a non-secret
operation identity and metadata outcome
`PASSWORD_COMMITTED_SESSION_PENDING`. The row identifies first-login versus
ordinary change, but never stores a password, hash, JWT, cookie, or credential
value.

- If the direct `AuditLog` insert fails, the Prisma transaction rolls back the
  conditional user update and returns HTTP 503 typed
  `AUTH_AUDIT_UNAVAILABLE`, JSON media type, `Cache-Control: no-store`, no
  `Location`, and no `Set-Cookie`. No password or success audit is committed.
- After the transaction commits, the durable pending audit row is the source of
  reconciliation truth. A successful cookie refresh performs a defined,
  best-effort direct update of that same row to a completed outcome. If the
  completion update fails, the original pending row remains persisted and
  traceable; it is never deleted, overwritten as complete, or hidden.
- If cookie refresh fails, preserve the password and pending row and return
  `SESSION_REFRESH_REQUIRED`. A later idempotent reconciliation may update the
  same row; it must not create another password hash or reset the policy state.
- A client must not treat a post-commit pending outcome as a safe
  password-change retry or submit an old password to overwrite the new one.

### 6.4 Concurrent and stale sessions

- First-login is a TOCTOU-sensitive transition. The write must use a conditional
  update or transaction row lock whose predicate is `id=<server identity>` and
  `mustChangePassword=true`. Exactly one concurrent request may update the
  row. A competing request that observes the flag already cleared returns HTTP
  409 with JSON code `AUTH_STATE_CHANGED`, no password overwrite, and no
  `Set-Cookie`.
- Ordinary change-password is also a compare-and-swap transition. After the
  current password is verified, its transaction update predicate must include
  `id=<server identity>` and the exact previously read `passwordHash` (or an
  equivalent row-lock/CAS proof). Exactly one concurrent request may succeed.
  A losing request returns HTTP 409 with JSON code `AUTH_STATE_CHANGED`, no
  user update, no success `AuditLog`, and no `Set-Cookie`.
- Two concurrent first-login changes must not produce a state where a successful
  response reports a refreshed session but the authoritative user remains
  `mustChangePassword=true`.
- A stale old JWT is handled by the authoritative gate and cannot grant access
  contrary to the current user row.
- V1.1 does not add a session table, token-revocation table, or password-version
  column. If incident response later requires immediate revocation of all
  sessions, that is a separately approved auth/security change.

## 7. Seed idempotency and safety contract

### 7.1 Default mode: create-only/idempotent

The default seed mode is safe to re-run against a non-empty database:

- existing admin/member rows retain `passwordHash`, `mustChangePassword`,
  `role`, `email`, and all user-owned timestamps;
- no existing password hash is recomputed merely because the seed input changed;
- no existing policy flag is silently changed by
  `SEED_REQUIRE_PASSWORD_CHANGE`;
- existing project and fixture records retain the existing seed guarantees;
- a new row receives the explicit fixture password hash and requested initial
  `mustChangePassword` value exactly once.

The implementation must keep the user upsert’s default update set empty for
these protected fields, or use an equivalent allowlist that is contract-tested.
It must never log a password or generated hash.

### 7.2 Fresh isolated database determinism

The isolated auth E2E fixture must use a fresh database/volume and explicit
admin and member fixture inputs. It must not depend on the current random
member-password fallback. Re-running the fixture with the same inputs must
produce the same authentication policy state and must not create duplicate
users. By default this auth E2E starts only isolated PostgreSQL and the web
runtime. It must not start Redis, a worker, scheduler, or brand monitor. If the
current auth implementation proves that Redis is genuinely required, stop this
lease and open a separate dependency contract/lease rather than silently
expanding the fixture.

### 7.3 Explicit reconcile mode

The complete explicit reconcile input is:

| Variable | Allowed value/format | Meaning |
|---|---|---|
| `SEED_MODE` | `default` (omitted/default) or `test-reconcile-must-change` | Selects create-only or the narrowly scoped test reconcile path |
| `SEED_RECONCILE_TARGETS` | JSON array of one or more unique exact User IDs, each matching `^c[a-z0-9]{24}$` | Bounded target set; no email, wildcard, query, or “all users” form |
| `SEED_RECONCILE_DESIRED` | literal `true` or `false` | The only field value reconcile may change |
| `SEED_RECONCILE_HARNESS_ID` | `geo-auth-e2e:<run-id>`, where `<run-id>` matches `^[a-z0-9]{8,32}$` | Exact identity of the current isolated auth harness run |
| `SEED_RECONCILE_RECEIPT_ID` | `<SEED_RECONCILE_HARNESS_ID>:receipt:<nonce>`, where `<nonce>` matches `^[A-Za-z0-9][A-Za-z0-9._-]{7,63}$` | Pre-issued non-secret receipt bound to the same run ID |
| `SEED_RECONCILE_DB_NAME` | `geo_auth_e2e_<run-id>` using the exact run ID from `SEED_RECONCILE_HARNESS_ID` | Exact isolated PostgreSQL database identity created by this harness run |
| `SEED_RECONCILE_SCOPE` | `isolated-postgres-e2e` | Explicit scope enum; no production/staging value is accepted |
| `SEED_RECONCILE_CREATION_RECEIPT_PATH` | Absolute path `<system-temp>/geo-auth-e2e-<run-id>/creation-receipt.json` inside the current L5 run’s dedicated temporary directory | Read-only proof that L5 created this isolated PostgreSQL fixture for this exact run |

The final creation receipt is an exact JSON object with
`additionalProperties: false` and these string fields only:

```json
{
  "receiptId": "<SEED_RECONCILE_RECEIPT_ID>",
  "harnessId": "<SEED_RECONCILE_HARNESS_ID>",
  "databaseName": "<SEED_RECONCILE_DB_NAME>",
  "scope": "isolated-postgres-e2e",
  "createdAt": "<RFC3339 UTC timestamp>",
  "expiresAt": "<RFC3339 UTC timestamp>"
}
```

Both timestamps must use exact UTC millisecond form
`YYYY-MM-DDTHH:mm:ss.sssZ`. At validation time, `createdAt` must be no later
than `now + 30 seconds` and no earlier than `now - 5 minutes`; `expiresAt` must
be later than both `createdAt` and `now`; and the interval from `createdAt` to
`expiresAt` must be at most 15 minutes. The object must not contain a database
URL, hostname, port, username, password, token, cookie, credential reference,
or any other field.

At runtime, only the L5 auth E2E fixture may generate this receipt. It creates
the run directory as current-uid-owned mode `0700`, writes a same-directory
temporary regular file using exclusive create and mode `0600`, completes and
syncs the JSON, and atomically publishes the final path with no-replace
semantics. It never overwrites an existing final path. L3 seed code is a
read-only consumer: it must not create, rewrite, rename, chmod, or delete the
runtime receipt.

The preflight order is mandatory. After L5 has atomically published the
antecedent creation receipt, L3 performs every check below before its first
database or result-receipt write:

1. Parse `SEED_MODE`; reject an unknown value. In `default` mode, reject any
   reconcile variable rather than silently ignoring it.
2. For `test-reconcile-must-change`, validate the exact target JSON, desired
   boolean, harness ID, receipt ID, database name, scope enum, and creation-
   receipt path without opening a write transaction. The run ID must match
   exactly across harness ID, receipt ID, database name, and path.
3. Require `NODE_ENV=test` and an absolute receipt path. Use `lstat`/equivalent
   without following the final component and require the final receipt to be a
   non-symlink regular file owned by the current uid with exact mode `0600`.
   Require its dedicated parent directory to be current-uid-owned mode `0700`.
   Reject a relative path, symlink at the final component, non-regular object,
   wrong owner, wrong mode, or path outside the exact current-run directory.
4. Parse the exact JSON schema and timestamps above. Require internal
   `receiptId` to equal `SEED_RECONCILE_RECEIPT_ID` exactly, and require
   `harnessId`, `databaseName`, and `scope` to equal their corresponding
   environment values exactly. Require the receipt to be unexpired under the
   stated `now` checks. No implicit isolation signal is accepted.
5. Parse the configured PostgreSQL host without logging the connection URL,
   resolve it, and require every resolved address to be loopback (`127.0.0.0/8`
   or `::1`). Then use a read-only connection check to require PostgreSQL
   `current_database()` to equal `SEED_RECONCILE_DB_NAME` exactly.
6. Read exactly the target rows and compute the redacted reconciliation plan
   and base-state hash in memory. Missing, duplicate, inactive, or unexpected
   targets fail closed. The creation receipt remains unchanged.
7. Only after steps 1-6 pass, conditionally update **only**
   `mustChangePassword` for the exact target IDs and write the redacted result
   receipt. No password hash or unrelated field is touched.

Production, staging, a non-test `NODE_ENV`, a mismatched database identity, a
missing harness ID/creation receipt, receipt run-ID mismatch, non-loopback
resolved host, relative/symlink/non-regular/wrong-owner/wrong-mode receipt,
expired receipt, field mismatch, malformed targets, or any ambiguous state must
fail before L3 seed performs its first database or result-receipt write. The
antecedent creation receipt is produced only by L5 and remains read-only to L3.
Reconcile mode must never silently mutate production data. The default path
keeps both user upserts as `update: {}` and never changes an existing
`passwordHash` or `mustChangePassword`.

## 8. Persistence, migration, and rollback

### 8.1 No Prisma migration

V1.1 and every F0/F0.1 probe reuse the existing `User` fields and initial
migration. The contract and probe change neither schema nor migration history.
Acceptance must prove both paths remain unchanged. No `prisma migrate dev`,
`migrate resolve`, `db push`, or schema edit is permitted under this contract.

### 8.2 Ordered rollout

Implementation is staged so that each step is independently revertible but no
intermediate step is independently activatable:

0. L0 produced `HARNESS_PREFLIGHT_BLOCKED`, not a boundary result. Run F0.1 in
   its own disposable branch/worktree from the coordinator-approved V1.1
   contract commit. Materialize only the three exact `d8e...` probe blobs, add
   the two tracked harness/test files, and commit the complete candidate before
   preflight/runtime. F0.1 performs static/local fixture-bootstrap preflight
   first, then at most one fixed-boundary production runtime in the same
   web/isolated-PostgreSQL lifecycle. After cleanup it must create and commit
   the receipt. The receipt records exactly `PASS`, `BOUNDARY_FAIL`, or
   `HARNESS_PREFLIGHT_BLOCKED`; it never activates the candidate. A non-PASS
   outcome stops L1 and requires a later contract/lease decision; it does not
   authorize a fallback boundary.
1. After F0.1 PASS, add L1 route-policy/state tests and typed response seams,
   preserving the exact proven middleware boundary.
2. After L1, L2 and L3 may prepare in parallel: L2 adds conditional password
   transitions, direct transaction-bound AuditLog, and server-side session
   refresh; L3 adds seed guards and deterministic isolated fixtures.
3. Add L4 change-password client parsing after L2’s receipt exists.
4. Run L5 isolated PostgreSQL + web E2E only after L1-L4 exact SHAs are
   assembled.
5. Run L6 independent review and evidence capture. Only then may the
   coordinator decide whether a later release gate is warranted.

### 8.3 Failed-candidate evidence custody

A failed or passing F0.1 run **must** use evidence-only dual commits, in this
order:

1. a source/test/harness candidate commit made **before** preflight or runtime,
   identified by immutable SHA;
2. after runtime evidence is frozen and validated, exact resource cleanup is
   attempted, and the actual final inventory is known, a mandatory receipt
   commit that records only the permitted redacted evidence and binds it to the
   candidate SHA. Only an inventory of `0/0/0` is eligible for PASS.

The receipt file is not part of the candidate commit. A separately approved
empty/template receipt may be precommitted, but this contract does not require
or recommend it; the normal F0.1 flow creates the receipt only after run and
cleanup. The receipt text must reference the candidate SHA. Its own receipt
commit SHA cannot self-reference and must instead be reported after commit in
the handoff/custody message.

Neither commit may be merged, activated, or treated as release code. The prior
L0 evidence-only refs are preserved as
`d8e433d8b469ac459148e9ef5d201d54123dcf92` (candidate) and
`babbda85a3550ed53da301f64c41d00fef7fe76b` (receipt). They are custody
evidence for a `HARNESS_PREFLIGHT_BLOCKED` run, not a PASS or a product
baseline. F0.1 may read the three exact probe blobs from the candidate as
authority, but its branch starts from the approved V1.1 contract commit; the
historical candidate is not a parent. F0.1 must not amend, rewrite, reset,
delete, or mutate either historical ref, and it must not cherry-pick the
historical receipt.

### 8.4 Rollback

Rollback is a Git/runtime rollback to the last accepted commit for the auth
slice; it does not require a database rollback or destructive data action.
For a new F0.1 preflight/runtime failure, retain its evidence-only branch and
return the product baseline to
`a56039169644997efd2fefa5d09127da791f333b`; do not merge or activate the
probe candidate. Before activation, retain the exact base SHA and a clean
worktree. On a failed gate:

- `a56039169644997efd2fefa5d09127da791f333b` is the runtime/product rollback
  baseline;
- the separately approved V1.1 contract commit SHA is only the F0.1 contract
  and candidate-construction baseline;
- neither SHA may be substituted for the other in receipts, rollback, blob
  comparison, or branch construction.

- stop activation of the candidate;
- restore the previous application code through the normal branch/worktree
  process, without reset/stash/delete of another worker’s state;
- if the database commit succeeded before cookie refresh failed, treat the
  password as already changed: the old runtime is rolled back without trying to
  reverse the password, and the user may log in with the new password;
- do not describe the cookie-refresh outcome as a failed password change, do
  not instruct a blind retry, and do not overwrite the new password through
  seed;
- seed is not a password-recovery mechanism and cannot restore the prior hash
  or policy state;
- do not run reconcile mode to “repair” a production database;
- record whether any session cookie was issued and whether the old runtime can
  parse it. The refreshed token must remain backward-compatible with the
  existing JWT claims; otherwise activation is forbidden.

No automatic secret rotation or forced global logout is part of rollback. A
security incident requiring those actions needs a separate explicit approval.

### 8.5 Session expiry semantics

- Existing session lifetime remains 24 hours unless a later contract changes it.
- A successful password change issues a new session with a fresh expiry based on
  the same max-age; it is not a second login and does not extend unrelated
  sessions.
- The old JWT is not an authorization bypass because the gate reads the
  authoritative user state.
- Expired, malformed, or unverifiable sessions return the existing 401 JSON for
  APIs and the existing login redirect for pages.
- V1.1 adds no revocation storage. Forced revocation remains an explicit future
  security task.

## 9. Non-overlapping implementation leases

Each lease below must use its own task, branch, and worktree. A worker owns only
the listed files; every new test/fixture path is explicit. No lease may modify
the contract document after this handoff unless a new contract revision is
issued. An intermediate lease cannot be activated or released alone: the
dependency graph is `F0.1 PASS → L1 → (L2 ∥ L3)`, then `L2 → L4`,
`(L1 + L2 + L3 + L4) → L5`, and `L5 → L6`. Historical L0 is a disposable
`HARNESS_PREFLIGHT_BLOCKED` candidate and never activates. F0.1 and L1 preserve
the exact fixed boundary in §3.2; neither may choose another boundary. The
coordinator must hold each predecessor’s exact SHA and acceptance receipt
before dispatching or activating a successor.

| Lease | Exact files owned | Dependencies and required outcome |
|---|---|---|
| L0 auth-boundary feasibility (historical) | `src/middleware.ts`; `src/lib/auth/state-probe.ts`; `src/middleware-auth-state-probe.test.ts`; `docs/handoff/AUTH_BOUNDARY_FEASIBILITY_20260904.md` | Evidence-only historical branch. Its result is `HARNESS_PREFLIGHT_BLOCKED`, boundary feasibility `NOT_EVALUATED`; no retry or mutation under this lease. Candidate/receipt refs are §8.3. |
| F0.1 candidate: fixture-bootstrap feasibility | Writable candidate files only: `scripts/harness/auth-boundary-fixture-bootstrap.ts` (new; owns both in-container supervisor flows); `scripts/harness/auth-boundary-fixture-bootstrap.test.ts` (new, with in-file synthetic allowed/denied/lost-event trace fixtures). Read-only materialized blobs: `src/middleware.ts`; `src/lib/auth/state-probe.ts`; `src/middleware-auth-state-probe.test.ts`, each exactly equal to its blob at `d8e433d8b469ac459148e9ef5d201d54123dcf92`. | Branch from the approved V1.1 contract commit SHA, not from `d8e...`; do not cherry-pick the historical receipt. Before preflight, prove worktree, staged-index, and committed-HEAD blob equivalence for all three paths, then commit the two new tracked harness/test files with the materialized probe blobs as the immutable candidate. Preflight must prove the task-local manifest, exact two-container `--network none`/shared-loopback topology, pinned full-lifecycle fork/thread syscall tracing for `socket`/`connect`/`sendto`/`sendmsg`/`sendmmsg`, supervisor-owned namespace inspection/three HTTP probes/PG stop, PID-tree reconciliation, and synthetic trace adjudication before exactly one runtime lifecycle. No host Next, untraced `docker exec`, third fixture file, tracer/network fallback, activation, or merge. |
| F0.1 receipt | `docs/handoff/AUTH_BOUNDARY_F0_1_RECEIPT_20260904.md` (new, created only after run/evidence freeze/exact resource cleanup attempt) | Not part of the candidate commit and not writable during candidate/preflight/runtime stages. After cleanup, create the receipt, bind it to the candidate SHA, record the actual inventory, and make the mandatory second commit. Only exact `0/0/0` is PASS-eligible; any residual is `HARNESS_PREFLIGHT_BLOCKED`. Report the resulting receipt commit SHA only in handoff/custody. Only `PASS` permits L1. |
| L1 auth gate/state boundary | `src/middleware.ts`; `src/lib/auth/route-policy.ts` (new); `src/lib/auth/state.ts` (new); `src/lib/api/response.ts`; `src/middleware.test.ts` (new); `src/lib/auth/state.test.ts` (new); `src/lib/api/response.test.ts` | Requires F0.1 `PASS` exact-SHA receipt and preserves that boundary. Implements only the middleware gate/state contract, exact page/API matrix, public exceptions, 503/no-store/no handler, no API `Location`, and typed 401/403/503 envelopes. It cannot switch to route-handler fallback or expand ownership to protected route files. |
| L2 first-login/session transition | `src/lib/auth.ts`; `src/types/next-auth.d.ts`; `src/app/api/auth/first-login-change-password/route.ts`; `src/app/api/auth/change-password/route.ts`; `src/lib/auth/session-refresh.ts` (new); `src/lib/auth/session-refresh.test.ts` (new); `src/app/api/auth/first-login-change-password/route.test.ts` (new); `src/app/api/auth/change-password/route.test.ts` (new) | Depends on L1 receipt. Lock server-only `unstable_update`; JWT update re-reads DB and ignores client role/flag. Both routes use CAS/conditional update plus direct `AuditLog` insert in one Prisma transaction; they do not call best-effort `audit()`. Tests cover first-login and ordinary concurrent losers, atomic audit rollback, pending/completed reconciliation, and route-level `Set-Cookie`. Stop if `unstable_update` cannot satisfy the contract. |
| L3 seed policy | `src/prisma/seed.ts`; `src/prisma/seed-policy.ts` (new); `src/prisma/seed-policy.test.ts` (new); `tests/fixtures/auth-first-login/seed-fixture.ts` (new) | Depends on L1 and may proceed in parallel with L2. Owns the receipt parser/validator and test-only fixture builder. Its tests may create schema-valid or intentionally invalid receipt files only inside an L3 test-owned temporary directory; they never use or mutate an L5 runtime receipt. Negative tests prove missing path, relative path, symlink, non-regular file, wrong owner/mode where platform-testable, expired receipt, field/run mismatch, missing harness ID, non-loopback host, and DB-name mismatch each cause zero writes. |
| L4 change-password client | `src/app/change-password/page.tsx`; `src/lib/api/auth-first-login-client.ts` (new); `src/lib/api/auth-first-login-client.test.ts` (new) | Depends on L1 and L2 receipts. Defensive parsing is limited to this client: media type `application/json`, status/envelope, relative or same-origin absolute redirect resolution, final pathname, and typed refresh-required handling. No whole-site fetch wrapper. |
| L5 auth E2E/probes | `tests/e2e/auth-first-login-flow.test.ts` (new); `tests/e2e/helpers/auth-first-login.ts` (new); `tests/e2e/fixtures/auth-first-login.ts` (new) | Depends on L1-L4 exact SHAs. The L5 fixture is the sole runtime owner that creates, atomically publishes, expires, and cleans the run-specific creation receipt. Starts only isolated PostgreSQL + web by default; no Redis, worker, scheduler, brand monitor, real providers, or external actions. Covers all A1-A16 auth rows and the login/session probe. |
| L6 independent review/evidence | No production files; `docs/handoff/AUTH_FIRST_LOGIN_REVIEW_20260904.md` (new) only after coordinator permits evidence location | Depends on F0.1 PASS and all L1-L5 receipts. Review exact candidate SHA, audit/CAS behavior, diff, tests, rollback, and unrun commands; cannot repair implementation files. |

The coordinator must not assign overlapping files to L1-L5, and no lease may be
activated independently of its dependency receipts. L5 may request behavior
from L1-L4 but may not patch their source files to make its test pass. CASTR
has no lease in this contract. L3 and L5 share only the receipt schema/contract,
not a tracked file or runtime receipt: L3 owns parser validation and disposable
test-temp fixtures; L5 owns the real auth E2E receipt lifecycle.

## 10. Acceptance matrix

All rows are required before this contract can be considered implemented. A
passing unit test does not substitute for an isolated E2E row.

| ID | Acceptance | Evidence required |
|---|---|---|
| F0 | Auth-boundary feasibility | Outcome uses the mutually exclusive §3.2 priority. `PASS` requires every build/runtime/HTTP/evidence/cleanup/functional-egress gate. `BOUNDARY_FAIL` requires a trustworthy harness and conclusive production-build or actual-boundary assertion failure; later rows may be `NOT_RUN_AFTER_BOUNDARY_FAIL`. Any candidate/fixture/harness/infrastructure/evidence/cleanup/functional-egress failure, runtime harness interruption, or mixed failure without conclusive attribution is `HARNESS_PREFLIGHT_BLOCKED`. Only PASS permits L1; both non-PASS outcomes block it, and no outcome activates the candidate. |
| A1 | Unauthenticated protected API | 401, JSON content type, standard envelope, no `Location` |
| A2 | Must-change protected API | 403, `MUST_CHANGE_PASSWORD`, JSON content type, no `Location`, no HTML |
| A3 | Must-change page | 307 to `/change-password`; followed final URL is exact password page |
| A4 | Cleared user page | `/change-password` 307 to `/dashboard` |
| A5 | Public auth exceptions | CSRF/session/callback routes preserve Auth.js handler semantics; password-change handlers still reject no session with 401 |
| A6 | In-scope defensive parsers | Only the change-password client, auth E2E helper, and contract login/session probe reject HTML/non-JSON 401/403, validate the envelope, resolve redirects safely, and avoid blind `json()`; no whole-site wrapper claim |
| A7 | Atomic password transitions | Both first-login and ordinary routes use route-specific CAS/conditional update plus direct `AuditLog` insert in the same Prisma transaction; audit failure rolls back and returns `AUTH_AUDIT_UNAVAILABLE`; commit persists `PASSWORD_COMMITTED_SESSION_PENDING`, successful refresh updates it toward completed, and valid requests return 200 with refreshed cookie |
| A8 | No re-login | Immediate session read says `mustChangePassword=false`; next protected API request passes with the same cookie |
| A9 | Stale/trusted/concurrent state | JWT false cannot bypass DB true; stale JWT true clears after authoritative false plus refresh; state-read failure is 503/no-store; concurrent first-login and ordinary password changes allow exactly one winner and return 409 `AUTH_STATE_CHANGED` with no success audit/cookie for losers |
| A10 | Seed existing row | Re-running default seed preserves password hash and policy flag exactly |
| A11 | Seed fresh isolated DB | Explicit fixture inputs yield deterministic users and policy; repeat is idempotent |
| A12 | Seed reconcile guard | Exact variables, receipt path/file/owner/mode/JSON/time checks, harness/receipt/run binding, loopback host resolution, and `current_database()` match are enforced before L3’s first write; missing/relative path, symlink, non-regular file, wrong owner/mode where platform-testable, expiry, field mismatch, missing harness ID, non-loopback host, DB-name mismatch, out-of-scope, and production mode each prove zero writes |
| A13 | No schema migration | `src/prisma/schema.prisma` and `src/prisma/migrations/` are unchanged by `git diff --exit-code BASE -- <paths>`, covering committed, staged, and unstaged changes; F0.1’s fixed middleware boundary is unchanged and no fallback is introduced |
| A14 | Contract isolation | No CASTR files, database, UI, business orchestration, or cross-repo source imports changed |
| A15 | Offline safety | Auth E2E uses only isolated PostgreSQL and web; it allows required loopback PostgreSQL traffic but proves zero external egress and does not start Redis, worker, scheduler, brand monitor, real providers, publishing, paid actions, or production credentials |
| A16 | Rollback | Candidate can be rejected and previous runtime restored without destructive DB operation; evidence includes exact SHA and state |

## 11. Isolated E2E scenario

The test-only flow must be deterministic and bounded:

1. Start an isolated fresh PostgreSQL database and the web runtime only, with
   loopback-only bindings; do not start Redis, worker, scheduler, or brand
   monitor, and do not read or print `.env` values. If a test proves that auth
   requires Redis, stop and obtain a separate dependency lease before changing
   this fixture.
2. As the sole runtime creation owner, publish the L5 run’s creation receipt in
   its dedicated temporary directory using exclusive create, mode `0600`, and
   atomic no-replace completion. Export only its absolute final path and the
   matching non-secret reconcile identifiers to the seed process.
3. Seed explicit test users with `mustChangePassword=true` and record only a
   redacted receipt.
4. Request a protected page and assert 307 plus final
   `/change-password` URL.
5. Request a protected API with the same must-change session using manual
   redirects; assert 403 JSON, code `MUST_CHANGE_PASSWORD`, and no `Location`.
6. Call first-login password change; assert 200, standard envelope, and a
   refreshed session cookie without a second sign-in.
7. Fetch `/api/auth/session` and one protected API using the same cookie; assert
   `mustChangePassword=false` and normal API behavior.
8. Repeat the default seed and assert the changed password hash and cleared
   policy are not silently overwritten.
9. Exercise explicit reconcile only in the test scope and assert that an
   out-of-scope/production-shaped invocation fails before any write.
10. Expire/close the receipt lifecycle, then clean only the L5-owned receipt
    directory and PostgreSQL/web resources; record process/volume/resource-zero
    evidence without logging receipt contents beyond non-secret identifiers.

The E2E must not start brand monitoring, real search, LLM, CMS, distribution,
publishing, or paid/external actions. A mock LLM switch alone is not evidence
of offline execution; the test profile must deny those capabilities and enforce
zero external egress. Loopback traffic between the web process and its isolated
PostgreSQL fixture is allowed and must not be misreported as external egress.

## 12. Evidence and release gates

Each implementation handoff must include:

- the F0/F0.1 outcome taxonomy, its pre-run immutable candidate SHA, and its
  unactivated probe branch/worktree SHA; L1 requires F0.1 `PASS` only;
- repository and worktree path;
- branch and full HEAD SHA;
- `git status --short --branch`, worktree/stash state, and active writer list;
- exact commands and exit status, with environment versions and timestamp;
- acceptance IDs covered and raw-result summaries;
- `git diff --exit-code BASE -- src/prisma/schema.prisma src/prisma/migrations/`
  result covering committed, staged, and unstaged state;
- transaction evidence for conditional user update plus direct `AuditLog`
  insert, including atomic audit rollback and persistent pending reconciliation;
- creation-receipt lifecycle evidence: L5 exclusive/atomic generation and
  cleanup, plus L3 read-only validation and zero-write negative cases;
- isolated resource and external-side-effect result;
- remaining risks, rollback point, and unrun commands.

### 12.1 F0.1 retained-evidence whitelist

Before resource cleanup, F0.1 must freeze, fsync, and validate the following
**and only redacted forms of command/output evidence that make these fields
auditable** in the task-local stage manifest:

- stage name/order, each child-process exit result, and the final error
  classification;
- exact sanitized command text (command structure and redaction marker, never
  substituted secret values);
- approved contract SHA and immutable candidate SHA;
- exact task resource identity (task-scoped container, volume, and network
  names/labels), plus a summarized network/container inspect result;
- HTTP status, selected safe headers, and body-schema result for each required
  row; for failure rows this must show JSON media type, no `Location`, and
  `Cache-Control: no-store`;

The sequence is mandatory:

1. freeze, fsync, and schema/whitelist-validate the runtime evidence;
2. clean only the exact task-labeled resources;
3. create the receipt and append the actual final container/volume/network
   inventory; require `0/0/0` for PASS and classify any residual as
   `HARNESS_PREFLIGHT_BLOCKED`;
4. commit that receipt as the mandatory second commit;
5. report the receipt commit SHA in handoff/custody, then clean the task-local
   manifest/run directory.

Cleanup evidence is necessarily appended after resource cleanup; it is not a
field that must already exist in the pre-cleanup evidence freeze.

The whitelist must never retain a runtime URL, port, password, connection
string, probe key, cookie, token, private key, secret, or credential value. If
the harness cannot retain the required whitelist before cleanup, the result is
`HARNESS_PREFLIGHT_BLOCKED`; it must not reconstruct missing facts after the
run or label the boundary infeasible.

Network configuration inspection can prove only that a requested setting is
present. Functional zero-external-egress is a hard F0 `PASS` gate. F0.1 must
use exactly two task-owned containers and no host Next process:

- PostgreSQL starts with `--network none`;
- the web container starts with `--network container:<pg-container>` and thus
  shares PostgreSQL's loopback-only network namespace;
- a task-owned harness supervisor keeps the PostgreSQL container and shared
  namespace alive while its traced PostgreSQL child is deliberately stopped
  for the unavailable row; stopping PostgreSQL must not replace the namespace
  or start a third container;
- the candidate's tracked supervisors generate and execute namespace
  inspection, the available/locked-or-slow/unavailable HTTP probes, and the
  PostgreSQL stop action as children in their already traced process trees;
  `docker exec` is not used for those actions;
- every HTTP probe uses only loopback in the shared namespace; no
  host-published port or Docker default/custom bridge is used;
- supervisor-captured inspect evidence plus namespace-local interface and route
  inspection must show only `lo` and no external route.

Before either container's main process starts, both process trees must be
covered by a task-owned, pinned `strace -ff` or equivalent syscall tracer that
follows forks and threads from before the supervisors spawn their first child
until after every child and container main process stops. It must observe
`socket`, `connect`, `sendto`, `sendmsg`, and `sendmmsg`, covering DNS over
UDP/TCP and short-lived connections. Namespace inspection, all three HTTP
probes, and the PostgreSQL stop action must therefore be traced from their own
spawn, not attached after start. The harness reconciles tracer PIDs against
cgroup/container PID inventories, requires zero untraced children, zero lost
events, and tracer exit status 0. Only `AF_UNIX` and the explicitly classified
loopback HTTP/PostgreSQL tuples are allowed. Any non-loopback or DNS connection
attempt, syscall/child coverage gap, untraced child, lost event, tracer failure,
or inability to deploy the pinned tracer is `HARNESS_PREFLIGHT_BLOCKED`; no
alternate network, `docker exec` escape hatch, or sentinel may be used.

This is syscall capture rather than periodic polling, so short-lived
connections cannot fall between samples. The harness must not actively contact
a public IP, public hostname, or external URL to test isolation. Trace evidence
retains only redacted syscall classes, allowed/denied classifications, counts,
PID-coverage results, and exit/lost-event status; it never retains a port, URL,
address, credential, or payload. The tracked harness test must include
synthetic allowed, denied, and lost-event trace fixtures inside
`scripts/harness/auth-boundary-fixture-bootstrap.test.ts`; no third fixture
file is leased.

Inspect-only evidence is `HARNESS_PREFLIGHT_BLOCKED`, not a partial PASS. This
F0 gate proves only the probe lifecycle; A15 separately proves the complete
auth E2E lifecycle.

`Promise.race` timing alone does not cancel an in-flight Prisma query. Any
future L1 design/acceptance gate must separately specify and verify finite
safe-integer timeout validation, PostgreSQL statement timeout, connection
recovery, and backpressure/load behavior. F0.1 cannot claim those properties
from a response timeout alone.

This contract does not authorize merge, G1/G2, release, production, external
provider use, or real publishing. The coordinator and user retain those gates.

## 13. Security and privacy constraints

- Never record passwords, password hashes, JWTs, cookies, API keys, tokens,
  private keys, complete `.env` files, or credential values in code, logs,
  evidence, or the Obsidian archive.
- Receipts may contain a redacted user identifier, target scope, policy value,
  base-state hash, and task identity only.
- Error messages must not reveal whether a supplied password is correct beyond
  the existing route contract, and must not echo request bodies.
- All unknown policy states fail closed. No API fallback may render a login or
  password page as an API success payload.

## 14. Planned commands (all PLANNED / NOT RUN)

The following are the intended implementation/acceptance commands. They are
recorded for reproducibility, but have not been run by this contract writer:

```text
PLANNED / NOT RUN: git status --short --branch
PLANNED / NOT RUN: git worktree list
PLANNED / NOT RUN: test "$(git rev-parse <APPROVED_V1_1_CONTRACT_SHA>^{commit})" = "<APPROVED_V1_1_CONTRACT_SHA>"
PLANNED / NOT RUN: git worktree add -b codex/geo-auth-f0-1-<run-id> <F0_1_WORKTREE> <APPROVED_V1_1_CONTRACT_SHA>
PLANNED / NOT RUN: git restore --source=d8e433d8b469ac459148e9ef5d201d54123dcf92 -- src/middleware.ts src/lib/auth/state-probe.ts src/middleware-auth-state-probe.test.ts
PLANNED / NOT RUN: test ! -e docs/handoff/AUTH_BOUNDARY_FEASIBILITY_20260904.md # never materialize/cherry-pick the babbda85a3550ed53da301f64c41d00fef7fe76b receipt
PLANNED / NOT RUN: test "$(git rev-parse d8e433d8b469ac459148e9ef5d201d54123dcf92:src/middleware.ts)" = "$(git hash-object src/middleware.ts)"
PLANNED / NOT RUN: test "$(git rev-parse d8e433d8b469ac459148e9ef5d201d54123dcf92:src/lib/auth/state-probe.ts)" = "$(git hash-object src/lib/auth/state-probe.ts)"
PLANNED / NOT RUN: test "$(git rev-parse d8e433d8b469ac459148e9ef5d201d54123dcf92:src/middleware-auth-state-probe.test.ts)" = "$(git hash-object src/middleware-auth-state-probe.test.ts)"
PLANNED / NOT RUN: git add -- src/middleware.ts src/lib/auth/state-probe.ts src/middleware-auth-state-probe.test.ts scripts/harness/auth-boundary-fixture-bootstrap.ts scripts/harness/auth-boundary-fixture-bootstrap.test.ts
PLANNED / NOT RUN: git diff --cached --exit-code d8e433d8b469ac459148e9ef5d201d54123dcf92 -- src/middleware.ts src/lib/auth/state-probe.ts src/middleware-auth-state-probe.test.ts
PLANNED / NOT RUN: test "$(git rev-parse :src/middleware.ts)" = "$(git rev-parse d8e433d8b469ac459148e9ef5d201d54123dcf92:src/middleware.ts)"
PLANNED / NOT RUN: test "$(git rev-parse :src/lib/auth/state-probe.ts)" = "$(git rev-parse d8e433d8b469ac459148e9ef5d201d54123dcf92:src/lib/auth/state-probe.ts)"
PLANNED / NOT RUN: test "$(git rev-parse :src/middleware-auth-state-probe.test.ts)" = "$(git rev-parse d8e433d8b469ac459148e9ef5d201d54123dcf92:src/middleware-auth-state-probe.test.ts)"
PLANNED / NOT RUN: test "$(git diff --cached --name-only | LC_ALL=C sort)" = "$(printf '%s\n' scripts/harness/auth-boundary-fixture-bootstrap.test.ts scripts/harness/auth-boundary-fixture-bootstrap.ts src/lib/auth/state-probe.ts src/middleware-auth-state-probe.test.ts src/middleware.ts | LC_ALL=C sort)"
PLANNED / NOT RUN: git commit -m "test(auth): add immutable F0.1 boundary harness candidate"
PLANNED / NOT RUN: test "$(git rev-parse HEAD:src/middleware.ts)" = "$(git rev-parse d8e433d8b469ac459148e9ef5d201d54123dcf92:src/middleware.ts)"
PLANNED / NOT RUN: test "$(git rev-parse HEAD:src/lib/auth/state-probe.ts)" = "$(git rev-parse d8e433d8b469ac459148e9ef5d201d54123dcf92:src/lib/auth/state-probe.ts)"
PLANNED / NOT RUN: test "$(git rev-parse HEAD:src/middleware-auth-state-probe.test.ts)" = "$(git rev-parse d8e433d8b469ac459148e9ef5d201d54123dcf92:src/middleware-auth-state-probe.test.ts)"
PLANNED / NOT RUN: F0_1_CANDIDATE_SHA="$(git rev-parse HEAD)"; test -n "$F0_1_CANDIDATE_SHA"; test -z "$(git status --porcelain)"
PLANNED / NOT RUN: pnpm install --frozen-lockfile
PLANNED / NOT RUN: pnpm prisma:generate
PLANNED / NOT RUN: pnpm exec prisma validate --schema=src/prisma/schema.prisma
PLANNED / NOT RUN: git diff --exit-code a56039169644997efd2fefa5d09127da791f333b -- src/prisma/schema.prisma src/prisma/migrations/
PLANNED / NOT RUN: pnpm typecheck
PLANNED / NOT RUN: pnpm lint
PLANNED / NOT RUN: pnpm test
PLANNED / NOT RUN: pnpm exec vitest run src/middleware-auth-state-probe.test.ts
PLANNED / NOT RUN: git diff --check && git status --short --branch && git rev-parse HEAD
PLANNED / NOT RUN: verify F0.1 tracked candidate SHA is committed before any preflight/runtime command
PLANNED / NOT RUN: pnpm exec vitest run scripts/harness/auth-boundary-fixture-bootstrap.test.ts
PLANNED / NOT RUN: exclusive-create <system-temp>/geo-auth-f0-1-<run-id>/stage-manifest.json at mode 0600 under current-uid-owned mode-0700 run directory; validate contractSha/candidateSha/runId and schema
PLANNED / NOT RUN: static/local F0.1 fixture-bootstrap preflight with stage-manifest atomic-update/fsync/redacted evidence-retention plus synthetic allowed/denied/lost-event syscall-trace fixtures
PLANNED / NOT RUN: test -x <PINNED_TRACER_OR_EQUIVALENT> && <PINNED_TRACER_OR_EQUIVALENT> --version # absence/incompatibility is HARNESS_PREFLIGHT_BLOCKED; no fallback
PLANNED / NOT RUN: docker run --name <F0_1_PG_CONTAINER> --label <TASK_LABEL> --network none <PINNED_PG_IMAGE> <PINNED_TRACER_WRAPPER> -ff -e trace=socket,connect,sendto,sendmsg,sendmmsg -- <CANDIDATE_PG_SUPERVISOR>
PLANNED / NOT RUN: docker run --name <F0_1_WEB_CONTAINER> --label <TASK_LABEL> --network container:<F0_1_PG_CONTAINER> <PINNED_WEB_IMAGE> <PINNED_TRACER_WRAPPER> -ff -e trace=socket,connect,sendto,sendmsg,sendmmsg -- <CANDIDATE_WEB_SUPERVISOR>
PLANNED / NOT RUN: docker inspect <F0_1_PG_CONTAINER> <F0_1_WEB_CONTAINER> # require PG NetworkMode=none and web NetworkMode=container:<pg>, with exact task labels
PLANNED / NOT RUN: <CANDIDATE_WEB_SUPERVISOR> spawns namespace inspection and all three loopback HTTP probes inside its traced tree; require only lo/no external route and no host Next/published port
PLANNED / NOT RUN: <CANDIDATE_PG_SUPERVISOR> stops only its traced PostgreSQL child for the unavailable row while both containers and the shared namespace remain alive
PLANNED / NOT RUN: one and only one production web + task-isolated PostgreSQL lifecycle for available, locked/slow timeout, and unavailable HTTP rows, with both syscall tracers active before main-process start through after stop
PLANNED / NOT RUN: reconcile tracer PID coverage with both cgroup/container PID inventories; require socket/connect/sendto/sendmsg/sendmmsg coverage, zero untraced child, zero syscall/child coverage gap, zero lost event, tracer exit 0, and only AF_UNIX/approved loopback HTTP+PG classifications
PLANNED / NOT RUN: freeze, fsync, and whitelist/schema-validate §12.1 runtime evidence before resource cleanup
PLANNED / NOT RUN: clean only exact task-labeled resources, record the actual container/volume/network inventory, and require 0/0/0 for PASS
PLANNED / NOT RUN: create docs/handoff/AUTH_BOUNDARY_F0_1_RECEIPT_20260904.md after cleanup and bind its redacted evidence plus actual inventory to "$F0_1_CANDIDATE_SHA"
PLANNED / NOT RUN: git add -- docs/handoff/AUTH_BOUNDARY_F0_1_RECEIPT_20260904.md && test "$(git diff --cached --name-only)" = "docs/handoff/AUTH_BOUNDARY_F0_1_RECEIPT_20260904.md"
PLANNED / NOT RUN: git commit -m "docs(auth): record F0.1 boundary feasibility receipt"
PLANNED / NOT RUN: F0_1_RECEIPT_SHA="$(git rev-parse HEAD)"; test "$F0_1_RECEIPT_SHA" != "$F0_1_CANDIDATE_SHA" # report receipt SHA only in handoff/custody, then remove only task-local manifest/run directory
PLANNED / NOT RUN: pnpm exec vitest run src/middleware.test.ts src/lib/auth/state.test.ts src/lib/api/response.test.ts src/lib/auth/session-refresh.test.ts src/app/api/auth/first-login-change-password/route.test.ts src/app/api/auth/change-password/route.test.ts src/prisma/seed-policy.test.ts src/lib/api/auth-first-login-client.test.ts
PLANNED / NOT RUN: pnpm exec vitest run tests/e2e/auth-first-login-flow.test.ts
PLANNED / NOT RUN: pnpm build
PLANNED / NOT RUN: isolated PostgreSQL + production web runtime smoke proving only the fixed Next 15 Node.js middleware → Prisma AuthStatePort/probe → task-isolated PostgreSQL boundary
PLANNED / NOT RUN: static scan for secrets and forbidden cross-project imports
PLANNED / NOT RUN: isolated API/page probes with redirect manual mode, application/json media-type parsing, same-origin Location resolution, and final-path assertions
PLANNED / NOT RUN: fresh isolated database seed → password change → session refresh → repeat-seed test
PLANNED / NOT RUN: explicit reconcile guard negative tests, including production-shaped invocation
PLANNED / NOT RUN: creation receipt negative tests for missing/relative path, symlink, non-regular file, owner/mode where platform-testable, expiry, field/run mismatch, non-loopback host, and current_database mismatch, each asserting zero writes
PLANNED / NOT RUN: auth E2E with only isolated PostgreSQL + web, denied external capabilities, and zero-external-egress enforcement while allowing loopback PostgreSQL traffic
```

No command in this list is a release approval. The implementation workers must
replace each planned item with exact executed evidence in their own handoff.
This V1.1 document does not itself authorize, schedule, or automatically rerun
F0/F0.1.

## 15. Open item: callbackUrl same-origin safety

The current login client reads `callbackUrl` from the URL and later navigates
to it. Middleware-generated callback values are path-based, but a caller may
still supply a cross-origin value unless the login boundary validates it.
This is an adjacent same-origin/open-redirect concern. It is explicitly **out
of scope for V1.1**, must not be opportunistically changed by L1-L5, and remains
an open security task requiring its own contract, tests, lease, and review. It
is a release-before-ship blocker for any release that exposes the login flow;
this document must not be read as a complete authentication security sign-off.

The V1.1 acceptance suite may preserve the existing callback behavior for
compatibility, but must not claim that callbackUrl security has been solved or
that the full authentication surface is release-ready.

## 16. Contract decision and next gate

Decision: approve this document only as the V1.1 implementation contract for
the first-login/API boundary. Historical L0 is
`HARNESS_PREFLIGHT_BLOCKED`; its runtime boundary was not evaluated. L1 remains
blocked. The next possible action is a separately dispatched F0.1 lease, which
must branch from the approved V1.1 contract SHA, prove exact `d8e...` probe
blobs, commit its full candidate SHA, pass static/local fixture-bootstrap
preflight, and then make one fixed-boundary runtime attempt. After evidence
freeze and the exact cleanup attempt it must make the mandatory receipt commit.
This revision does not authorize that dispatch or automatically rerun it.

Only an exact-SHA F0.1 `PASS` may allow the coordinator to consider L1. Either
`BOUNDARY_FAIL` or `HARNESS_PREFLIGHT_BLOCKED` keeps L1 blocked and requires a
new coordinator decision; neither outcome permits a route-handler, JWT-only,
or default-network substitution. After L1-L5 implementation, independent
review must verify F0 and A1-A16, and the coordinator must issue a separate
acceptance decision.

Current state remains:

**PROPOSED / L0 HARNESS_PREFLIGHT_BLOCKED / L1 BLOCKED / NOT IMPLEMENTED /
NOT RELEASE APPROVED**
