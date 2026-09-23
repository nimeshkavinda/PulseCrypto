# PulseCrypto Gateway WebSocket Protocol (v1)

- **Endpoint:** `ws://<host>:<port>/ws`
- **Encoding:** UTF-8 JSON text frames.
- **Contract source:** [`shared/src/protocol.ts`](../shared/src/protocol.ts). Zod schemas and TypeScript types there are shared by the gateway and the app.

## Design goals
- **Opt-in channels.** A client receives only what the current screen needs. The watchlist needs `tickers`; the terminal needs `tickers` plus one `book:<PAIR>`.
- **Latest state, not a backlog.** Market data is last-value data: an older order book snapshot has no value once a newer one exists. The gateway tracks, per client, the version of every item it last sent that client. Anything skipped (because of client cadence or a congested socket) is never queued; the next frame carries the current version instead.
- **One frame per tick per client, sent only when something changed.**

## Frame envelope
Every server → client frame has this shape:

```json
{ "v": 1, "tick": 1842, "ts": 1727071234567, "msgs": [ /* one or more messages */ ] }
```

| Field | Meaning |
|---|---|
| `v` | Protocol version (`1`). |
| `tick` | Gateway tick counter at send time. Gaps are expected: they mean nothing changed for this client, or its frame was conflated away. |
| `ts` | Gateway wall-clock time when the frame was sent (epoch ms). |
| `msgs` | Messages, in order. Clients should process them in order. |

## Channels
| Channel | Content | Typical consumer |
|---|---|---|
| `tickers` | Price and 24h stats for every supported pair, sent as a delta (only the pairs that changed) | Watchlist, terminal header |
| `book:<PAIR>` | Top-20 order book plus derived analytics for one pair, e.g. `book:BTCUSDT` | Terminal |
| _status_ | Gateway/upstream health. Every client receives it; no subscription needed. | Connection indicators |

Supported pairs: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `DOGEUSDT`, `XRPUSDT`.

A new subscription always receives the full current state of that channel on the next tick. Items for which the gateway has not yet received upstream data are never sent.

## Client → server messages

| Message | Example | Server response |
|---|---|---|
| `subscribe` | `{"type":"subscribe","channels":["tickers","book:BTCUSDT"]}` | `ack` listing the client's full subscription set; `error UNKNOWN_CHANNEL` for any invalid names (valid ones are still applied) |
| `unsubscribe` | `{"type":"unsubscribe","channels":["book:BTCUSDT"]}` | `ack` with the remaining subscription set |
| `setCadence` | `{"type":"setCadence","cadenceMs":250}` | `ack` with the **effective** cadence |
| `ping` | `{"type":"ping","id":7}` | `pong` echoing `id`, plus the server's timestamp |

`channels` holds 1–16 names. Messages that are not JSON, or that don't match the schema, get an `error` reply (`BAD_JSON` / `BAD_MESSAGE`), limited to one error per second per client. The connection stays open.

### Cadence
The gateway ticks every `FLUSH_INTERVAL_MS` (default 100 ms; advertised as `tickMs` in `hello`). A client may ask for a **slower** cadence to save bandwidth and battery. The request is rounded up to a whole number of ticks and capped at `maxCadenceMs`. Example with a 100 ms tick: 250 → 300 ms; 10 → 100 ms. A slower cadence never makes data staler than one cadence period, because each frame carries the latest versions.

## Server → client messages

### `hello`
Sent once, immediately on connect, in the same frame as the current `status`.
```json
{"type":"hello","protocol":1,"tickMs":100,"minCadenceMs":100,"maxCadenceMs":10000,
 "pairs":["BTCUSDT","ETHUSDT","SOLUSDT","DOGEUSDT","XRPUSDT"],
 "channels":["tickers","book:BTCUSDT","book:ETHUSDT","book:SOLUSDT","book:DOGEUSDT","book:XRPUSDT"]}
```

### `status`
```json
{"type":"status","upstream":"live","stalePairs":[],"since":1727071200000}
```
| `upstream` | Meaning |
|---|---|
| `connecting` | The gateway has not connected to the exchange yet. |
| `live` | Connected, and every pair's order book updated within `STALE_AFTER_MS` (default 3 s). |
| `stale` | Connected, but the pairs in `stalePairs` have not updated within `STALE_AFTER_MS`. |
| `down` | The exchange connection dropped after having been up. The gateway is reconnecting with backoff. |

`since` is when the status last changed. The order book stream (every 100 ms per pair) is the freshness heartbeat; tickers (1 s) and trades (bursty) are not used for this. Clients should surface upstream problems even while their own socket is healthy, because a connected gateway with a stale upstream is serving frozen data.

### `tickers`
```json
{"type":"tickers","data":[
  {"pair":"BTCUSDT","price":64238.17,"change24h":2.45,"high24h":65120,"low24h":62800,
   "volume24h":28410.5,"updatedAt":1727071234501,"eventTs":1727071234498}
]}
```
`change24h` is a percentage. `volume24h` is in the base asset. `price` is the last traded price: it comes from aggregated trades, or from the 24h ticker when that is newer. A price never moves backwards in exchange time.

