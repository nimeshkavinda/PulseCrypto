import { PairMetadata, PairMetadataSchema } from '@pulsecrypto/shared';
import { z } from 'zod';

const PairsMetadataArraySchema = z.array(PairMetadataSchema);

export class MetadataUnavailableError extends Error {
  constructor(
    message: string,
    /** Seconds to wait before retrying, from the gateway's Retry-After header. */
    public readonly retryAfterS: number | null = null
  ) {
    super(message);
    this.name = 'MetadataUnavailableError';
  }
}

/**
 * GET /pairs/meta. Throws on failure; callers show the error or cached state.
 * No fallback values are ever substituted for exchange data.
 */
export async function fetchPairsMetadata(httpBaseUrl: string, timeoutMs = 5000): Promise<PairMetadata[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${httpBaseUrl}/pairs/meta`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (response.status === 503) {
      const retry = Number(response.headers.get('Retry-After'));
      throw new MetadataUnavailableError('Market metadata is still loading', Number.isFinite(retry) ? retry : null);
    }
    if (!response.ok) throw new Error(`GET /pairs/meta failed: HTTP ${response.status}`);
    return PairsMetadataArraySchema.parse(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}
