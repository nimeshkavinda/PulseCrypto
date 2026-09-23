---
title: 'Phase 13: Settings fixes, native telemetry and hardening'
type: 'feature'
created: '2026-09-23'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '22cc5689e4b35d6a5cc1beb822a855741ac0c7cf'
context:
  - '{project-root}/docs/protocol.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:**
- Two Settings switches ("Binary Protocol Compression", "Adaptive Polling Strategy") only store a boolean.
- Telemetry misstates what it measures:
  - The memory chart is a random walk labelled `SIMULATED`.
  - FPS is JS-thread only, clamped to 60, and runs while the tab is hidden.
  - A card calls the Hermes engine "GPU ACCELERATION".
- Reactotron is bundled into every build.
- There are no error boundaries.

**Approach:**
- Remove the compression switch: the protocol is JSON and the client cannot negotiate compression.
- Make the adaptive switch real: slow the stream on metered or cellular connections.
- Add a small local Expo Module, `perf-monitor` (Swift + Kotlin), that reports the process memory footprint and the UI-thread frame rate.
- Telemetry shows real native values, or states plainly that they are unavailable (e.g. in Expo Go), and samples only while the tab is visible.
- Load Reactotron in development only.
- Add root and tab error boundaries.

## Boundaries & Constraints

**Always:**
- **No simulated or estimated values anywhere.** Unavailable metrics say "Unavailable" and why.
- **The native module is optional at runtime:** `requireOptionalNativeModule`, so Expo Go and tests still work.
- **Measurement:**
  - Memory: iOS `task_vm_info.phys_footprint` (what Xcode reports); Android total PSS from `Debug.MemoryInfo`.
  - UI FPS: iOS `CADisplayLink`; Android `Choreographer`, counted over 1 s windows, no 60 clamp.
- **The adaptive cadence** applies `max(user preference, 500 ms)` while NetInfo reports `isConnectionExpensive` or cellular, and the effective (acknowledged) cadence stays visible in Settings.

**Never:**
- No new third-party native dependencies.
- No changes to the backend or the protocol.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Adaptive on, Wi-Fi | preference 100 ms, network not expensive | cadence 100 ms |
| Adaptive on, cellular | preference 100 ms, expensive | cadence 500 ms; Settings shows the reason |
| Adaptive on, pref slower | preference 1000 ms, cellular | 1000 ms (never faster than the preference) |
| Adaptive off | cellular | preference unchanged |
| Native module present | dev or release build | memory MB and UI FPS shown, updating every second while focused |
| Native module absent | Expo Go / tests | memory and UI FPS show "Unavailable in Expo Go"; JS FPS still shown |
| Tab hidden | the Telemetry tab loses focus | sampling stops (no rAF loop, no interval, native frame monitor stopped) |
| Render error | a screen throws | an error boundary shows a message and retry; the app shell (tabs) survives |
| Release bundle | `__DEV__` false | Reactotron is not required or loaded |

</frozen-after-approval>

## Code Map

- **New** `mobile/modules/perf-monitor/`:
  - `expo-module.config.json`
  - `index.ts` (typed optional API)
  - `ios/PerfMonitorModule.swift` + `ios/PerfMonitor.podspec`
  - `android/build.gradle` + `android/src/main/java/expo/modules/perfmonitor/PerfMonitorModule.kt`
  - Autolinked from `modules/`.
- **New** `mobile/src/data/adaptiveCadence.ts`: pure `effectiveCadence(pref, adaptive, network)` + runtime wiring (NetInfo type and `isConnectionExpensive`).
- `mobile/src/data/StreamRuntime.ts`: apply the adaptive cadence when the preference, the adaptive flag or the network changes.
- `mobile/src/storage/storageRepository.ts`: remove the compression key; add it to `LEGACY_KEYS`.
- `mobile/src/components/settings/SettingsScreen.tsx`: remove the compression switch, and give the adaptive switch its behaviour description and active state.
- `mobile/src/components/telemetry/*`:
  - The FPS gauge and memory sparkline use the native module, run only while focused, and drop the random walk and the 60 clamp.
  - The engine card becomes "JS ENGINE: Hermes".
