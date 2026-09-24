/**
 * Client process for the load test: opens `count` real WebSocket clients against the gateway.
 * Behaviour mix: every client subscribes to `tickers` (watchlist); a share also subscribes to one
 * `book:<pair>` (terminal); a share are slow readers that stop reading from their socket.
 */
import WebSocket from 'ws';

interface WorkerConfig {
  url: string;
  count: number;
  terminalShare: number;
  slowShare: number;
  rampMs: number;
}

const PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT'];

let measuring = false;
let frames = 0;
let bytes = 0;
const latencies: number[] = [];
const closes: Record<string, number> = {};
let opened = 0;
let failed = 0;
let healthyClients = 0;

function start(cfg: WorkerConfig) {
  for (let i = 0; i < cfg.count; i++) {
    setTimeout(() => openClient(cfg, i), Math.floor((i / cfg.count) * cfg.rampMs));
  }
}

function openClient(cfg: WorkerConfig, i: number) {
  const slow = i < Math.round(cfg.count * cfg.slowShare);
  const terminal = !slow && Math.random() < cfg.terminalShare;
  const ws = new WebSocket(cfg.url, { perMessageDeflate: false });
  let didOpen = false;

  ws.on('open', () => {
    didOpen = true;
    opened++;
    const channels = slow ? ['tickers', ...PAIRS.map((p) => `book:${p}`)] : ['tickers'];
    if (terminal) channels.push(`book:${PAIRS[i % PAIRS.length]}`);
    ws.send(JSON.stringify({ type: 'subscribe', channels }));
    if (slow) {
      // Stop reading: the kernel buffers fill, then the gateway's per-socket buffer grows.
      (ws as unknown as { _socket: { pause(): void } })._socket.pause();
    } else {
      healthyClients++;
    }
  });

  ws.on('message', (data: Buffer) => {
    if (!measuring || slow) return;
    frames++;
    bytes += data.length;
    // Sample 1 in 10 frames for latency to keep client-side overhead low.
    if (frames % 10 === 0) {
      const ts = Number(/"ts":(\d+)/.exec(data.toString('utf8', 0, 64))?.[1]);
      if (ts) latencies.push(Date.now() - ts);
    }
  });

  ws.on('close', (code) => {
    const key = `${slow ? 'slow' : 'healthy'}:${code}`;
    closes[key] = (closes[key] ?? 0) + 1;
    // A socket that never opened was never counted as healthy.
    if (!slow && didOpen) healthyClients--;
  });
  ws.on('error', () => {
    failed++;
  });
}

process.on('message', (msg: { type: string; config?: WorkerConfig }) => {
  if (msg.type === 'start' && msg.config) start(msg.config);
  if (msg.type === 'measure') {
    measuring = true;
    frames = 0;
    bytes = 0;
    latencies.length = 0;
  }
  if (msg.type === 'report') {
    measuring = false;
    process.send?.({ type: 'report', opened, failed, healthyClients, frames, bytes, latencies, closes });
  }
  if (msg.type === 'exit') process.exit(0);
});
