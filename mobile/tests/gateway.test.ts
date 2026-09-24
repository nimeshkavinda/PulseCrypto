import { platformDefaultGatewayUrl, resolveGatewayConfig } from '../src/config/gateway';

const base = { override: null, env: undefined, appConfig: undefined, platform: 'ios', isDev: true };

describe('gateway configuration precedence', () => {
  it('uses the platform default when nothing is configured', () => {
    expect(resolveGatewayConfig(base)).toEqual({ wsUrl: 'ws://localhost:8080/ws', httpUrl: 'http://localhost:8080', source: 'default' });
    expect(platformDefaultGatewayUrl('android')).toBe('ws://10.0.2.2:8080/ws');
  });

  it('prefers EXPO_PUBLIC_GATEWAY_URL over app config and the default', () => {
    const c = resolveGatewayConfig({ ...base, env: 'ws://192.168.1.20:8080/ws', appConfig: 'wss://app.example/ws' });
    expect(c).toMatchObject({ wsUrl: 'ws://192.168.1.20:8080/ws', source: 'env' });
  });

  it('uses app config when no env var is set', () => {
    expect(resolveGatewayConfig({ ...base, appConfig: 'https://api.example' })).toEqual({
      wsUrl: 'wss://api.example/ws',
      httpUrl: 'https://api.example',
      source: 'app-config',
    });
  });

  it('honours the user override in development builds only', () => {
    const inputs = { ...base, override: 'ws://10.0.0.5:8080/ws', env: 'ws://env/ws' };
    expect(resolveGatewayConfig(inputs).source).toBe('override');
    expect(resolveGatewayConfig({ ...inputs, isDev: false }).source).toBe('env');
  });
});
