---
title: 'Phase 10a: Upstream ingestion fixes, REST bootstrap and data freshness'
type: 'bugfix'
created: '2026-09-23'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: '8ffd74da8c57b15a158300d302e77da44e21d61f'
context:
  - '{project-root}/docs/protocol.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:**
- The gateway subscribes to `!miniTicker@arr`, which is every Binance symbol every second, just to keep 5, plus raw `@trade` (~50 msgs/s for BTC). The two ticker sources disagree: miniTicker has no `%` change, so `change24h` goes stale while the price moves.
- `/pairs/meta` and the metadata start from hardcoded placeholder prices.
- Clients can't tell a live feed from a frozen one: `status` is only connected/disconnected, and `eventTs` is always null.
- `BinanceConnector.disconnect()` never terminates its socket, and `BINANCE_WS_URL` is documented but not read.

**Approach:**
- Ingest `depth20@100ms` + `aggTrade` + `ticker` for the supported pairs only.
- Bootstrap metadata from Binance REST (`ticker/24hr`, `exchangeInfo`) with retry, so nothing is ever seeded.
- Carry exchange event times.
- A freshness monitor publishes `connecting | live | stale | down` and `stalePairs`.
- `/pairs/meta` serves real data only: 503 + `Retry-After` until ready, then schema-serialized with `Cache-Control` and an ETag.

## Boundaries & Constraints

**Always:**
- Only upstream data reaches clients.
- A ticker update must never move `price` backwards in time: it sets price only if its event time is ≥ the last applied trade time.
- Upstream URLs are configurable (`BINANCE_WS_URL`, `BINANCE_REST_URL`), and the market-data-only hosts are documented.
- REST calls time out (5 s) and retry with capped exponential backoff and jitter. Bootstrap failure never crashes the process.
- Map exchange `status`: `TRADING` → `TRADING`, `HALT` → `HALTED`, anything else → `MAINTENANCE`.

**Never:**
- No changes to the protocol shape (Phase 9 contract), except filling in `eventTs` and `stalePairs`.
- No security or ops limits and no Docker changes (Phase 10b).
- No mobile changes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected |
|---|---|---|
| Boot, REST ok | both REST calls succeed | metadata ready; `/pairs/meta` 200 with 5 pairs, real prices, tick-size-derived decimals |
| Boot, REST down | REST fails repeatedly | `/pairs/meta` 503 + `Retry-After`; retries with backoff; WS ingestion unaffected |
| Ticker before bootstrap | WS `ticker` arrives first | ticker channel serves it; `/pairs/meta` stays 503 until `exchangeInfo` has loaded |
| aggTrade | `{s,p,T}` | ticker price = p, `eventTs` = T, high/low widened if needed; version bumps only if price changed |
| Late ticker | ticker `E` < last trade `T` | 24h stats updated; price NOT overwritten |
| Depth | `depth20` payload | book updated, `eventTs` null (stream has no event time) |
| Unknown / malformed | unsupported symbol, non-numeric fields, bad JSON | ignored, counted, never throws |
| Freshness | connected; a pair's book not updated for > `STALE_AFTER_MS` (3000) | `status` → `stale`, `stalePairs` lists it; recovers to `live` when updates resume |
| Upstream down | socket closed after having been live | `status` → `down` |
| Never connected | before the first open | `status` = `connecting` |
| Conditional GET | `If-None-Match` equals current ETag | 304, empty body |
| Shutdown | `disconnect()` | socket terminated, no reconnect scheduled |

</frozen-after-approval>

## Code Map

- `backend/src/binance.ts`:
  - Rebuild the stream set and URL from `wsBaseUrl`, and parse `depth20`, `aggTrade` and `24hrTicker` events.
  - Rely on `ws` auto-pong and drop the manual pong.
  - Idle watchdog; full-jitter backoff.
  - Fix `disconnect()`, which currently nulls `ws` before terminating.
  - Keep the handler-registration style.
- `backend/src/market/binanceRest.ts` (new): `fetchTickers24h`, `fetchExchangeInfo`, mapping to domain values. Inject `fetch` for tests.
- `backend/src/market/bootstrap.ts` (new): retry loop, applies into `MetadataService`, hourly `exchangeInfo` refresh, `stop()`.
- `backend/src/metadata.ts`:
  - Split static info (display/status/decimals) from live stats.
  - No seeds.
  - `isReady()`, plus a content version for the ETag.
  - Trade vs ticker ordering, and `eventTs` on the ticker view.
