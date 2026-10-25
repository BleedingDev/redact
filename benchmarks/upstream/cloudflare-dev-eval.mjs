// Usage: node benchmarks/upstream/cloudflare-dev-eval.mjs /path/to/consumer [--production] [--expect-unsupported]
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const consumer = resolve(process.argv[2])
const production = process.argv.includes('--production')
const unsupported = process.argv.includes('--expect-unsupported')
const directory = await mkdtemp(join(consumer, '.eval-contract-'))
const port = process.env.EVAL_TEST_PORT || '5412'
const vite = join(consumer, 'node_modules/vite/bin/vite.js')
let logs = '', server
const env = { ...process.env, CLOUDFLARE_SEND_METRICS: 'false' }
function run(args) {
  const child = spawn(process.execPath, [vite, ...args], { cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe'] })
  for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { logs = (logs + data).slice(-30000) })
  return child
}
try {
  await writeFile(join(directory, 'package.json'), '{"private":true,"type":"module"}\n')
  await writeFile(join(directory, 'wrangler.jsonc'), JSON.stringify({ name: 'redact-eval-contract', main: './worker.js', compatibility_date: '2026-10-24', compatibility_flags: ['nodejs_compat'] }))
  await writeFile(join(directory, 'vite.config.mjs'), `import { defineConfig } from 'vite'; import { cloudflare } from '@cloudflare/vite-plugin'; export default defineConfig({ plugins: [cloudflare({ configPath: ${JSON.stringify(join(directory, 'wrangler.jsonc'))}, inspectorPort: false, remoteBindings: false, persistState: false, tunnel: false })] });`)
  await writeFile(join(directory, 'worker.js'), `export default { fetch() {
    try {
      const object = {};
      const result = { supported: true, value: (0, eval)('40 + 2'), identity: (0, eval)(object) === object, nullValue: (0, eval)(null), functionName: (0, eval)('(function FlightStack() {})').name };
      try { (0, eval)('('); } catch (error) { result.syntaxError = error.name; }
      return Response.json(result);
    } catch (error) { return Response.json({ supported: false, error: error.name, message: error.message }); }
  } }`)
  if (production) {
    const build = run(['build'])
    assert.equal((await once(build, 'exit'))[0], 0, logs)
  }
  server = run([production ? 'preview' : 'dev', '--host', 'localhost', '--port', port, '--strictPort'])
  const deadline = Date.now() + 60000
  let response
  for (;;) {
    assert.equal(server.exitCode, null, logs)
    try { response = await fetch(`http://localhost:${port}`); if (response.ok) break } catch {}
    assert.ok(Date.now() < deadline, logs)
    await new Promise(resolve => setTimeout(resolve, 200))
  }
  const result = await response.json()
  if (unsupported) assert.equal(result.supported, false, 'Production and the unmodified development runner must keep their original eval restriction')
  else assert.deepEqual(result, { supported: true, value: 42, identity: true, nullValue: null, functionName: 'FlightStack', syntaxError: 'SyntaxError' })
  console.log(JSON.stringify({ passed: true, mode: production ? 'production' : 'development', result }))
} finally {
  if (server && server.exitCode === null && server.signalCode === null) {
    const stopped = once(server, 'exit')
    server.kill('SIGTERM')
    const timer = setTimeout(() => server.kill('SIGKILL'), 5000)
    try { await stopped } finally { clearTimeout(timer) }
  }
  await rm(directory, { recursive: true, force: true })
}
