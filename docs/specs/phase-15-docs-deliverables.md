---
title: 'Phase 15: Documentation and deliverables'
type: 'chore'
created: '2026-09-25'
status: 'done'
route: 'dispatch'
review_loop_iteration: 1
baseline_commit: '8f95503fa3cca67892397ccee8b0189960124058'
context:
  - '{project-root}/docs/protocol.md'
  - '{project-root}/docs/performance.md'
  - '{project-root}/docs/tasks.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:**
- The README, `docs/design.md` and `docs/requirements.md` still describe the Phase 1–8 design (the conflator, tiered backpressure, earlier metric names and test counts).
- They don't cover everything the brief asks the README for, for the current code: setup, build and run, architectural decisions, buffering strategy, assumptions, trade-offs and AI usage.
- `GIT_WORKFLOW.md` duplicates README content, and the screen recording hasn't been made.

**Approach:**
- Rewrite the README as the reviewer's entry point, linking to `docs/protocol.md` and `docs/performance.md` for depth.
- Rewrite `docs/design.md`: architecture, data flow, decision records with the alternatives rejected, and the scaling design.
- Turn `docs/requirements.md` into a brief requirement → implementation → verification table.
- Fold `GIT_WORKFLOW.md` into a short README section.
- Record the demo on both platforms, driven by Maestro.
- Verify the default branch and a fresh clone.

## Boundaries & Constraints

**Always:**
- Every number comes from `docs/performance.md`, the test runs or the load test. Every README command has been run, or is marked as long-running or device-only.
- Plain, specific prose, with no marketing adjectives.
- Link rather than duplicate: protocol details live in `docs/protocol.md`, measurements in `docs/performance.md`.

**Never:**
- Claims that weren't measured. No "60 FPS guaranteed", and no physical-device numbers.
- Code changes, unless a documented command or claim turns out to be wrong. Then fix the command, the docs or the missing test, and note it here.
- Video files in git. The recordings are attached to a GitHub release.

## I/O & Edge-Case Matrix

| Reader need | The README answers with |
|---|---|
| Run it quickly | Prerequisites, `npm ci`, the gateway via Docker, debug builds on iOS/Android, the Expo Go fallback, physical devices via `EXPO_PUBLIC_GATEWAY_URL` |
| Blocked Binance hosts | The `binance.vision` hosts in `docker-compose.yml` |
| Test offline | `docker compose stop gateway` / `start`; airplane mode on Android |
| Verify quality | `npm run typecheck && npm run lint && npm test` with counts; the load test; Maestro, including the iOS tag exclusion; the CI jobs |
| Why this design | The architecture diagram, the buffering and backpressure strategy, key decisions with alternatives, trade-offs |
| What was assumed or changed | Assumptions and mockup deviations |
| Scale | The 1M-client arithmetic from `docs/performance.md`, with its caveats, and the levers |
| AI usage | Tools, method, defects caught, what the human decided |
| See it working | Links to the iOS and Android recordings |

</frozen-after-approval>

## Code Map

- `README.md`: rewritten.
- `docs/design.md`: rewritten.
- `docs/requirements.md`: now a traceability table.
- `GIT_WORKFLOW.md`: removed; see README §12.
- `docs/tasks.md`: T8.2 and T15.1–T15.4 ticked.
- `LICENSE`: the MIT text that `package.json` already declared.
- `package.json`: the `dev:mobile*` scripts now forward extra arguments.
- `mobile/.maestro/README.md`: synthetic-feed and build commands corrected.
- `mobile/tests/terminal.test.tsx`: `OrderBookTable` tests.
- `docs/performance.md`, `docs/specs/phase-11…`, `docs/specs/phase-12…`: small wording corrections.

## Tasks & Acceptance

**Execution:**
- [x] README rewrite
- [x] design.md rewrite
- [x] requirements.md traceability
- [x] Git workflow folded into the README; tasks.md updated
- [x] Every README command verified; every link and anchor resolves
- [x] Fresh clone of the default branch (`main`): install, typecheck, lint, tests
- [x] Demo recordings on the iOS simulator and the Android emulator

