import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocketServer, WebSocket } from 'ws';
import { BinanceConnector } from '../src/binance.js';
import { MetricsRegistry } from '../src/metrics.js';

describe('BinanceConnector Ingestion & Resiliency (Task T2.2)', () => {
  let mockServer: WebSocketServer;
  let serverPort: number;

  beforeEach(async () => {
    mockServer = new WebSocketServer({ port: 0 });
    await new Promise<void>((resolve) => {
      mockServer.on('listening', () => {
        const addr = mockServer.address();
        serverPort = typeof addr === 'object' && addr ? addr.port : 9999;
        resolve();
      });
    });
  });

  afterEach(async () => {
    if (mockServer) {
      for (const client of mockServer.clients) {
        client.terminate();
      }
      await new Promise<void>((resolve) => {
        mockServer.close(() => resolve());
      });
    }
  });

  it('should connect to Binance stream and receive depth20 events', async () => {
    const metrics = new MetricsRegistry();
    const connector = new BinanceConnector({
      baseUrl: `ws://127.0.0.1:${serverPort}`,
      metrics,
    });

    let receivedSymbol = '';
    let receivedBids: [number, number][] = [];
    let receivedAsks: [number, number][] = [];

    connector.onDepth((symbol, bids, asks) => {
      receivedSymbol = symbol;
      receivedBids = bids;
      receivedAsks = asks;
    });

    const connPromise = new Promise<WebSocket>((resolve) => {
      mockServer.once('connection', (ws) => resolve(ws));
    });

    connector.connect();
    const ws = await connPromise;

    const depthPayload = {
      stream: 'btcusdt@depth20@100ms',
      data: {
        lastUpdateId: 1029384,
        bids: [
          ['64000.5', '1.5'],
          ['63990.0', '2.0'],
        ],
        asks: [
          ['64010.0', '0.8'],
          ['64020.5', '1.2'],
        ],
      },
    };

    ws.send(JSON.stringify(depthPayload));

    await new Promise((r) => setTimeout(r, 50));

    expect(receivedSymbol).toBe('BTCUSDT');
    expect(receivedBids).toEqual([
      [64000.5, 1.5],
      [63990.0, 2.0],
    ]);
    expect(receivedAsks).toEqual([
      [64010.0, 0.8],
      [64020.5, 1.2],
    ]);

    connector.disconnect();
    ws.terminate();
  });

  it('should parse miniTicker batch updates and dispatch ticker callback', async () => {
    const connector = new BinanceConnector({
      baseUrl: `ws://127.0.0.1:${serverPort}`,
    });

    let tickerUpdates: Parameters<import('../src/binance.js').TickerUpdateHandler>[0] = [];
    connector.onTicker((updates) => {
      tickerUpdates = updates;
    });

    const connPromise = new Promise<WebSocket>((resolve) => {
      mockServer.once('connection', (ws) => resolve(ws));
    });

    connector.connect();
    const ws = await connPromise;

    const tickerPayload = {
      stream: '!miniTicker@arr',
      data: [
        { s: 'BTCUSDT', c: '64500.0', h: '65000.0', l: '63000.0', v: '2500.0' },
        { s: 'ETHUSDT', c: '3500.0', h: '3600.0', l: '3400.0', v: '15000.0' },
        { s: 'IGNOREME', c: '1.0', h: '2.0', l: '0.5', v: '100.0' },
      ],
    };

    ws.send(JSON.stringify(tickerPayload));
    await new Promise((r) => setTimeout(r, 50));

    expect(tickerUpdates).toHaveLength(2);
    expect(tickerUpdates[0]).toEqual({
      symbol: 'BTCUSDT',
      lastPrice: 64500.0,
      high24h: 65000.0,
      low24h: 63000.0,
      volume24h: 2500.0,
    });
    expect(tickerUpdates[1].symbol).toBe('ETHUSDT');

    connector.disconnect();
    ws.terminate();
  });

  it('should cleanly disconnect and update status', async () => {
    const metrics = new MetricsRegistry();
    const connector = new BinanceConnector({
      baseUrl: `ws://127.0.0.1:${serverPort}`,
      metrics,
    });

    let status = false;
    connector.onStatus((s) => {
      status = s;
    });

    const connPromise = new Promise<WebSocket>((resolve) => {
      mockServer.once('connection', (ws) => resolve(ws));
    });

    const openPromise = new Promise<void>((resolve) => {
      connector.onStatus((connected) => {
        if (connected) resolve();
      });
    });

    connector.connect();
    const ws = await connPromise;
    await openPromise;

    expect(connector.isConnected()).toBe(true);

    connector.disconnect();
    expect(connector.isConnected()).toBe(false);
    expect(status).toBe(false);
    ws.terminate();
  });

  it('should drop non-finite depth levels and non-finite miniTicker items without propagating NaN', async () => {
    const connector = new BinanceConnector({
      baseUrl: `ws://127.0.0.1:${serverPort}`,
    });

    let receivedBids: [number, number][] = [];
    let receivedAsks: [number, number][] = [];
    connector.onDepth((_sym, bids, asks) => {
      receivedBids = bids;
      receivedAsks = asks;
    });

    let tickerUpdates: Parameters<import('../src/binance.js').TickerUpdateHandler>[0] = [];
    connector.onTicker((updates) => {
      tickerUpdates = updates;
    });

    const connPromise = new Promise<WebSocket>((resolve) => {
      mockServer.once('connection', (ws) => resolve(ws));
    });

    connector.connect();
    const ws = await connPromise;

    // Send malformed depth containing NaN, Infinity, -Infinity, negative price
    ws.send(
      JSON.stringify({
        stream: 'btcusdt@depth20@100ms',
        data: {
          bids: [
            ['64000.0', '1.0'],
            ['NaN', '2.0'],
            ['Infinity', '1.0'],
            ['-50.0', '1.0'],
          ],
          asks: [
            ['64100.0', '1.5'],
            ['64200.0', 'NaN'],
          ],
        },
      })
    );

    // Send malformed ticker containing non-finite prices
    ws.send(
      JSON.stringify({
        stream: '!miniTicker@arr',
        data: [
          { s: 'BTCUSDT', c: 'NaN', h: '65000', l: '63000', v: '100' },
          { s: 'ETHUSDT', c: '3500', h: '3600', l: '3400', v: '1000' },
        ],
      })
    );

    await new Promise((r) => setTimeout(r, 50));

    // Non-finite depth levels dropped
    expect(receivedBids).toEqual([[64000.0, 1.0]]);
    expect(receivedAsks).toEqual([[64100.0, 1.5]]);

    // Non-finite miniTicker item dropped entirely, valid one retained
    expect(tickerUpdates).toHaveLength(1);
    expect(tickerUpdates[0].symbol).toBe('ETHUSDT');

    connector.disconnect();
    ws.terminate();
  });
});
