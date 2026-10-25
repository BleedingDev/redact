// @vitest-environment node
import { expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { correctFlightTimings } from '../packages/redact/src/vinext/flight-timing'

const require = createRequire(import.meta.url)
const { parseAst } = createRequire(require.resolve('vite'))('rollup/parseAst')
const id = '/node_modules/react-server-dom-webpack/cjs/react-server-dom-webpack-client.browser.development.js'
const source = `(childrenEndTime, trackIdx, performance) => {
  const supportsUserTiming = true, trackNames = Array.from({length: 10}, (_, i) => 'track ' + i);
  if (supportsUserTiming) {
    performance.measure('Content Errored', { start: 0, end: childrenEndTime, detail: { devtools: { track: trackNames[trackIdx] } } });
    performance.clearMeasures('Content Errored');
  }
}`

it('preserves valid Flight measurements and skips uninitialized or invalid tracks', () => {
  const original = runInNewContext(source)
  const fixed = runInNewContext(correctFlightTimings(source, id, parseAst)!)
  const calls: unknown[] = []
  const performance = {
    measure(name: string, options: { end: number }) {
      if (options.end < 0) throw new Error('end cannot be negative')
      calls.push([name, options])
    },
    clearMeasures(name: string) { calls.push(['clear', name]) },
  }
  expect(() => original(-8.478078109386843, 0, performance)).toThrow('end cannot be negative')
  for (const end of [-Infinity, -8.478078109386843, -1, NaN]) fixed(end, 0, performance)
  fixed(10, 10, performance)
  expect(calls).toEqual([])
  for (const end of [0, 10]) {
    original(end, 0, performance)
    const originalCalls = calls.splice(0)
    fixed(end, 0, performance)
    expect(calls.splice(0)).toEqual(originalCalls)
  }
})

it('does not catch valid measurement errors or rewrite production and unrelated modules', () => {
  const fixed = runInNewContext(correctFlightTimings(source, id, parseAst)!)
  expect(() => fixed(10, 0, { measure() { throw new Error('real failure') } })).toThrow('real failure')
  expect(correctFlightTimings(source, id.replace('.development.', '.production.'), parseAst)).toBeNull()
  expect(correctFlightTimings(source, '/application.js', parseAst)).toBeNull()
  const corrected = correctFlightTimings(source, id, parseAst)!
  expect(correctFlightTimings(corrected, id, parseAst)).toBeNull()
  expect(correctFlightTimings(source.replace('childrenEndTime, detail', 'otherEnd, detail'), id, parseAst)).toBeNull()
})


it('corrects both real React error and cancellation tracks without changing valid measurements', () => {
  const framework = createRequire(new URL('../examples/vinext-demo/package.json', import.meta.url))
  const file = join(dirname(framework.resolve('react-server-dom-webpack/client.browser')), 'cjs/react-server-dom-webpack-client.browser.development.js')
  const original = readFileSync(file, 'utf8')
  const corrected = correctFlightTimings(original, file, parseAst)!
  const blocks: any[] = []
  function visit(node: any) {
    if (!node || typeof node !== 'object') return
    if (node.type === 'IfStatement' && node.test.type === 'Identifier' && node.test.name === 'supportsUserTiming') blocks.push(node)
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value)
  }
  visit(parseAst(original))
  expect(blocks).toHaveLength(2)
  for (const block of blocks) {
    const before = original.slice(block.start, block.end)
    const after = correctFlightTimings(before, file, parseAst)!
    expect(corrected).toContain(after)
    function execute(code: string, end: number, trackIdx: number) {
      const calls: unknown[] = []
      const context: Record<string, any> = {
        supportsUserTiming: true, trackNames: Array.from({ length: 10 }, (_, i) => 'Track ' + i),
        response: { _rootEnvironmentName: 'Server' }, _env: 'Server', error: new Error('original error'),
        performance: {
          measure(name: string, options: { end: number }) {
            if (options.end < 0) throw new Error('end cannot be negative')
            calls.push([name, JSON.parse(JSON.stringify(options))])
          },
          clearMeasures(name: string) { calls.push(['clear', name]) },
        },
      }
      for (const name of before.match(/(?:componentInfo|startTime|childrenEndTime|trackIdx)(?:\$jscomp\$\d+)?/g) || []) {
        context[name] = name.startsWith('componentInfo') ? { name: 'Content', env: 'Server', key: null, props: null }
          : name.startsWith('startTime') ? 0 : name.startsWith('childrenEndTime') ? end : trackIdx
      }
      runInNewContext(code, context)
      return calls
    }
    expect(() => execute(before, -8.478078109386843, 0)).toThrow('end cannot be negative')
    expect(execute(after, -8.478078109386843, 0)).toEqual([])
    expect(execute(after, -Infinity, 0)).toEqual([])
    expect(execute(after, 10, 10)).toEqual([])
    for (const end of [0, 10]) expect(execute(after, end, 0)).toEqual(execute(before, end, 0))
  }
})
