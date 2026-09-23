import { requireOptionalNativeModule } from 'expo';

interface PerfMonitorNative {
  /** Physical memory attributed to this process, in bytes (iOS: phys_footprint, Android: total PSS). */
  getMemoryFootprintBytes(): number;
  /** Starts counting UI-thread frames (CADisplayLink / Choreographer). Idempotent. */
  startFrameMonitor(): void;
  stopFrameMonitor(): void;
  /** Frames per second over the last completed 1 s window; 0 until a window completes. */
  getUiFrameRate(): number;
}

/**
 * Native performance probes, or null where the module is not compiled in (Expo Go, tests).
 * Callers must show "unavailable" rather than estimate when this is null.
 */
export const PerfMonitor = requireOptionalNativeModule<PerfMonitorNative>('PerfMonitor');
