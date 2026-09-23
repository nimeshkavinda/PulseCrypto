import client from 'prom-client';

export class MetricsRegistry {
  public readonly registry: client.Registry;
  public readonly wsMessagesReceived: client.Counter<'stream' | 'symbol'>;
  public readonly connectedClients: client.Gauge<string>;
  public readonly laggingClients: client.Gauge<string>;
  public readonly framesSent: client.Counter<string>;
  public readonly framesDropped: client.Counter<string>;
  public readonly bytesSent: client.Counter<string>;
  public readonly slowConsumerDisconnects: client.Counter<string>;
  public readonly tickDuration: client.Histogram<string>;
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

    this.connectedClients = new client.Gauge({
      name: 'pulsecrypto_connected_clients',
      help: 'Current count of connected WebSocket clients',
      registers: [this.registry],
    });

    this.laggingClients = new client.Gauge({
      name: 'pulsecrypto_lagging_clients',
      help: 'Clients whose socket buffer exceeded the soft limit on the last tick',
      registers: [this.registry],
    });

    this.framesSent = new client.Counter({
      name: 'pulsecrypto_frames_sent_total',
      help: 'WebSocket frames sent to clients (data and control)',
      registers: [this.registry],
    });

    this.framesDropped = new client.Counter({
      name: 'pulsecrypto_frames_dropped_total',
      help: 'Data frames skipped because the client socket buffer was above the soft limit',
      registers: [this.registry],
    });

    this.bytesSent = new client.Counter({
      name: 'pulsecrypto_bytes_sent_total',
      help: 'Bytes of frame payload sent to clients',
      registers: [this.registry],
    });

    this.slowConsumerDisconnects = new client.Counter({
      name: 'pulsecrypto_slow_consumer_disconnects_total',
      help: 'Clients closed with 1013 for exceeding the hard buffer limit or the lag grace period',
      registers: [this.registry],
    });

    this.tickDuration = new client.Histogram({
      name: 'pulsecrypto_tick_duration_seconds',
      help: 'Time spent per fan-out tick across all clients',
      buckets: [0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1],
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