**Acceptance Criteria:**
- Given the README, each brief deliverable (setup, build/run, architectural decisions, buffering strategy, assumptions, trade-offs, AI usage, screen recording) is present and accurate against the code.
- Given `docs/requirements.md`, every "verified by" entry names a test or flow that exists and checks that behaviour.

## Implementation Notes

- **Argument forwarding.** `npm run dev:mobile -- <args>` passed its arguments to the inner `npm`, not to Expo. The root `dev:mobile`, `dev:mobile:ios` and `dev:mobile:android` scripts now end in `--`.
- **Terminology.** `expo-dev-client` is not a dependency, so `expo run:*` produces plain debug builds, and the docs say "debug build". A debug build loads from Metro when it is opened, so the instructions no longer suggest `--dev-client` or pressing `i`/`a`, which opens Expo Go.
- **Node version.** React Native 0.86 requires Node `^20.19.4 || ^22.13`. The fresh clone's `npm ci` warned on Node 20.19.2, so the prerequisite is stated exactly.
- **Recordings.**
  - Maestro drove both recordings against the live gateway, with the gateway stopped and restarted for the offline part. They were captured with `simctl io recordVideo` and `adb screenrecord` (video only).
  - On Android, `screenrecord` stopped receiving frames during one offline window. That part was recorded again and spliced in.
  - A search step's taps landed while the keyboard was dismissing, so the flow now hides the keyboard first.

## Review Triage Log

Two review passes ran on the draft: one checked facts against the code, the other read the documents blind and walked the setup path as a new user would.

| # | Finding | Verdict | Resolution |
|---|---|---|---|
| 1 | The order book was listed as verified by `terminal.test.tsx` and the `terminal` Maestro flow, but neither checks it | fixed | Added `OrderBookTable` tests (top 10 per side, decimals, deeper levels dropped, in-place update); the Maestro claim was narrowed |
| 2 | The docs said the app validates frames with the shared zod schemas; it uses hand-written guards on the per-tick path | fixed | README, design data flow and ADR-4 corrected |
| 3 | "MIT" with no LICENSE file | fixed | LICENSE added |
| 4 | "Development client" wording and the `--dev-client` start command, with no `expo-dev-client` installed | fixed | Debug/release terms defined once and used throughout |
| 5 | The synthetic-feed command in the Maestro README didn't resolve from the stated directory, and collided with the Docker gateway's ports | fixed | `cd backend`, stop the Docker gateway, build `shared` first |
| 6 | The load test needs `shared` built on a fresh clone | fixed | `npm run build:shared` added before the load-test commands |
| 7 | `maestro test mobile/.maestro/` fails on iOS (airplane-mode flow) | fixed | `--exclude-tags android-only` documented |
| 8 | No hint for regions where Binance's main hosts are blocked | fixed | Quick-start note pointing to the `binance.vision` hosts |
| 9 | Scaling table without its caveats (single core, loopback, same host) or the per-process derivation | fixed | Caveats and the 12–15k clients per process derivation added |
| 10 | ADR-4 rejects `permessage-deflate` for iOS, while the scaling levers recommend it | fixed | Levers now say it helps only clients that can negotiate it |
| 11 | Missing prerequisites (JDK 17, CocoaPods, Maestro, free ports); physical-device steps missing USB debugging and iOS signing | fixed | Prerequisites expanded; device notes added |
| 12 | Adaptive cadence described without saying it is off by default | fixed | Stated |
| 13 | Review-pass names didn't match `docs/specs/README.md` | fixed | Aligned |
| 14 | Minor: frame vs data-frame wording, the message list in the diagram, `PORT`/`HOST`/`NODE_ENV` missing from the table, the Node version in the diagram, test file attributions | fixed | Corrected |
| 15 | Counts hard-coded in the README may drift | reject | Checked at this commit (315); CI shows the current counts |

## Verification

**Commands:**
- A fresh clone of `main`: `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, all green (29 + 111 + 173).
- On this branch: typecheck and lint green; 29 + 111 + 175 = 315 tests passing.
- `docker compose stop gateway` / `start` during the recordings: the offline banner appears, then the app reconnects to LIVE with no user action, on both platforms.
- Every relative link and heading anchor in README.md, design.md and requirements.md resolves.
