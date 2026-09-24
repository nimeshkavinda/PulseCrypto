import { Book, SupportedPairSymbol, Ticker } from '@pulsecrypto/shared';

export function ticker(pair: SupportedPairSymbol, price: number, updatedAt = 1_700_000_000_000): Ticker {
  return { pair, price, change24h: 1.2, high24h: price * 1.01, low24h: price * 0.99, volume24h: 1000, updatedAt, eventTs: updatedAt - 3 };
}

export function book(pair: SupportedPairSymbol, bid = 100, updatedAt = 1_700_000_000_000): Book {
  return {
    pair,
    updatedAt,
    eventTs: null,
    spread: 1,
    spreadPct: 1,
    buyPressure: 60,
    sellPressure: 40,
    bids: [[bid, 2, bid * 2]],
    asks: [[bid + 1, 1, bid + 1]],
  };
}