- `mobile/src/app/_layout.tsx`, `mobile/src/app/(drawer)/(tabs)/_layout.tsx`: `ErrorBoundary` exports (expo-router).
- `mobile/src/devtools/reactotron.ts` + the root layout: a `__DEV__`-guarded `require`.
- Tests: the adaptive cadence matrix, the module fallback, the error boundary render, and runtime cadence wiring.

## Tasks & Acceptance

**Execution:**
- [x] perf-monitor module (Swift, Kotlin, TS)
- [x] Adaptive cadence + runtime wiring; settings UI
- [x] Telemetry on real metrics, focus-aware
- [x] Error boundaries; dev-only Reactotron
- [x] Tests

**Acceptance Criteria:**
- Given dev builds on the iOS simulator and the Android emulator, Telemetry shows real memory (MB) and UI FPS. In Expo Go it shows "Unavailable" for those two.
- Given `npm test && npm run typecheck && npm run lint`, then all pass.

## Implementation Notes

- **Found during this phase:** with per-screen subscriptions, the Telemetry tab subscribed to nothing, so the ingestion card read ~0 (only ping/pong traffic). The author spotted it on the simulator. Telemetry now subscribes to the terminal's stream while focused, and shows frames/s (10 at 100 ms) with msgs/s, KB/s and what is being measured. Fixed in e4002cb.
- **`perf-monitor`** is a local Expo Module in `mobile/modules/`, autolinked and optional at runtime (`requireOptionalNativeModule` via `expo`).
  - iOS: memory = `task_vm_info.phys_footprint`; FPS = `CADisplayLink` with `preferredFrameRateRange` up to 120 Hz.
  - Android: memory = `Debug.MemoryInfo.totalPss`; FPS = `Choreographer.FrameCallback`.
  - Frame counters are registered on the main thread and counted in 1 s windows.
- **Telemetry sampling** (`usePerfSamples`) starts the rAF loop, the 1 s poll and the native frame monitor only while the tab is focused, and stops all three on blur.
- **Settings:**
  - "Binary Protocol Compression" is removed: the wire format is JSON text frames, and React Native's WebSocket gives the app no control over permessage-deflate negotiation. The stored key is cleaned up as legacy.
  - "Adaptive Polling Strategy" now does what it says: on cellular or `isConnectionExpensive` networks it requests `max(preference, 500 ms)`, shows "Active: …" in Settings, and never speeds up a slower preference.
- **Error boundaries:** `ErrorBoundary` exports on the root and tabs layouts (expo-router), with retry. The error message is shown in development builds only.
- **Reactotron:** `if (__DEV__) require(...)`, which Metro constant-folds out of release bundles.
- **Verified on device (dev builds, gateway in Docker):**
  - iOS 27 simulator: UI 60 FPS, JS 54 fps, memory 403 MB (`phys_footprint`), 11 frames/s.
  - Android emulator: UI 60 FPS, JS 27 fps, memory 641 MB (PSS), 10 frames/s, RTT 31 ms.
  - The Android JS rate is a real reading: an unminified dev build on an emulator sharing the host with the iOS simulator, Docker and Metro. Release-build frame stats are Phase 14's job.
- **Cleartext traffic:** the debug manifest already allows it (`src/debug/AndroidManifest.xml`) and release does not. iOS ATS allows only local networking. So `ws://` works against a local gateway in development, and release builds require `wss://`. No change needed; documented.

## Spec Change Log

## Review Triage Log

Review pass 1, 2026-09-23: blind, edge-case and verification-gap lenses.

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | The telemetry ingestion rate read ~0 because no channels were subscribed on that tab | high | patch | Reported by the author from the simulator. Fixed in e4002cb and verified at 10 frames/s. |
| 2 | `getUiFrameRate` returns 0 until the first 1 s window completes | low | patch | The hook maps 0 to "—" (null) instead of showing 0 FPS. |
| 3 | `Debug.getMemoryInfo` costs a few ms on Android | low | reject | It's called once per second, only while the Telemetry tab is focused. |
| 4 | Adaptive cadence can't be verified on the simulator (always Wi-Fi) | low | defer | Covered by the pure matrix and the runtime wiring test with a fake network-cost feed. A cellular emulator check can happen during the demo recording. |
