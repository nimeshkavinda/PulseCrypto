# Performance

Two parts: the gateway under load (below), and [the app on device](#on-device-release-builds) under a sustained update burst. All numbers are from real runs; this page states the conditions they were measured under and what they do and don't show.

```bash
npm --prefix backend run loadtest -- --clients 5000 --duration 30
# options: --workers N  --terminal 0.3  --slow 0.02  --ramp <ms>  --profile <dir>
```

## Method
- **Gateway under test:** the production Fastify app and `ChannelHub` in their own process. A synthetic market replaces Binance so runs are repeatable, with rates in Binance's order of magnitude for each of the 5 pairs:
  - order book snapshot every 100 ms (20 levels per side)
  - trade every 20 ms
  - 24h ticker every 1 s
- **Settings:** default server tick of 100 ms, soft limit 64 KiB, hard limit 1 MiB, lag grace 5 s.
- **Clients:** real `ws` clients spread over 8 separate processes, ramped at about 1,000 connections/s:
  - **100%** subscribe to `tickers` (watchlist).
  - **30%** also subscribe to one `book:<pair>` (terminal).
  - **2%** are slow readers. They subscribe to every book, then stop reading from their socket, so their buffers fill.
- **Measured:** a 30 s window after a 3 s settle.
  - **Gateway side:** CPU, event-loop utilization (ELU), RSS, and tick duration (the time to build and write one fan-out pass).
  - **Client side:** frame latency (receive time − frame `ts`, 1-in-10 sample), bytes/s and frames/s per healthy client, and closes.
- **Environment:** Apple M4 Pro (12 cores, 24 GB), macOS 27, Node 20.19, loopback networking. The gateway and all clients share the same machine.

## Results

| Clients | Gateway CPU | ELU | RSS | Tick p50 / p99 | Frame latency p50 / p99 | Per healthy client | Slow readers closed (1013) | Healthy clients lost |
|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 16.6% | 0.16 | 111 MB | 15.9 / 19.3 ms | 11 / 19 ms | 9.9 frames/s, 14.7 KB/s | 24 of 24 | 0 |
| 5,000 | 33.4% | 0.33 | 158 MB | 32.3 / 35.9 ms | 19 / 33 ms | 10.0 frames/s, 14.4 KB/s | 104 of 104 | 0 |
| 10,000 | 58.4% | 0.58 | 189 MB | 58.0 / 73.3 ms | 29 / 59 ms | 9.9 frames/s, 14.3 KB/s | 200 of 200 | 0 |

"Per healthy client" is the 70/30 watchlist/terminal mix. A watchlist-only client receives less, because it gets no order book.

## What the numbers say
- **One process holds 10,000 clients at 10 Hz** with the tick p99 (73 ms) still inside its 100 ms budget. That puts the practical per-core ceiling at roughly 12–15k clients for this traffic mix. Beyond that, ticks would overrun, and the fix is adding processes, not tuning.
- **Slow consumers are isolated.** Every slow reader was skipped (`frames_dropped_total`) and then closed with 1013 after the grace period. Healthy clients kept their rate and their latency.
- **Memory is flat per client:** about 8 KB RSS per additional connection (111 → 189 MB from 1k to 10k). The hard limit bounds the worst case per client at 1 MiB.
- **The cost is the kernel, not the hub.** A CPU profile at 1,000 clients (`--profile`) shows the gateway 81% idle, with `writev` (one socket write per client per frame) the largest single share of busy time, about 37%. Hub functions were about 6% of busy time; benchmarked in isolation with no-op sockets, hub logic costs about 0.6 µs per client per tick. Two changes follow from this:
  - Clients with identical pending state in a tick share one pre-encoded frame buffer, so encoding is paid once, not per client.
  - Metrics are counted once per tick, not per frame.

  The remaining cost scales with the number of sockets written to, and only more cores reduce it.

## Caveats
- **The latency figures are upper bounds.** The clients run on the same machine, compete for CPU with the gateway, and parse frames in JavaScript.
- **macOS loopback overstates per-write syscall cost** compared with a Linux production host. The per-core ceiling on Linux is likely higher; these numbers are the conservative case.
- **Synthetic data is a worst case for `tickers`.** The feed moves every pair's price on every tick, so every watchlist frame carries all 5 tickers. Live Binance traffic changes fewer pairs per tick. For reference, a terminal client (tickers + one book) measured against live Binance received ~14–15 KB/s.

## Implications for scale
At about 14.5 KB/s per client, **1,000,000 concurrent clients means roughly 14.5 GB/s (~116 Gbit/s) of egress** and about 70–90 gateway processes at the measured per-core capacity. Egress dominates the cost, which makes these the effective levers, in order:
1. **Send less.** Watchlist screens can request a slower cadence (e.g. `setCadence 500` → 2 frames/s), and backgrounded apps disconnect.
2. **Encode smaller.** Delta-encode order books (changed levels only) and use a compact binary encoding. `permessage-deflate` trades CPU for bandwidth and fits the ticker channel better than the book channel.
3. **Fan out closer to users.** Edge gateway replicas per region subscribe to a shared internal feed (see the README's scaling section).

## On device (release builds)

The app was measured on release builds only. Debug builds carry React Native's development tooling and give misleading numbers; see [Memory](#memory).

### Method
- **Burst source:** the load-test gateway (`backend/scripts/loadtest/server.ts`) on the host with `FLUSH_INTERVAL_MS=50`. That is **20 frames/s, twice the production tick**.
  - The synthetic feed moves every pair's price every 20 ms, so every frame carries all 5 tickers.
  - Order books are regenerated every 100 ms, so every level changes.
  - This is a worst case: live Binance traffic changes far less per frame.
- **Android:**
  - Build: release APK (`assembleRelease`, minified Hermes bytecode, debug-signed for local install).
  - Device: Pixel 10 Pro emulator, API 37, 60 Hz, host-GPU rendering on an Apple M4 Pro.
  - Tool: `dumpsys gfxinfo` over a 60 s window per screen.
  - Control: each capture is bracketed by scrolling the system Settings app. A capture counts only if the controls on both sides are clean.
- **iOS:**
  - Build: Release configuration on the iOS 27 simulator (iPhone 18 Pro).
  - Memory: `footprint` (`phys_footprint`, the figure Xcode reports).
  - FPS: the Telemetry screen's native UI-thread counter (`CADisplayLink`) and its JS-thread `requestAnimationFrame` counter.

### Frame times (Android release, 20 frames/s burst)

| Screen | Frames in 60 s | Frame time p50 / p90 / p99 | Legacy jank (missed vsync) | Control (Settings scroll) p50 / p99, jank |
|---|---:|---:|---:|---:|
| Terminal (tickers + one 20-level book, depth chart) | 3,327 | 17 / 18 / 19 ms | 0.4% | 17 / 20 ms, 1.8% |
| Watchlist (5 live rows with price flashes) | 1,185 | 17 / 20 / 22 ms | 0% | 17 / 21 ms, 0.6% |

- **Frame times stay within one to one-and-a-half vsyncs at twice the production update rate.** No frame exceeded 24 ms on either screen.
- **The watchlist draws only when something changes.** It produced about 20 frames/s, one per update, rather than redrawing at 60 Hz.
- **Android's newer deadline-based jank counter** (`Janky frames`) flags 8% of terminal frames and nearly all watchlist frames. Those frames finish at 16–22 ms, so they miss the 16.7 ms deadline by a millisecond or two.
  - `framestats` attributes this to RenderThread issuing draw commands through the emulator's host-GL translation. The app's own per-frame work (input, animation, layout, draw recording) is about 5 ms.
  - Confirming this on a physical device is the next step. The emulator can't settle it.
- **Emulator reliability:** after several minutes of sustained load on a busy host, the emulator degrades, and the Settings control itself drifts to 50%+ jank and a 200 ms p99. Captures from those windows are discarded, not reported.
- **A change tried and rejected:** removing `overflow: 'hidden'` from the price-flash container. In an A/B with clean controls, both variants measured 17 / 20 / 22–23 ms, so the change was not kept.

### JS thread
- **iOS release:** the JS thread holds 60 fps while ingesting 20 frames/s (30 msgs/s, 38 KB/s).
- **Android release, on the emulator:** it measured 31 fps under the same burst, with the UI thread at 60 fps. Scrolling and animation stay on the UI thread, so they stay smooth, but the JS thread is at its limit there.
  - The production cadence is half this rate.
  - Watchlist users can request a slower cadence (`setCadence`).

### Memory

| Build | Screen, 20 frames/s | Duration | Footprint | Trend |
|---|---|---:|---:|---|
| iOS release | Telemetry, then Terminal | 7 min | 113–130 MB | flat; ~1.2–1.8k live shadow-node families |
| Android release | Watchlist, then Terminal | 4 min | 240–300 MB PSS (native heap 100–108 MB) | flat |
| iOS **debug** | Terminal | 33 s | 406 → 567 MB | **grows ~5 MB/s** |

- **The debug-build growth doesn't ship.**
  - React Native compiles a Fabric leak checker into debug builds (`REACT_NATIVE_DEBUG`, `react/renderer/leakchecker`). It keeps a weak reference to every shadow-node family ever created, until the surface stops.
  - Fabric creates a new family whenever a `<Text>` string changes, about 35 per update on the terminal. Each weak reference pins its 448-byte allocation.
  - After half an hour at 20 frames/s, a debug build held 814k dead families (365 MB), plus around 1 GB of other large allocations that are also absent from release.
  - The Telemetry screen notes this in development builds.
- **Measured on release, the same screens stay flat.**

