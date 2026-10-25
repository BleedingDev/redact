// Every application isolate uses one cache coordinator. Cached values retain
// Vinext's own tag and expiry semantics, including binary Flight payloads.
export default class HostedCache {
  constructor({ env }) { this.env = env }
  get(...args) { return this.env.REDACT_TEST_STATE.cache(this.env.REDACT_CACHE_NAMESPACE, 'get', args) }
  set(...args) { return this.env.REDACT_TEST_STATE.cache(this.env.REDACT_CACHE_NAMESPACE, 'set', args) }
  revalidateTag(...args) { return this.env.REDACT_TEST_STATE.cache(this.env.REDACT_CACHE_NAMESPACE, 'revalidateTag', args) }
  resetRequestCache() {}
}
