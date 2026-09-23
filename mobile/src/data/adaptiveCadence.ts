export interface NetworkCost {
  /** NetInfo `details.isConnectionExpensive` (metered / cellular data plans). */
  expensive: boolean;
  /** NetInfo connection type, e.g. 'wifi', 'cellular', 'none'. */
  type: string;
}

/** Slowest-by-default cadence applied on metered networks when adaptive mode is on. */
export const ADAPTIVE_METERED_CADENCE_MS = 500;

export interface CadenceDecision {
  /** Cadence to request from the gateway; null means the gateway default (its tick). */
  cadenceMs: number | null;
  /** True when adaptive mode is currently slowing the stream down. */
  adaptiveActive: boolean;
}

/**
 * Adaptive update rate: on metered connections (cellular or `isConnectionExpensive`) the stream
 * is slowed to at least ADAPTIVE_METERED_CADENCE_MS to save data and battery. It never makes the
 * stream faster than the user's own preference.
 */
export function effectiveCadence(preferenceMs: number | null, adaptive: boolean, network: NetworkCost): CadenceDecision {
  const metered = network.expensive || network.type === 'cellular';
  if (!adaptive || !metered || (preferenceMs !== null && preferenceMs >= ADAPTIVE_METERED_CADENCE_MS)) {
    return { cadenceMs: preferenceMs, adaptiveActive: false };
  }
  return { cadenceMs: ADAPTIVE_METERED_CADENCE_MS, adaptiveActive: true };
}