### `book`
```json
{"type":"book","pair":"BTCUSDT","updatedAt":1727071234490,"eventTs":null,
 "spread":0.01,"spreadPct":0.0000156,"buyPressure":58.2,"sellPressure":41.8,
 "bids":[[64238.16,0.4522,29048.4]],"asks":[[64238.17,0.112,7194.67]]}
```
| Field | Definition |
|---|---|
| `bids` / `asks` | `[price, quantity, notional]`, best level first, at most 20 per side. `notional = price × quantity` in the quote asset. |
| `spread` | `bestAsk − bestBid`, rounded to the pair's price precision. |
| `spreadPct` | `spread / bestBid × 100`. |
| `buyPressure` | Bid-side share of total base-asset quantity across all published levels (0–100). `sellPressure = 100 − buyPressure`. |

### Timestamps
| Field | Meaning |
|---|---|
| `updatedAt` | When the gateway received the latest upstream update for this item. Use it for "last updated" displays and staleness checks. |
| `eventTs` | Exchange event time. For tickers, the latest of the 24h ticker event time and the last aggregated trade time. For books it is always `null`, because Binance partial-depth snapshots carry no event time. |
| frame `ts` | When the frame was sent. It is **not** a measure of data freshness. |

### `ack`, `pong`, `error`
```json
{"type":"ack","action":"setCadence","cadenceMs":300}
{"type":"pong","id":7,"serverTs":1727071234567}
{"type":"error","code":"UNKNOWN_CHANNEL","message":"Unknown channel(s): book:FOOUSDT"}
```

## Flow control and slow consumers
Per client, on every tick:

1. **Above the hard limit** (`WS_HARD_LIMIT_BYTES`, default 1 MiB buffered): close with **1013 Try Again Later** and terminate after 1 s if the close frame can't flush.
2. **Above the soft limit** (`WS_SOFT_LIMIT_BYTES`, default 64 KiB): skip this frame (counted in `pulsecrypto_frames_dropped_total`). Nothing is queued. When the buffer drains, the client gets one frame with the latest state of everything that changed.
3. **Above the soft limit for longer than `WS_LAG_GRACE_MS`** (default 5 s): close with 1013.

Server memory per client is therefore bounded by the hard limit, and a slow client never slows down anyone else. Clients should treat 1013 as "reconnect with backoff".

## Connection limits
| Limit | Default (env) | Behaviour |
|---|---|---|
| Browser origin | `ALLOWED_ORIGINS` = `*` | A request with an `Origin` header not in the allowlist gets **HTTP 403** before the upgrade. Native apps send no `Origin` and are always allowed. |
| Connections per instance | `WS_MAX_CONNECTIONS` = 10000 | Further upgrades get **HTTP 503** + `Retry-After: 5`. |
| Inbound message size | `WS_MAX_PAYLOAD_BYTES` = 4096 | Larger messages close the socket with **1009**. |
| Inbound message rate | `WS_RATE_LIMIT_BURST` = 20, `WS_RATE_LIMIT_PER_SEC` = 10 | Token bucket per client. When empty, the socket closes with **1008 `rate limit`**. A ping every few seconds plus occasional subscribes never comes close. |
| Liveness | `WS_HEARTBEAT_MS` = 30000 | The server sends a protocol-level ping. A client that hasn't answered by the next heartbeat is terminated. Standard WebSocket clients answer pings automatically. |

Authentication and TLS are expected at the edge (load balancer / API gateway), in front of the gateway.

## Upstream sources
| Data | Binance source |
|---|---|
| Order book | `<pair>@depth20@100ms` (top-20 partial snapshots, so no diff/sequence sync is needed) |
| Last price | `<pair>@aggTrade` |
| 24h statistics | `<pair>@ticker` (every 1 s). Bootstrapped at startup from REST `GET /api/v3/ticker/24hr` |
| Trading status, tick/lot size | REST `GET /api/v3/exchangeInfo` at startup, refreshed hourly |

Hosts are configurable through `BINANCE_WS_URL` and `BINANCE_REST_URL`. The market-data-only hosts `wss://data-stream.binance.vision` and `https://data-api.binance.vision` work where the main hosts are unavailable.

## Example session
```
→ (connect)
← {"v":1,"tick":0,"ts":…,"msgs":[{"type":"hello",…},{"type":"status","upstream":"live",…}]}
→ {"type":"subscribe","channels":["tickers","book:ETHUSDT"]}
← {"v":1,"tick":0,"ts":…,"msgs":[{"type":"ack","action":"subscribe","channels":["tickers","book:ETHUSDT"]}]}
← {"v":1,"tick":1,"ts":…,"msgs":[{"type":"tickers","data":[…5 pairs…]},{"type":"book","pair":"ETHUSDT",…}]}
← {"v":1,"tick":2,"ts":…,"msgs":[{"type":"tickers","data":[…BTC only…]}]}
← {"v":1,"tick":4,"ts":…,"msgs":[{"type":"book","pair":"ETHUSDT",…}]}
→ {"type":"unsubscribe","channels":["book:ETHUSDT"]}
→ {"type":"subscribe","channels":["book:BTCUSDT"]}
```