- `backend/src/market/freshness.ts` (new): an interval monitor computing upstream status and stale pairs into `StatusTracker` (reuse from `marketSource.ts`).
- `backend/src/http/meta.routes.ts`: 503/200/304, JSON schema response, `Cache-Control: public, max-age=2`, ETag.
- `backend/src/config.ts`: `BINANCE_WS_URL`, `BINANCE_REST_URL`, `STALE_AFTER_MS`.
- `backend/src/server.ts`: wiring and shutdown order.
- Tests: `binance.test.ts` (rewrite for the new streams), new `bootstrap.test.ts`, `metadata.test.ts` and `freshness.test.ts`, and update `routes.test.ts`/`observability.test.ts`, which assume seeded metadata.

## Tasks & Acceptance

**Execution:**
- [x] `backend/src/config.ts` -- the new env vars with defaults and validation
- [x] `backend/src/metadata.ts` -- static + live split, readiness, ordering rule, content version
- [x] `backend/src/binance.ts` -- stream set, parsers, watchdog, backoff, `disconnect` fix
- [x] `backend/src/market/binanceRest.ts`, `backend/src/market/bootstrap.ts` -- REST bootstrap with retry and refresh
- [x] `backend/src/market/freshness.ts` -- status and stale-pairs monitor
- [x] `backend/src/http/meta.routes.ts` -- readiness, schema, caching headers, conditional GET
- [x] `backend/src/server.ts` -- wiring and graceful stop of the connector, bootstrap, monitor and hub
- [x] `backend/tests/*` -- cover every matrix row
- [x] `docs/protocol.md` -- status semantics, `eventTs` sources, staleness threshold

**Acceptance Criteria:**
- Given a running gateway against live Binance, when a client subscribes to `tickers`, then every ticker has `eventTs` set and `/pairs/meta` returns the same last prices within one refresh period.
- Given `npm test && npm run typecheck && npm run lint`, then all pass.

## Design Notes

Freshness uses the depth stream as the heartbeat because it is the most frequent (every 100 ms per pair). Ticker events arrive every 1 s, and aggTrade is bursty and can go quiet on illiquid pairs. `stale` means connected but at least one pair is frozen. Clients should keep showing data with a staleness badge, and not show it as live.

## Verification

**Commands:**
- `npm test && npm run typecheck && npm run lint` -- expected: all green
- Build and run the gateway against live Binance, then check `/pairs/meta`, the `tickers` frames and the `status` messages -- expected: real data, `eventTs` set, `live`

## Implementation Notes

- Measured directly against Binance over 15 s: the previous stream set (`depth20` + `@trade` + `@ticker` + `!miniTicker@arr`) delivered **267.7 msgs/s, 121.3 KB/s**. The new set (`depth20` + `aggTrade` + `ticker`) delivers **136.7 msgs/s, 82.7 KB/s**, about half the messages and a third less bandwidth to parse.
- Live smoke test: `/pairs/meta` answers 503 during boot and 200 about 1 s later with real prices. Decimals come from exchange tick/lot sizes (e.g. DOGE qty 0, XRP qty 1, where the static table had 1 and 2). `status` reads `live`; 160 of 160 ticker items carried an `eventTs`.
- The ETag is derived from a content version that moves with every trade, so conditional GETs mostly help within the same second. `Cache-Control: max-age=2` does the heavy lifting.
- New metric: `pulsecrypto_upstream_messages_invalid_total{reason}`.
- Trades are ignored until a pair has 24h statistics, because the ticker view needs them. In practice that's the first REST bootstrap or the first WS `ticker` event (≤ 1 s).

## Spec Change Log

## Review Triage Log

Review pass 1, 2026-09-23: blind, edge-case and verification-gap lenses.

| # | Finding | Verdict | Route | Evidence |
|---|---|---|---|---|
| 1 | The depth row of the matrix (`eventTs` null) has no explicit assertion | low | patch | Added an assertion to `orderbook.test.ts`. |
| 2 | During an upstream outage `/pairs/meta` keeps serving the last 24h stats with no staleness signal | low | defer | Clients get `status: down/stale` over the stream, and pull-to-refresh runs alongside it. A header could expose it later. |
| 3 | `If-None-Match` carrying several ETags (`"a", "b"`) isn't matched | low | reject | Mobile clients send one ETag, and a miss only means a full 200. Adding a parser is complexity with no user impact. |
| 4 | A connector test assumed event ordering between the server's `connection` and the client's `open` | low | patch | Assertion narrowed to the close → reopen transition. It passed 3 consecutive runs. |
| 5 | The Binance REST geo-block (HTTP 451) retries forever at the 30 s cap | false | none | That is intended backoff. The warning names the failure, and the data-api host is documented as the fix. |
