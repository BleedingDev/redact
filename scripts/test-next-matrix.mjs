import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nextVersions, nextModes, nextRenderings } from './next-versions.mjs'
import { prepareNextFixture } from './prepare-next-fixture.mjs'

const versions = process.env.NEXT_TEST_VERSIONS?.split(',') || nextVersions
const directory = process.env.NEXT_TEST_MATRIX_DIR || join(tmpdir(), 'redact-next-matrix')
await mkdir(directory, { recursive: true })
// Modes share a fixture's .next directory, so each release runs sequentially.
for (const version of versions) for (const rendering of nextRenderings(version)) {
  const cwd = await prepareNextFixture(version, join(directory, `${version}-${rendering}`), 'next-demo', rendering)
  for (const args of nextModes) {
    const name = `${version}-${rendering}-${args.includes('--webpack') ? 'webpack' : 'turbopack'}-${args.includes('--production') ? 'production' : 'development'}`
    const child = spawn(process.execPath, [fileURLToPath(new URL('./test-next.mjs', import.meta.url)), ...args], {
      stdio: 'inherit',
      env: { ...process.env, NEXT_TEST_DIR: cwd, NEXT_TEST_CACHE_COMPONENTS: rendering === 'cache-components' ? '1' : '0', NEXT_TEST_RESULT: join(directory, `${name}.json`) },
    })
    const [code, signal] = await once(child, 'exit')
    if (code !== 0 || signal) process.exitCode = 1
  }
  if (process.env.NEXT_TEST_CLEANUP === '1') for (const output of ['node_modules', '.next', 'out']) await rm(join(cwd, output), { recursive: true, force: true })
}
