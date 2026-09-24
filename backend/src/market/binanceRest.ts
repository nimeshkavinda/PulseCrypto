import { z } from 'zod';
import { SUPPORTED_PAIRS, SupportedPairSymbol } from '@pulsecrypto/shared';
import { PairStaticInfo, Ticker24h } from '../metadata.js';

export const DEFAULT_BINANCE_REST_URL = 'https://api.binance.com';

const Ticker24hResponse = z.array(
  z.object({
    symbol: z.string(),
    lastPrice: z.string(),
    highPrice: z.string(),
    lowPrice: z.string(),
    volume: z.string(),
    priceChangePercent: z.string(),
    closeTime: z.number(),
  })
);

const ExchangeInfoResponse = z.object({
  symbols: z.array(
    z.object({
      symbol: z.string(),
      status: z.string(),
      baseAsset: z.string(),
      quoteAsset: z.string(),
      filters: z.array(z.object({ filterType: z.string() }).passthrough()),
    })
  ),
});

export interface BinanceRestClient {
  fetchTickers24h(pairs: SupportedPairSymbol[]): Promise<Map<SupportedPairSymbol, Ticker24h>>;
  fetchExchangeInfo(pairs: SupportedPairSymbol[]): Promise<Map<SupportedPairSymbol, PairStaticInfo>>;
}

export interface BinanceRestOptions {
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

/** Number of decimals implied by a Binance step such as "0.01000000" (2) or "1.00000000" (0). */
export function decimalsFromStep(step: string): number {
  const [, fraction = ''] = step.split('.');
  const trimmed = fraction.replace(/0+$/, '');
  return trimmed.length;
}

export function mapTradingStatus(status: string): PairStaticInfo['tradingStatus'] {
  if (status === 'TRADING') return 'TRADING';
  if (status === 'HALT') return 'HALTED';
  return 'MAINTENANCE';
}

export function createBinanceRestClient(options: BinanceRestOptions = {}): BinanceRestClient {
  const base = (options.baseUrl ?? DEFAULT_BINANCE_REST_URL).replace(/\/+$/, '');
  const timeoutMs = options.timeoutMs ?? 5000;
  const doFetch = options.fetch ?? fetch;

  async function getJson(path: string): Promise<unknown> {
    const res = await doFetch(`${base}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`Binance REST ${path.split('?')[0]} responded ${res.status}`);
    return res.json();
  }

  const symbolsParam = (pairs: SupportedPairSymbol[]) => encodeURIComponent(JSON.stringify(pairs));

  return {
    async fetchTickers24h(pairs) {
      const body = Ticker24hResponse.parse(await getJson(`/api/v3/ticker/24hr?symbols=${symbolsParam(pairs)}`));
      const out = new Map<SupportedPairSymbol, Ticker24h>();
      for (const t of body) {
        if (!pairs.includes(t.symbol as SupportedPairSymbol)) continue;
        out.set(t.symbol as SupportedPairSymbol, {
          lastPrice: Number(t.lastPrice),
          high24h: Number(t.highPrice),
          low24h: Number(t.lowPrice),
          volume24h: Number(t.volume),
          changePct: Number(t.priceChangePercent),
          eventTs: t.closeTime,
        });
      }
      return out;
    },

    async fetchExchangeInfo(pairs) {
      const body = ExchangeInfoResponse.parse(await getJson(`/api/v3/exchangeInfo?symbols=${symbolsParam(pairs)}`));
      const out = new Map<SupportedPairSymbol, PairStaticInfo>();
      for (const s of body.symbols) {
        const pair = s.symbol as SupportedPairSymbol;
        if (!pairs.includes(pair)) continue;
        const priceFilter = s.filters.find((f) => f.filterType === 'PRICE_FILTER') as { tickSize?: string } | undefined;
        const lotSize = s.filters.find((f) => f.filterType === 'LOT_SIZE') as { stepSize?: string } | undefined;
        out.set(pair, {
          displayName: SUPPORTED_PAIRS[pair].displayName,
          baseAsset: s.baseAsset,
          quoteAsset: s.quoteAsset,
          tradingStatus: mapTradingStatus(s.status),
          priceDecimals: priceFilter?.tickSize ? decimalsFromStep(priceFilter.tickSize) : SUPPORTED_PAIRS[pair].priceDecimals,
          qtyDecimals: lotSize?.stepSize ? decimalsFromStep(lotSize.stepSize) : SUPPORTED_PAIRS[pair].qtyDecimals,
        });
      }
      return out;
    },
  };
}
