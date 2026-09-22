# PulseCrypto 🚀

High-performance, low-latency cryptocurrency market streaming platform. PulseCrypto features an institutional-grade Fastify WebSocket ingestion and conflation gateway upstreamed to Binance, paired with an Expo SDK 57 / React Native 0.86 New Architecture mobile terminal designed with a Pro Trader Dark Mode interface.

---

## Architecture & Monorepo Structure

- `shared/`: Shared TypeScript models and Zod schemas (`MarketUpdatePayload`, `PairMetadata`, `ClientCommand`).
- `backend/`: Fastify 5 + `@fastify/websocket` ingestion service, order book depth manager, 100ms conflation engine, and Prometheus metrics registry.
- `mobile/`: Expo SDK 57 + React Native 0.86 (New Architecture) with Pro Trader dark design tokens, React Navigation (Drawer + Bottom Tabs), and synchronous MMKV storage.

---

## Local Dual Dev-Server Workflow

The project provides a single command to concurrently run both backend and mobile development servers with prefixed logs and coordinated shutdown (single `Ctrl-C` stops both).

### Prerequisites
- Node.js `v24` (see `.nvmrc`)
- Android Studio / Android Emulator (or Expo Go on physical device)

### 3-Step Quickstart (Android Emulator)

1. **Start your Android Emulator**:
   ```bash
   emulator -avd <your-avd-name>
   # or launch an AVD directly from Android Studio Device Manager
   ```

2. **Boot the dual dev-server**:
   - **With Docker Backend (Containerized Development):**
     ```bash
     npm run dev:docker
     ```
     *Boots `docker compose up` for the Fastify backend and Expo Metro bundler concurrently with unified prefixed logs.*

   - **With Local Host Backend (Instant tsx watch hot-reload):**
     ```bash
     npm run dev
     ```
     *Boots Fastify backend on `0.0.0.0:8080` with `tsx watch` and Expo Metro bundler concurrently.*

3. **Open the App on Emulator**:
   - In the interactive terminal, press **`a`** to install and open the app on your running Android emulator.
   - The app connects to the Docker/local gateway at: `ws://10.0.2.2:8080/ws`.

---

### Physical Device / LAN Setup

When developing on a physical device over Wi-Fi, point Expo and the WebSocket client to your computer's LAN IP without modifying any source code:

1. **Find your local IP** (e.g. `192.168.1.6`):
   ```bash
   ipconfig getifaddr en0 # macOS Wi-Fi
   ```

2. **Launch with `EXPO_PUBLIC_GATEWAY_URL`**:
   ```bash
   EXPO_PUBLIC_GATEWAY_URL=ws://192.168.1.6:8080/ws npm run dev
   ```

3. **Connect**:
   - Scan the terminal QR code using Expo Go on your mobile device.
   - For LAN Metro bundling, run `npx expo start --lan` within `mobile/`.

### Runtime Gateway Override

The mobile application persists settings using `StorageRepository` (`react-native-mmkv` / in-memory fallback). You can also override the Gateway URL at runtime from the **Settings** screen (`pulse_gateway_url`) without rebuilding or editing code.

Priority order in `StorageRepository.getGatewayUrl()`:
1. User-configured override in MMKV storage (`pulse_gateway_url`)
2. `EXPO_PUBLIC_GATEWAY_URL` environment variable
3. Default Android emulator loopback: `ws://10.0.2.2:8080/ws`

---

## Verification & Health Probes

```bash
# Verify Backend Health
curl -s http://localhost:8080/health | jq .

# Verify Market Metadata
curl -s http://localhost:8080/pairs/meta | jq .

# Verify Prometheus Metrics
curl -s http://localhost:8080/metrics

# Test WebSocket Streaming Gateway
npx wscat -c ws://localhost:8080/ws
```

### Hot-Reload Verification
- **Backend**: Edit `backend/src/http/health.routes.ts` — `tsx watch` automatically hot-restarts the backend in ~200ms without affecting Metro.
- **Mobile**: Edit any React screen (e.g. `mobile/src/screens/TerminalScreen.tsx`) — Metro Fast Refresh instantly updates the UI on your device/emulator.

---

## Monorepo Commands

| Command | Action |
|---|---|
| `npm run dev` | Run backend (`tsx watch`) and mobile (`expo start`) concurrently |
| `npm run dev:docker` | Run backend in Docker (`docker compose up`) and mobile concurrently |
| `npm run dev:backend` | Run backend standalone with `tsx watch` on port 8080 |
| `npm run dev:mobile` | Run mobile standalone with `expo start` |
| `npm test` | Run all test suites across shared, backend, and mobile |
| `npm run typecheck` | Run TypeScript type checks across all workspaces |
| `npm run lint` | Run ESLint across all workspaces |
| `npm run docker:up` | Run production backend in Docker Compose (`:8080`) |
