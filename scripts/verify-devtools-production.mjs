import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { gzipSync, brotliCompressSync } from 'node:zlib'
import { build } from 'vite'
import { redact } from '../packages/redact/dist/vite/index.js'
import { sizeEntries } from './measure-size.mjs'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'

const baseline = process.argv[2]
assert(baseline, 'Pass the pre-DevTools repository directory.')
const current = resolve(import.meta.dirname, '..')
let failures = 0
for (const tree of ['src', 'dist']) {
for (const entry of sizeEntries) {
  if (process.env.PRODUCTION_ENTRY && entry.name !== process.env.PRODUCTION_ENTRY) continue
  const outputs = []
  for (const directory of [baseline, current]) {
    const source = resolve(directory, 'packages/redact', tree)
    const paths = entry.virtual ? ['react/index', 'react/jsx-runtime', 'dom/index', 'dom/client'] : [entry.path]
    const result = await build({
      configFile: false, logLevel: 'silent',
      plugins: [
        ...redact({ features: entry.features || { viewTransitions: true } }),
        {
          name: 'production-comparison-entry',
          resolveId(id) { if (id === 'production-comparison') return '\0production-comparison' },
          load(id) { if (id === '\0production-comparison') return paths.map(path => `export * from ${JSON.stringify(source + '/' + path + (tree === 'src' ? '.ts' : '.js'))}`).join('\n') },
        },
      ],
      build: {
        write: false, target: 'es2022', minify: process.env.PRODUCTION_MINIFY === 'false' ? false : 'esbuild',
        rollupOptions: { input: 'production-comparison', preserveEntrySignatures: 'strict', output: { format: 'es' } },
      },
    })
    const output = (Array.isArray(result) ? result[0] : result).output.find(item => item.type === 'chunk')
    assert(output)
    if (process.env.PRODUCTION_DEBUG) {
      writeFileSync(resolve(tmpdir(), `redact-production-${directory === current ? 'current' : 'baseline'}.js`), output.code)
      console.log(Object.entries(output.modules).filter(([id]) => id.endsWith('/devtools.ts')).map(([id, module]) => ({ id, code: module.code, exports: module.renderedExports })))
      for (const [id, module] of Object.entries(output.modules)) if (id.endsWith('/dispatcher.ts')) console.log(module.code?.match(/.{0,100}devToolsDispatcher.{0,100}/g))
    }
    assert(!output.code.includes('__REACT_DEVTOOLS_GLOBAL_HOOK__'))
    assert(!output.code.includes('Simulated error coming from DevTools'))
    outputs.push(output.code)
  }
  const sizes = outputs.map(code => [Buffer.byteLength(code), gzipSync(code).length, brotliCompressSync(code).length])
  const delta = sizes[1].map((size, index) => size - sizes[0][index])
  console.log(JSON.stringify({ tree, name: entry.name, identical: outputs[0] === outputs[1], delta }))
  if (delta.some(value => value > 0)) failures++
}
}
assert.equal(failures, 0, `${failures} production fixtures increased in size`)
