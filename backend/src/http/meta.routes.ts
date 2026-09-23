import { FastifyInstance } from 'fastify';
import { MetadataService } from '../metadata.js';

export interface MetaRoutesOptions {
  metadata: MetadataService;
}

const PAIR_METADATA_JSON_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    required: [
      'symbol', 'displayName', 'baseAsset', 'quoteAsset', 'tradingStatus', 'priceDecimals',
      'qtyDecimals', 'high24h', 'low24h', 'volume24h', 'lastPrice', 'change24h',
    ],
    properties: {
      symbol: { type: 'string' },
      displayName: { type: 'string' },
      baseAsset: { type: 'string' },
      quoteAsset: { type: 'string' },
      tradingStatus: { type: 'string', enum: ['TRADING', 'HALTED', 'MAINTENANCE'] },
      priceDecimals: { type: 'integer' },
      qtyDecimals: { type: 'integer' },
      high24h: { type: 'number' },
      low24h: { type: 'number' },
      volume24h: { type: 'number' },
      lastPrice: { type: 'number' },
      change24h: { type: 'number' },
    },
  },
} as const;

/**
 * GET /pairs/meta: exchange reference data plus 24h statistics for every supported pair.
 * Serves upstream data only: 503 with Retry-After until the Binance bootstrap has completed.
 * Responses are serialized from a JSON schema and are cacheable for 2 s with a weak ETag.
 */
export async function metaRoutes(app: FastifyInstance, options: MetaRoutesOptions): Promise<void> {
  const schema = {
    response: {
      200: PAIR_METADATA_JSON_SCHEMA,
      304: { type: 'null' },
      503: {
        type: 'object',
        properties: { error: { type: 'string' }, message: { type: 'string' } },
      },
    },
  } as const;

  app.get('/pairs/meta', { schema }, async (request, reply) => {
    const { metadata } = options;
    if (!metadata.isReady()) {
      return reply
        .code(503)
        .header('Retry-After', '2')
        .header('Cache-Control', 'no-store')
        .send({ error: 'METADATA_UNAVAILABLE', message: 'Market metadata is still loading from the exchange' });
    }

    const etag = `W/"meta-${metadata.getContentVersion()}"`;
    reply.header('ETag', etag).header('Cache-Control', 'public, max-age=2');
    if (request.headers['if-none-match'] === etag) {
      return reply.code(304).send();
    }
    return metadata.getAll();
  });
}
