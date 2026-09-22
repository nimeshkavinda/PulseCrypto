import { describe, it, expect } from 'vitest';
import { resolveHttpBaseUrl, resolveWsBaseUrl } from '../src/api/urlUtils';

describe('Unified URL Resolution Utilities (Task T5.5)', () => {
  describe('resolveHttpBaseUrl', () => {
    it('should convert ws:// to http:// and strip trailing /ws', () => {
      expect(resolveHttpBaseUrl('ws://localhost:8080/ws')).toBe('http://localhost:8080');
      expect(resolveHttpBaseUrl('ws://10.0.2.2:8080/ws/')).toBe('http://10.0.2.2:8080');
    });

    it('should convert wss:// to https:// and strip trailing /ws', () => {
      expect(resolveHttpBaseUrl('wss://api.pulsecrypto.com/ws')).toBe('https://api.pulsecrypto.com');
      expect(resolveHttpBaseUrl('wss://gateway.domain.com:9443/ws/')).toBe('https://gateway.domain.com:9443');
    });

    it('should preserve standard http and https base URLs', () => {
      expect(resolveHttpBaseUrl('http://localhost:8080')).toBe('http://localhost:8080');
      expect(resolveHttpBaseUrl('https://api.pulsecrypto.com/')).toBe('https://api.pulsecrypto.com');
    });

    it('should return fallback on empty input', () => {
      expect(resolveHttpBaseUrl('')).toBe('http://localhost:8080');
    });
  });

  describe('resolveWsBaseUrl', () => {
    it('should convert http:// to ws:// and ensure /ws path', () => {
      expect(resolveWsBaseUrl('http://localhost:8080')).toBe('ws://localhost:8080/ws');
      expect(resolveWsBaseUrl('http://10.0.2.2:8080/')).toBe('ws://10.0.2.2:8080/ws');
    });

    it('should convert https:// to wss:// and ensure /ws path', () => {
      expect(resolveWsBaseUrl('https://api.pulsecrypto.com')).toBe('wss://api.pulsecrypto.com/ws');
      expect(resolveWsBaseUrl('https://gateway.domain.com:9443/')).toBe('wss://gateway.domain.com:9443/ws');
    });

    it('should preserve ws and wss URLs with /ws path without duplicate /ws/ws', () => {
      expect(resolveWsBaseUrl('ws://localhost:8080/ws')).toBe('ws://localhost:8080/ws');
      expect(resolveWsBaseUrl('wss://api.pulsecrypto.com/ws/')).toBe('wss://api.pulsecrypto.com/ws');
    });

    it('should return fallback on empty input', () => {
      expect(resolveWsBaseUrl('')).toBe('ws://localhost:8080/ws');
    });
  });
});
