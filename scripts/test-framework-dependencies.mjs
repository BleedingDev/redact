import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire, findPackageJSON } from 'node:module'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const consumer = resolve(process.argv[2])
const baseline = process.argv[3] && resolve(process.argv[3])
const server = createServer((_request, response) => {
  response.writeHead(200, { 'content-encoding': 'gzip, gzip, gzip, gzip, gzip, gzip', 'content-length': '1' })
  response.flushHeaders()
  response.socket.end()
})
await new Promise(done => server.listen(0, '127.0.0.1', done))
const origin = `http://127.0.0.1:${server.address().port}/`
const results = []
try {
  for (const directory of [baseline, consumer].filter(Boolean)) {
    const fixed = directory === consumer
    const require = createRequire(join(directory, 'package.json'))
    const miniflare = require.resolve('miniflare')
    const miniflareRequire = createRequire(miniflare)
    const undiciVersion = miniflareRequire('undici/package.json').version
    const satori = findPackageJSON('satori', pathToFileURL(join(directory, 'package.json')))
    const satoriRequire = createRequire(satori)
    const fflate = satoriRequire.resolve('fflate')
    const fflateVersion = JSON.parse(await readFile(findPackageJSON('fflate', pathToFileURL(satori)), 'utf8')).version
    if (fixed) {
      assert.equal(undiciVersion, '7.30.1')
      assert.equal(fflateVersion, '0.7.5')
    }
    // Use an async subprocess so the malformed HTTP response can be served by
    // this process. The original release emits an unhandled stream error.
    const { spawn } = await import('node:child_process')
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      const { fetch } = await import(process.argv[2]);
      await assert.rejects(fetch(process.argv[1]), error => /too many content-encodings/.test(error.cause?.message || ''));
      await new Promise(done => setTimeout(done, 100));
      console.log('fetch rejected safely');
    `, origin, pathToFileURL(miniflare).href], { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = ''
    child.stdout.on('data', data => { stdout += data })
    child.stderr.on('data', data => { stderr += data })
    const timer = setTimeout(() => child.kill('SIGKILL'), 10000)
    const code = await new Promise((done, reject) => { child.once('error', reject); child.once('exit', done) }).finally(() => clearTimeout(timer))
    if (fixed) { assert.equal(code, 0, stderr); assert.equal(stderr, ''); assert.match(stdout, /fetch rejected safely/) }
    else { assert.notEqual(code, 0); assert.match(stderr, /Unhandled 'error' event/); assert.match(stderr, /Readable instance/) }
    results.push({ dependency: 'undici', version: undiciVersion, fixed, exitCode: code })

    // ZIP64 central entry declares a 64-bit size but has no ZIP64 extra field.
    // The published fix must reject it; the affected version never returns.
    const zip = spawnSync(process.execPath, ['--input-type=module', '-e', `
      import assert from 'node:assert/strict';
      import { createRequire } from 'node:module';
      const { unzipSync, zipSync, zlibSync, unzlibSync } = createRequire(import.meta.url)(process.argv[1]);
      const data = new TextEncoder().encode('font data round trip');
      assert.deepEqual(unzipSync(zipSync({ 'font.txt': data }))['font.txt'], data);
      assert.deepEqual(unzlibSync(zlibSync(data)), data);
      const malformed = new Uint8Array(144), view = new DataView(malformed.buffer);
      view.setUint32(0, 0x02014b50, true);
      view.setUint32(20, 0xffffffff, true);
      view.setUint32(46, 0x06064b50, true);
      view.setUint32(78, 1, true);
      view.setUint32(102, 0x07064b50, true);
      view.setUint32(110, 46, true);
      view.setUint32(122, 0x06054b50, true);
      view.setUint16(130, 1, true);
      view.setUint32(138, 0xffffffff, true);
      assert.throws(() => unzipSync(malformed), error => error.code === 13);
      console.log('archive rejected safely');
    `, fflate], { encoding: 'utf8', timeout: 3000 })
    if (fixed) { assert.equal(zip.status, 0, zip.stderr); assert.equal(zip.stderr, ''); assert.match(zip.stdout, /archive rejected safely/) }
    else assert.equal(zip.error?.code, 'ETIMEDOUT', 'The affected ZIP64 parser should reproduce the hang')
    results.push({ dependency: 'fflate', version: fflateVersion, fixed, exitCode: zip.status, timedOut: zip.error?.code === 'ETIMEDOUT' })
  }
} finally { await new Promise(done => server.close(done)) }
const report = { passed: true, recordedAt: new Date().toISOString(), node: process.version, results }
if (process.env.VINEXT_TEST_RESULTS) {
  await mkdir(process.env.VINEXT_TEST_RESULTS, { recursive: true })
  await writeFile(join(process.env.VINEXT_TEST_RESULTS, 'dependency-regressions.json'), JSON.stringify(report, null, 2) + '\n')
}
console.log(JSON.stringify(report))
