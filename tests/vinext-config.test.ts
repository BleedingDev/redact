// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { redact } from '../packages/redact/src/vinext'

describe('Vinext integration', () => {
  it('keeps RSC, SSR, and worker server environments on their original React implementation', () => {
    const plugin = redact()
    for (const name of ['rsc', 'ssr', 'worker']) {
      const config = { consumer: 'server', resolve: { alias: { react: 'native-react' } }, optimizeDeps: { include: ['react', 'react-dom/server', 'react-server-dom-webpack/server'] } }
      const original = structuredClone(config)
      expect(plugin.configEnvironment.handler(name, config)).toBeUndefined()
      expect(config).toEqual(original)
      expect(plugin.resolveId.handler.call({ environment: { name, config } }, 'react')).toBeNull()
    }
  })

  it('uses the React-compatible ID and Flight bridges only for exact browser entries', () => {
    const plugin = redact()
    const config: any = { consumer: 'client' }
    plugin.configEnvironment.handler('client', config)
    const resolve = (id: string) => plugin.resolveId.handler.call({ environment: { name: 'client', config } }, id)
    expect(resolve('react')).toMatch(/\/next\/react\.js$/)
    expect(resolve('react-dom/client')).toMatch(/\/next\/client\.js$/)
    for (const entry of ['react/jsx-runtime', 'react/jsx-dev-runtime', 'react/compiler-runtime', 'react-dom', 'react-dom/test-utils', 'scheduler']) expect(resolve(entry)).toMatch(/\/src\/.+\.js$/)
    for (const entry of ['react-dom/server', 'react-dom/server.edge', 'react-server-dom-webpack/client', 'react-native', 'react/unknown', 'react-dom/client/unknown']) expect(resolve(entry)).toBeNull()
  })

  it('prevents dependency optimization from restoring native browser React while preserving unrelated dependencies', () => {
    const config: any = {
      resolve: { alias: { custom: '/custom.js' }, dedupe: ['existing'] },
      optimizeDeps: { include: ['react', 'vinext > react-dom/client', 'react/jsx-runtime', 'react-server-dom-webpack/client', 'other'], exclude: ['existing'] },
    }
    redact().configEnvironment.handler('client', config)
    expect(config.optimizeDeps.include).toEqual(['react-server-dom-webpack/client', 'other'])
    expect(config.optimizeDeps.exclude).toEqual(expect.arrayContaining(['existing', 'react', 'react-dom/client', '@tanstack/redact']))
    expect(config.resolve.dedupe).toEqual(['existing'])
    expect(config.resolve.alias).toEqual({ custom: '/custom.js' })
  })

  it('supports named browser environments and preserves custom resolver functions', () => {
    const alias = { find: /^custom$/, replacement: '/custom.js', customResolver: () => null }
    const config: any = { consumer: 'client', resolve: { alias: [alias] } }
    const plugin = redact()
    plugin.configEnvironment.handler('browser', config)
    expect(config.resolve.alias.at(-1)).toBe(alias)
    expect(config.resolve.alias).toHaveLength(1)
    expect(plugin.resolveId.handler.call({ environment: { name: 'browser', config } }, 'react')).toMatch(/\/next\/react\.js$/)
  })
})
