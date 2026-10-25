import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const consumer = resolve(process.argv[2])
const port = process.env.CLOUDFLARE_TEST_PORT || '5430'
const vite = join(consumer, 'node_modules/vite/bin/vite.js')
const results = []
for (const [entry, production] of [['@cloudflare/vite-plugin', false], ['@tanstack/redact/cloudflare', false], ['@cloudflare/vite-plugin', true], ['@tanstack/redact/cloudflare', true]]) {
  const directory = await mkdtemp(join(consumer, '.cloudflare-contract-'))
  let logs = '', server
  const run = args => {
    const child = spawn(process.execPath, [vite, ...args], { cwd: directory, env: { ...process.env, CLOUDFLARE_SEND_METRICS: 'false' }, stdio: ['ignore', 'pipe', 'pipe'] })
    for (const stream of [child.stdout, child.stderr]) stream.on('data', data => { logs = (logs + data).slice(-30000) })
    return child
  }
  try {
    await writeFile(join(directory, 'package.json'), '{"private":true,"type":"module"}\n')
    await writeFile(join(directory, 'wrangler.jsonc'), JSON.stringify({ name: 'redact-eval-contract', main: './worker.js', compatibility_date: '2026-10-24', compatibility_flags: ['nodejs_compat'] }))
    await writeFile(join(directory, 'vite.config.mjs'), `import { cloudflare } from ${JSON.stringify(entry)}; export default { plugins: [await cloudflare({ inspectorPort: false, remoteBindings: false, persistState: false, tunnel: false })] };`)
    await writeFile(join(directory, 'worker.js'), `
      let initialized;
      try { initialized = (0, eval)('21 * 2'); } catch (error) { initialized = error.name; }
      export default { fetch() {
        try {
          const object = {}, boxed = new String('42'), localOnly = 123;
          const result = { initialized, value: (0, eval)('40 + 2'), identity: (0, eval)(object) === object, boxedIdentity: (0, eval)(boxed) === boxed, nullValue: (0, eval)(null), undefinedValue: (0, eval)(undefined) === undefined, functionName: (0, eval)('(function FlightStack() {})').name, localScope: (0, eval)('typeof localOnly') };
          try { (0, eval)('('); } catch (error) { result.syntaxError = error.name; }
          try { (0, eval)('throw new RangeError("kept")'); } catch (error) { result.runtimeError = [error.name, error.message]; }
          return Response.json(result);
        } catch (error) { return Response.json({ initialized, error: error.name }); }
      } }
    `)
    if (production) assert.equal((await once(run(['build']), 'exit'))[0], 0, logs)
    // Use one loopback address for binding and requests, independent of DNS order.
    server = run([production ? 'preview' : 'dev', '--host', '127.0.0.1', '--port', port, '--strictPort'])
    const deadline = Date.now() + 60000
    let response
    for (;;) {
      assert.equal(server.exitCode, null, logs)
      try { response = await fetch(`http://127.0.0.1:${port}`); if (response.ok) break } catch {}
      assert.ok(Date.now() < deadline, logs)
      await new Promise(done => setTimeout(done, 200))
    }
    const result = await response.json()
    if (production) assert.deepEqual(result, { initialized: 42, error: 'EvalError' })
    else if (entry === '@cloudflare/vite-plugin') assert.deepEqual(result, { initialized: 'EvalError', error: 'EvalError' })
    else assert.deepEqual(result, { initialized: 42, value: 42, identity: true, boxedIdentity: true, nullValue: null, undefinedValue: true, functionName: 'FlightStack', localScope: 'undefined', syntaxError: 'SyntaxError', runtimeError: ['RangeError', 'kept'] })
    results.push({ passed: true, entry, mode: production ? 'production' : 'development', result })
    console.log(JSON.stringify(results.at(-1)))
  } finally {
    if (server && server.exitCode === null && server.signalCode === null) {
      const stopped = once(server, 'exit'); server.kill('SIGTERM')
      const timer = setTimeout(() => server.kill('SIGKILL'), 5000)
      try { await stopped } finally { clearTimeout(timer) }
    }
    await rm(directory, { recursive: true, force: true })
  }
}

if (process.env.VINEXT_TEST_RESULTS) {
  await mkdir(process.env.VINEXT_TEST_RESULTS, { recursive: true })
  await writeFile(join(process.env.VINEXT_TEST_RESULTS, 'cloudflare-evaluation.json'), JSON.stringify({ passed: true, results }, null, 2) + '\n')
}
