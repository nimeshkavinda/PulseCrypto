import client from 'prom-client';

export class MetricsRegistry {
  public readonly registry: client.Registry;
  public readonly wsMessagesReceived: client.Counter<'stream' | 'symbol'>;
  public readonly wsBroadcastsSent: client.Counter<'symbol'>;
  public readonly connectedClients: client.Gauge<string>;
  public readonly backpressureSheddingClients: client.Gauge<string>;
  public readonly conflationDuration: client.Histogram<string>;
  public readonly binanceConnectionStatus: client.Gauge<string>;

  constructor() {
    this.registry = new client.Registry();

    // Collect default Node.js runtime metrics
    client.collectDefaultMetrics({
      register: this.registry,
      prefix: 'pulsecrypto_',
    });

    this.wsMessagesReceived = new client.Counter({
      name: 'pulsecrypto_ws_messages_received_total',
      help: 'Total number of WebSocket messages received from Binance streams',
      labelNames: ['stream', 'symbol'],
      registers: [this.registry],
    });

    this.wsBroadcastsSent = new client.Counter({
      name: 'pulsecrypto_ws_broadcasts_sent_total',
      help: 'Total number of conflated market snapshots broadcast to mobile clients',
      labelNames: ['symbol'],
      registers: [this.registry],
    });

    this.connectedClients = new client.Gauge({
      name: 'pulsecrypto_connected_clients',
      help: 'Current count of connected mobile WebSocket clients',
      registers: [this.registry],
    });

    this.backpressureSheddingClients = new client.Gauge({
      name: 'pulsecrypto_backpressure_shedding_clients',
      help: 'Number of connected clients currently experiencing depth-shedding backpressure',
      registers: [this.registry],
    });

    this.conflationDuration = new client.Histogram({
      name: 'pulsecrypto_conflation_duration_seconds',
      help: 'Time spent aggregating order books and conflating payloads per cycle',
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
      registers: [this.registry],
    });

    this.binanceConnectionStatus = new client.Gauge({
      name: 'pulsecrypto_binance_connection_status',
      help: 'Binance upstream WebSocket connection status (1 = connected, 0 = disconnected)',
      registers: [this.registry],
    });
  }

  public async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  public getContentType(): string {
    return this.registry.contentType;
  }
}

export const defaultMetrics = new MetricsRegistry();
