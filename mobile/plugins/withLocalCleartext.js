/* eslint-disable no-undef, @typescript-eslint/no-require-imports */
/**
 * Android network security config.
 *
 * - Release: cleartext (ws:// / http://) is allowed ONLY to loopback hosts, so a release build can be
 *   tested against a gateway on the developer machine (emulator → 10.0.2.2) while every other host
 *   still requires TLS.
 * - Debug: cleartext is allowed everywhere, so a development build on a physical device can load
 *   the bundle from Metro and reach a gateway over the LAN. On API 24+ a network security config
 *   overrides `usesCleartextTraffic`, so the debug source set ships its own file with the same name,
 *   which Android resource merging picks over the main one.
 *
 * iOS ATS already permits local networking only.
 */
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const RELEASE_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">localhost</domain>
    <domain includeSubdomains="false">127.0.0.1</domain>
    <domain includeSubdomains="false">10.0.2.2</domain>
  </domain-config>
</network-security-config>
`;

const DEBUG_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="true" />
</network-security-config>
`;

function writeConfig(projectRoot, sourceSet, xml) {
  const dir = path.join(projectRoot, 'app', 'src', sourceSet, 'res', 'xml');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'network_security_config.xml'), xml);
}

function withLocalCleartext(config) {
  config = withDangerousMod(config, [
    'android',
    async (cfg) => {
      writeConfig(cfg.modRequest.platformProjectRoot, 'main', RELEASE_XML);
      writeConfig(cfg.modRequest.platformProjectRoot, 'debug', DEBUG_XML);
      return cfg;
    },
  ]);
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    if (app) app.$['android:networkSecurityConfig'] = '@xml/network_security_config';
    return cfg;
  });
}

module.exports = withLocalCleartext;
module.exports.RELEASE_XML = RELEASE_XML;
module.exports.DEBUG_XML = DEBUG_XML;
