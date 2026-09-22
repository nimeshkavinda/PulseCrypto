/**
 * Unified URL resolution utilities for WebSocket and HTTP gateway endpoints.
 * Single-sources protocol conversion and path normalization across the mobile app.
 */

/**
 * Translates a WebSocket or HTTP URL into a standardized HTTP base URL (without trailing slash or /ws).
 * e.g., 'ws://10.0.2.2:8080/ws'   -> 'http://10.0.2.2:8080'
 *       'wss://api.example.com/ws' -> 'https://api.example.com'
 *       'http://localhost:8080'    -> 'http://localhost:8080'
 */
export function resolveHttpBaseUrl(url: string): string {
  if (!url) return 'http://localhost:8080';

  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.startsWith('ws')
      ? parsed.protocol === 'wss:'
        ? 'https:'
        : 'http:'
      : parsed.protocol;
    return `${protocol}//${parsed.host}`;
  } catch {
    const replaced = url.replace(/^wss?:\/\//i, (match) =>
      match.toLowerCase().startsWith('wss') ? 'https://' : 'http://'
    );
    return replaced.replace(/\/ws\/?$/i, '').replace(/\/+$/, '');
  }
}

/**
 * Translates an HTTP or WebSocket URL into a standardized WebSocket stream URL (with /ws path).
 * e.g., 'http://10.0.2.2:8080'       -> 'ws://10.0.2.2:8080/ws'
 *       'https://api.example.com'    -> 'wss://api.example.com/ws'
 *       'ws://localhost:8080/ws'     -> 'ws://localhost:8080/ws'
 */
export function resolveWsBaseUrl(url: string): string {
  if (!url) return 'ws://localhost:8080/ws';

  try {
    const parsed = new URL(url);
    const protocol = parsed.protocol.startsWith('http')
      ? parsed.protocol === 'https:'
        ? 'wss:'
        : 'ws:'
      : parsed.protocol;
    const cleanPath = parsed.pathname.replace(/\/ws\/?$/i, '').replace(/\/+$/, '');
    return `${protocol}//${parsed.host}${cleanPath}/ws`;
  } catch {
    const replaced = url.replace(/^https?:\/\//i, (match) =>
      match.toLowerCase().startsWith('https') ? 'wss://' : 'ws://'
    );
    const trimmed = replaced.replace(/\/ws\/?$/i, '').replace(/\/+$/, '');
    return `${trimmed}/ws`;
  }
}
