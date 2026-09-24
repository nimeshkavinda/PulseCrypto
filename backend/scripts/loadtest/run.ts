/**
 * Gateway load test.
 *   npm --prefix backend run loadtest -- --clients 5000 --duration 30
 * Starts the load-test gateway (synthetic feed) in its own process, drives N real WebSocket
 * clients from several client processes, and reports gateway and client-side measurements.
 */
import { fork, ChildProcess } from 'node:child_process';
import { availableParallelism } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce<[string, string][]>((acc, a, i, all) => {
    if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1]]);
    return acc;
  }, [])
);
const clients = Number(args.clients ?? 1000);
const durationS = Number(args.duration ?? 30);
const workers = Number(args.workers ?? Math.max(1, Math.min(8, availableParallelism() - 3)));
const terminalShare = Number(args.terminal ?? 0.3);
const slowShare = Number(args.slow ?? 0.02);
const port = Number(args.port ?? 18090);
const metricsPort = port + 1;
const rampMs = Number(args.ramp ?? Math.max(2000, clients)); // ~1k connections/s
const here = path.dirname(fileURLToPath(import.meta.url));
const tsx = { execArgv: ['--import', 'tsx'] };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const pct = (xs: number[], q: number) => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

async function stats(reset = false) {
  const res = await fetch(`http://127.0.0.1:${metricsPort}/stats${reset ? '?reset=1' : ''}`);
  return (await res.json()) as Record<string, number>;
}

const children: ChildProcess[] = [];
let finishing = false;
let failEarly: (err: Error) => void = () => {};
/** Rejects as soon as the gateway or a client process exits before the run finishes. */
const earlyExit = new Promise<never>((_, reject) => {
  failEarly = reject;
});
function watchExit(child: ChildProcess, name: string) {
  children.push(child);
  child.once('exit', (code, signal) => {
    if (!finishing) failEarly(new Error(`${name} exited early (code ${code}, signal ${signal})`));
  });
}
/** Waits for `p`, failing fast if a child process dies in the meantime. */
const guarded = <T>(p: Promise<T>) => Promise.race([p, earlyExit]);

async function main() {
  const profileDir = args.profile;
  const server: ChildProcess = fork(path.join(here, 'server.ts'), [], {
    execArgv: [...tsx.execArgv, ...(profileDir ? ['--cpu-prof', `--cpu-prof-dir=${profileDir}`] : [])],
    env: {
      ...process.env,
      PORT: String(port),
      METRICS_PORT: String(metricsPort),
      WS_MAX_CONNECTIONS: String(clients + 100),
      WS_HEARTBEAT_MS: '30000',
    },
  });
  watchExit(server, 'gateway');
  await guarded(new Promise<void>((resolve) => server.on('message', (m: { type: string }) => m.type === 'ready' && resolve())));

  const perWorker = Math.ceil(clients / workers);
  const procs: ChildProcess[] = [];
  // Clients that are not slow readers, rounded per worker exactly as client-worker.ts does.
  let expectedHealthy = 0;
  for (let w = 0; w < workers; w++) {
    const count = Math.min(perWorker, clients - w * perWorker);
    if (count <= 0) break;
    expectedHealthy += count - Math.round(count * slowShare);
    const p = fork(path.join(here, 'client-worker.ts'), [], tsx);
    watchExit(p, `client worker ${w}`);
    p.send({ type: 'start', config: { url: `ws://127.0.0.1:${port}/ws`, count, terminalShare, slowShare, rampMs } });
    procs.push(p);
  }

  console.log(`Ramping ${clients} clients over ${rampMs} ms across ${procs.length} client processes...`);
  await guarded(sleep(rampMs + 3000));
  await guarded(stats(true));
  procs.forEach((p) => p.send({ type: 'measure' }));
  console.log(`Measuring for ${durationS}s...`);
  await guarded(sleep(durationS * 1000));

  const server1 = await guarded(stats());
  const reports = await guarded(Promise.all(
    procs.map(
      (p) =>
        new Promise<Record<string, unknown>>((resolve) => {
          p.once('message', (m: Record<string, unknown>) => resolve(m));
          p.send({ type: 'report' });
        })
    )
  ));

  const sum = (k: string) => reports.reduce((a, r) => a + (r[k] as number), 0);
  const latencies = reports.flatMap((r) => r.latencies as number[]);
  const closes: Record<string, number> = {};
  for (const r of reports) for (const [k, v] of Object.entries(r.closes as Record<string, number>)) closes[k] = (closes[k] ?? 0) + v;
  const healthy = sum('healthyClients');

  const result = {
    clients,
    expectedHealthy,
    opened: sum('opened'),
    failed: sum('failed'),
    healthyConnectedAtEnd: healthy,
    gatewayCpuPercent: server1.cpuPercent,
    eventLoopUtilization: server1.eventLoopUtilization,
    eventLoopDelayP99Ms: server1.eventLoopDelayP99Ms,
    rssMb: server1.rssMb,
    tickP50Ms: server1.tickP50Ms,
    tickP99Ms: server1.tickP99Ms,
    tickMaxMs: server1.tickMaxMs,
    frameLatencyP50Ms: pct(latencies, 0.5),
    frameLatencyP99Ms: pct(latencies, 0.99),
    bytesPerHealthyClientPerSec: healthy ? Math.round(sum('bytes') / healthy / durationS) : 0,
    framesPerHealthyClientPerSec: healthy ? Number((sum('frames') / healthy / durationS).toFixed(1)) : 0,
    gatewayFramesDropped: server1.framesDropped,
    slowConsumerDisconnects: server1.slowConsumerDisconnects,
    clientCloses: closes,
  };
  console.log(JSON.stringify(result, null, 2));

  finishing = true;
  procs.forEach((p) => p.send({ type: 'exit' }));
  // SIGTERM (not SIGKILL) lets --cpu-prof flush the profile when --profile is set.
  server.kill('SIGTERM');
  await new Promise((r) => server.once('exit', r));
  process.exit(0);
}

main().catch((err: Error) => {
  console.error(`Load test failed: ${err.message}`);
  for (const child of children) child.kill('SIGKILL');
  process.exit(1);
});
