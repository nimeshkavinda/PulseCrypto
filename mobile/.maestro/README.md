# E2E flows (Maestro)

| Flow | Covers |
|---|---|
| `watchlist.yaml` | live rows, search, clear, un-favourite SOL, cold relaunch, Favourites tab reflects the change |
| `terminal.yaml` | open ETH / USDT from the watchlist; price, buy/sell pressure, spread, order book, depth chart |
| `offline.yaml` | airplane mode shows the offline banner with prices kept; turning it off reconnects to LIVE without user action (Android only: Maestro can't toggle airplane mode on iOS) |

Run with a gateway on the host (`npm run dev:backend`, or the synthetic feed below) and the app installed:

```bash
maestro test mobile/.maestro/                                        # all flows, first connected device (Android)
maestro test --exclude-tags android-only mobile/.maestro/            # iOS: skip the airplane-mode flow
maestro --device <udid> test mobile/.maestro/terminal.yaml           # one flow on a chosen device
```

- **Android:** a release build is the most faithful target (builds and installs it):
  ```bash
  npm run dev:mobile:android -- --variant release
  ```
  It talks to `ws://10.0.2.2:8080`. Release builds allow cleartext only to loopback hosts; see `plugins/withLocalCleartext.js`.
- **iOS:** use a debug build with Metro running, or a Release build (`npx expo run:ios --configuration Release`).
- **Synthetic feed** (deterministic, no exchange access; used by CI):
  ```bash
  docker compose stop gateway                           # it serves the same ports
  npm run build:shared                                  # once; the feed imports the built package
  cd backend && PORT=8080 npx tsx scripts/loadtest/server.ts
  ```

The flows match on accessibility labels and visible text, not coordinates. The tab matcher accepts both platforms' labels (`Markets` on Android, `Markets, tab, 2 of 4` on iOS).
