import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const directory = fileURLToPath(new URL('../examples/next-journey/', import.meta.url))
const require = createRequire(resolve(directory, 'package.json'))

export async function startJourney({ port = Number(process.env.JOURNEY_PORT || 4310), build = true } = {}) {
  if (!Number.isInteger(port) || port < 1024 || port > 65533) throw new Error('JOURNEY_PORT must be between 1024 and 65533')
  const host = `http://localhost:${port}`
  const config = { react: `http://localhost:${port + 1}`, redact: `http://localhost:${port + 2}` }
  const next = require.resolve('next/dist/bin/next')
  const children = new Set()
  let closed = false
  const files = {
    '/': ['index.html', 'text/html; charset=utf-8'],
    '/comparison.js': ['comparison.js', 'text/javascript; charset=utf-8'],
    '/comparison.css': ['comparison.css', 'text/css; charset=utf-8'],
  }
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    if (request.method !== 'GET' && request.method !== 'HEAD') { response.writeHead(405).end(); return }
    const path = new URL(request.url, host).pathname
    if (path === '/config.json') { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(config)); return }
    if (path === '/favicon.ico') { response.writeHead(204).end(); return }
    const file = files[path]
    if (!file) { response.writeHead(404).end(); return }
    try {
      const body = await readFile(resolve(directory, 'comparison', file[0]))
      response.setHeader('Content-Type', file[1])
      response.end(request.method === 'HEAD' ? undefined : body)
    } catch (error) { console.error(error); response.writeHead(500).end('Could not load the comparison') }
  })
  async function stop() {
    if (closed) return
    closed = true
    await Promise.all([...children].map(async child => {
      const exited = once(child, 'exit')
      child.kill('SIGTERM')
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000)
      timer.unref()
      try { await exited } finally { clearTimeout(timer) }
    }))
    server.closeAllConnections()
    if (server.listening) await new Promise(resolve => server.close(resolve))
  }
  function run(renderer, args) {
    const child = spawn(process.execPath, [next, ...args], {
      cwd: directory,
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', JOURNEY_RENDERER: renderer, JOURNEY_HOST: host, JOURNEY_DIST_DIR: `.next-${renderer}-${port}` },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    children.add(child)
    child.once('exit', () => children.delete(child))
    for (const stream of [child.stdout, child.stderr]) stream.on('data', data => process.stdout.write(`[${renderer}] ${data}`))
    return child
  }
  try {
    // Bind the comparison port before doing expensive builds.
    server.listen(port, '127.0.0.1')
    await once(server, 'listening')
    if (build) for (const renderer of ['react', 'redact']) {
      const child = run(renderer, ['build', '--turbopack'])
      const [code] = await once(child, 'exit')
      if (code !== 0) throw new Error(`${renderer} build failed (${code})`)
    }
    for (const [index, renderer] of ['react', 'redact'].entries()) {
      const child = run(renderer, ['start', '--hostname', 'localhost', '--port', String(port + index + 1)])
      const deadline = Date.now() + 30000
      while (true) {
        if (child.exitCode !== null || child.signalCode !== null) throw new Error(`${renderer} server exited`)
        try { if ((await fetch(config[renderer])).ok) break } catch {}
        if (Date.now() > deadline) throw new Error(`${renderer} server did not become ready`)
        await new Promise(resolve => setTimeout(resolve, 150))
      }
      child.once('exit', code => { if (!closed) { console.error(`${renderer} server exited (${code})`); void stop() } })
    }
    console.log(`\nNext.js journey: ${host}\nReact: ${config.react}\nRedact: ${config.redact}`)
    return { url: host, config, stop }
  } catch (error) { await stop(); throw error }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const journey = await startJourney({ build: !process.argv.includes('--skip-build') })
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await journey.stop(); process.exit(0) })
}
