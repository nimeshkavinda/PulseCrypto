import { PerfMonitor } from '../../../modules/perf-monitor';

export interface PerfSamples {
  /** UI (main) thread frames per second from the native frame monitor; null if unavailable. */
  uiFps: number | null;
  /** JS thread frames per second (requestAnimationFrame callbacks per second). */
  jsFps: number | null;
  /** Process memory footprint history in MB (oldest first); empty if unavailable. */
  memoryMb: number[];
  nativeAvailable: boolean;
}

const MEMORY_POINTS = 30;
const EMPTY: PerfSamples = { uiFps: null, jsFps: null, memoryMb: [], nativeAvailable: PerfMonitor !== null };

type Listener = () => void;

/**
 * One app-wide sampler shared by the Telemetry tab and the performance overlay. It runs only while
 * someone is subscribed: the rAF loop, the 1 s poll and the native frame monitor start with the
 * first subscriber and stop with the last, so two consumers never stop each other's monitor.
 * Each run starts from empty history.
 */
class PerfSampler {
  private readonly listeners = new Set<Listener>();
  private snapshot: PerfSamples = EMPTY;
  private stopRun: (() => void) | null = null;

  public getSnapshot = (): PerfSamples => this.snapshot;

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.start();
    return () => {
      if (!this.listeners.delete(listener)) return;
      if (this.listeners.size === 0) this.stop();
    };
  };

  private publish(next: Partial<PerfSamples>) {
    this.snapshot = { ...this.snapshot, ...next };
    this.listeners.forEach((l) => l());
  }

  private start() {
    this.snapshot = EMPTY;

    // A native call that throws turns the native readings off for this run instead of crashing;
    // the UI then says "unavailable".
    let native = PerfMonitor;
    const callNative = <T,>(fn: (m: NonNullable<typeof PerfMonitor>) => T): T | null => {
      if (!native) return null;
      try {
        return fn(native);
      } catch (err) {
        if (__DEV__) console.warn('[perf] native monitor failed', err);
        native = null;
        this.publish({ nativeAvailable: false, uiFps: null });
        return null;
      }
    };

    let jsFrames = 0;
    let raf = 0;
    const loop = () => {
      jsFrames++;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    callNative((m) => m.startFrameMonitor());

    let last = Date.now();
    const id = setInterval(() => {
      const now = Date.now();
      const jsFps = Math.round((jsFrames * 1000) / (now - last));
      jsFrames = 0;
      last = now;
      const ui = callNative((m) => m.getUiFrameRate());
      const bytes = callNative((m) => m.getMemoryFootprintBytes());
      this.publish({
        jsFps,
        ...(ui !== null ? { uiFps: ui > 0 ? Math.round(ui) : null } : {}),
        ...(bytes !== null && bytes > 0
          ? { memoryMb: [...this.snapshot.memoryMb.slice(-(MEMORY_POINTS - 1)), bytes / (1024 * 1024)] }
          : {}),
      });
    }, 1000);

    this.stopRun = () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
      // Always stop the native monitor, even after a failed call switched readings off: otherwise
      // the Android Choreographer callback keeps running.
      try {
        PerfMonitor?.stopFrameMonitor();
      } catch {
        // nothing more to do
      }
    };
  }

  private stop() {
    this.stopRun?.();
    this.stopRun = null;
  }
}

export const perfSampler = new PerfSampler();
