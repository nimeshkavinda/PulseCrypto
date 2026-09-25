import { AppState, NativeEventSubscription } from 'react-native';
import { PerfMonitor } from '../../../modules/perf-monitor';

export interface PerfSamples {
  /** UI (main) thread frames per second from the native frame monitor; null if unavailable. */
  uiFps: number | null;
  /**
   * JS thread frames per second: frames the JS thread was free to serve (Android, measured
   * natively), or requestAnimationFrame callbacks per second (iOS, and wherever the native probe
   * is unavailable).
   */
  jsFps: number | null;
  /** Process memory footprint history in MB (oldest first); empty if unavailable. */
  memoryMb: number[];
  nativeAvailable: boolean;
}

const MEMORY_POINTS = 30;
/** `getJsFrameRate` value meaning the platform doesn't measure JS frames natively (iOS). */
const JS_NOT_NATIVE = -1;
const EMPTY: PerfSamples = { uiFps: null, jsFps: null, memoryMb: [], nativeAvailable: PerfMonitor !== null };

type Listener = () => void;

/**
 * One app-wide sampler shared by the Telemetry tab and the performance overlay. It runs only while
 * someone is subscribed: the rAF loop, the 1 s poll and the native frame monitor start with the
 * first subscriber and stop with the last, so two consumers never stop each other's monitor.
 * Each run starts from empty history, and sampling pauses while the app is in the background.
 */
class PerfSampler {
  private readonly listeners = new Set<Listener>();
  private snapshot: PerfSamples = EMPTY;
  private stopRun: (() => void) | null = null;
  private appState: NativeEventSubscription | null = null;

  public getSnapshot = (): PerfSamples => this.snapshot;

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) {
      // A backgrounded app draws nothing: pause instead of burning battery, resume on return.
      this.appState = AppState.addEventListener('change', (next) => {
        if (next === 'background') this.stop();
        else if (next === 'active' && !this.stopRun) this.start();
      });
      if (AppState.currentState !== 'background') this.start();
    }
    return () => {
      if (!this.listeners.delete(listener)) return;
      if (this.listeners.size === 0) {
        this.appState?.remove();
        this.appState = null;
        this.stop();
      }
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

    // rAF counting is the fallback JS measurement. It stops once the native module reports its own
    // JS frame rate (Android), where rAF delivery under-reports, and restarts if that reading fails.
    let jsFrames = 0;
    let raf = 0;
    let rafRunning = false;
    const loop = () => {
      jsFrames++;
      raf = requestAnimationFrame(loop);
    };
    const startRaf = () => {
      if (rafRunning) return;
      rafRunning = true;
      jsFrames = 0;
      raf = requestAnimationFrame(loop);
    };
    const stopRaf = () => {
      rafRunning = false;
      cancelAnimationFrame(raf);
    };
    startRaf();
    callNative((m) => m.startFrameMonitor());

    // Monotonic clock: a wall-clock adjustment must not produce negative or infinite rates.
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const rafFps = Math.round((jsFrames * 1000) / Math.max(1, now - last));
      jsFrames = 0;
      last = now;
      const ui = callNative((m) => m.getUiFrameRate());
      // A native build from before getJsFrameRate existed: treat it as "not measured natively"
      // rather than letting the TypeError switch off every native reading.
      const nativeJs = callNative((m) => (typeof m.getJsFrameRate === 'function' ? m.getJsFrameRate() : JS_NOT_NATIVE));
      let jsFps: number | null;
      if (nativeJs !== null && nativeJs !== JS_NOT_NATIVE) {
        stopRaf();
        // Before the first native window completes there is no reading yet; a real 0 (the JS
        // thread served no frames for a whole window) is shown as 0.
        jsFps = nativeJs >= 0 ? Math.round(nativeJs) : null;
      } else if (rafRunning) {
        jsFps = rafFps;
      } else {
        // The native reading just failed: fall back to rAF, which reports from the next window.
        startRaf();
        jsFps = null;
      }
      const bytes = callNative((m) => m.getMemoryFootprintBytes());
      this.publish({
        jsFps,
        // A later call in this tick may have switched native readings off; don't write back a
        // UI rate that callNative just cleared.
        ...(ui !== null && native !== null ? { uiFps: ui > 0 ? Math.round(ui) : null } : {}),
        ...(bytes !== null && bytes > 0
          ? { memoryMb: [...this.snapshot.memoryMb.slice(-(MEMORY_POINTS - 1)), bytes / (1024 * 1024)] }
          : {}),
      });
    }, 1000);

    this.stopRun = () => {
      stopRaf();
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
    // The next run must not show this run's figures, even for one render.
    this.snapshot = EMPTY;
  }
}

export const perfSampler = new PerfSampler();
