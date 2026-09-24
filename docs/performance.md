# Gateway Performance

Measured with the repository's load-test harness. All numbers are from real runs; this page states the conditions they were measured under and what they do and don't show.

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
