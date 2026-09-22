import WebSocket from 'ws';
import { ClientCommandSchema, ClientCommand } from '@pulsecrypto/shared';
import { ClientSession } from '../conflator.js';

/**
 * Safely sends a string payload over a WebSocket connection.
 * Guards with readyState === WebSocket.OPEN and catches any synchronous throw.
 */
export function sendSafe(socket: WebSocket, data: string): boolean {
  if (socket.readyState === WebSocket.OPEN) {
    try {
      socket.send(data);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Safely sends an error reply to a client session.
 * Rate-limits error responses to at most 1 per second per session to prevent spam.
 */
export function sendSafeError(
  session: ClientSession,
  message: string,
  extra?: Record<string, unknown>
): void {
  const now = Date.now();
  if (now - session.lastErrorTimestamp < 1000) {
    return;
  }
  session.lastErrorTimestamp = now;

  sendSafe(
    session.socket,
    JSON.stringify({ type: 'error', message, ...extra })
  );
}

/**
 * Handles incoming client command frames (ping, setThrottle, subscribe, unsubscribe).
 */
export function handleClientMessage(session: ClientSession, rawData: WebSocket.RawData): void {
  try {
    const parsed = JSON.parse(rawData.toString());
    const validation = ClientCommandSchema.safeParse(parsed);
    if (!validation.success) {
      sendSafeError(session, 'Invalid command payload', { errors: validation.error.format() });
      return;
    }

    const command: ClientCommand = validation.data;
    switch (command.action) {
      case 'setThrottle':
        session.intervalMs = command.intervalMs;
        break;

      case 'subscribe':
        for (const pair of command.pairs) {
          session.subscribedPairs.add(pair);
        }
        break;

      case 'unsubscribe':
        for (const pair of command.pairs) {
          session.subscribedPairs.delete(pair);
        }
        break;

      case 'ping':
        sendSafe(session.socket, JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
    }
  } catch {
    sendSafeError(session, 'Malformed JSON');
  }
}
