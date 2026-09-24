/* eslint-disable @typescript-eslint/no-require-imports */
const { RELEASE_XML, DEBUG_XML } = require('../plugins/withLocalCleartext');

describe('Android network security config plugin', () => {
  it('limits release cleartext to loopback hosts', () => {
    expect(RELEASE_XML).toContain('<base-config cleartextTrafficPermitted="false" />');
    const domains = [...RELEASE_XML.matchAll(/<domain [^>]*>([^<]+)<\/domain>/g)].map((m) => m[1]);
    expect(domains).toEqual(['localhost', '127.0.0.1', '10.0.2.2']);
  });

  it('allows cleartext in debug builds so a physical device can reach Metro and a LAN gateway', () => {
    expect(DEBUG_XML).toContain('<base-config cleartextTrafficPermitted="true" />');
  });
});
