import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { resolveHttpBaseUrl, resolveWsBaseUrl } from '../api/urlUtils';
import { defaultStorage } from '../storage/storageRepository';

export type GatewaySource = 'override' | 'env' | 'app-config' | 'default';

export interface GatewayConfig {
  wsUrl: string;
  httpUrl: string;
  source: GatewaySource;
}

export interface GatewayInputs {
  /** User override from Settings; only honoured in development builds. */
  override: string | null;
  env: string | undefined;
  appConfig: string | undefined;
  platform: string;
  isDev: boolean;
}

/** Local gateway as seen from a simulator: the Android emulator reaches the host via 10.0.2.2. */
export function platformDefaultGatewayUrl(platform: string): string {
  return `ws://${platform === 'android' ? '10.0.2.2' : 'localhost'}:8080/ws`;
}

/** Precedence: dev override → EXPO_PUBLIC_GATEWAY_URL → expo.extra.gatewayUrl → platform default. */
export function resolveGatewayConfig(inputs: GatewayInputs): GatewayConfig {
  const pick = (): [string, GatewaySource] => {
    if (inputs.isDev && inputs.override) return [inputs.override, 'override'];
    if (inputs.env) return [inputs.env, 'env'];
    if (inputs.appConfig) return [inputs.appConfig, 'app-config'];
    return [platformDefaultGatewayUrl(inputs.platform), 'default'];
  };
  const [url, source] = pick();
  return { wsUrl: resolveWsBaseUrl(url), httpUrl: resolveHttpBaseUrl(url), source };
}

/** Resolves the gateway for this app instance from real platform inputs. */
export function currentGatewayConfig(): GatewayConfig {
  const extra = Constants.expoConfig?.extra as { gatewayUrl?: string } | undefined;
  return resolveGatewayConfig({
    override: defaultStorage.getGatewayOverride(),
    // Must be a static `process.env.EXPO_PUBLIC_*` reference so Expo inlines it at build time.
    env: process.env.EXPO_PUBLIC_GATEWAY_URL,
    appConfig: extra?.gatewayUrl,
    platform: Platform.OS,
    isDev: __DEV__,
  });
}
