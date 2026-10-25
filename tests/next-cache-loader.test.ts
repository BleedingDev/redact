// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'

const loader = createRequire(import.meta.url)('../packages/redact/src/next/dev-cache-loader.cjs')
const source = `function wasServedFromCache() {
  try {
    const entry = performance.getEntriesByType('navigation')[0];
    return entry?.transferSize === 0;
  } catch { return false; }
}`

function isCached(entry: unknown) {
  return runInNewContext(loader(source) + '\nwasServedFromCache()', {
    performance: { getEntriesByType: () => [entry] },
  })
}

describe('Next 16.2 development cache detection', () => {
  it('keeps a streamed Firefox document on its live debug channel', () => {
    // Captured while a real streamed document was still arriving in Firefox.
    expect(isCached({ transferSize: 0, decodedBodySize: 0, responseEnd: 3 })).toBe(false)
  })

  it('retains cache restoration even when a real cached response ends at zero', () => {
    // Firefox rounds this cached navigation to zero at reduced clock precision.
    expect(isCached({ transferSize: 0, decodedBodySize: 280, responseEnd: 0 })).toBe(true)
    expect(isCached({ transferSize: 0, decodedBodySize: 280, responseEnd: 0.3 })).toBe(true)
  })

  it('does not classify network responses, empty bodies, or missing entries as cache hits', () => {
    expect(isCached({ transferSize: 580, decodedBodySize: 280 })).toBe(false)
    expect(isCached({ transferSize: 300, decodedBodySize: 0 })).toBe(false)
    expect(isCached({ transferSize: 0, decodedBodySize: 0 })).toBe(false)
    expect(isCached(undefined)).toBe(false)
    expect(runInNewContext(loader(source) + '\nwasServedFromCache()', {
      performance: { getEntriesByType() { throw new Error('unavailable') } },
    })).toBe(false)
  })

  it('preserves surrounding channel code and accepts an already corrected module', () => {
    const trailingCode = '\nfunction restore() { return sessionStorage.getItem("debug-channel"); }'
    const corrected = loader(source + trailingCode)
    expect(corrected.endsWith(trailingCode)).toBe(true)
    expect(loader(corrected)).toBe(corrected)
    const withoutCacheReplay = 'export function createDebugChannel() { return { readable: new ReadableStream() }; }'
    expect(loader(withoutCacheReplay)).toBe(withoutCacheReplay)
  })

  it('rejects unexpected or ambiguous changes to the affected predicate', () => {
    expect(() => loader(source.replace('entry?.transferSize === 0', 'someNewCacheCheck()'))).toThrow('Unsupported Next.js 16.2')
    expect(() => loader(source + source)).toThrow('Unsupported Next.js 16.2')
  })
})
