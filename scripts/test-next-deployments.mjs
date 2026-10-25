import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nextVersions, nextRenderings } from './next-versions.mjs'
import { prepareNextFixture } from './prepare-next-fixture.mjs'

const versions = process.env.NEXT_TEST_VERSIONS?.split(',') || [nextVersions[0], nextVersions.at(-1)]
const directory = process.env.NEXT_TEST_MATRIX_DIR || join(tmpdir(), 'redact-next-matrix')
await mkdir(directory, { recursive: true })
for (const version of versions) {
  for (const deployment of ['standalone', 'static-export']) for (const rendering of deployment === 'static-export' ? ['standard'] : nextRenderings(version)) {
    const cwd = await prepareNextFixture(version, join(directory, `${version}-${rendering}-${deployment}`), deployment === 'standalone' ? 'next-demo' : 'next-static', rendering)
    for (const bundler of ['turbopack', 'webpack']) {
      const args = [fileURLToPath(new URL(deployment === 'standalone' ? './test-next.mjs' : './test-next-static.mjs', import.meta.url))]
      if (deployment === 'standalone') args.push('--production', '--standalone')
      if (bundler === 'webpack') args.push('--webpack')
      const child = spawn(process.execPath, args, {
        stdio: 'inherit',
        env: { ...process.env, NEXT_TEST_DIR: cwd, NEXT_TEST_CACHE_COMPONENTS: rendering === 'cache-components' ? '1' : '0', NEXT_TEST_BASE_PATH: '/coverage', NEXT_TEST_RESULT: join(directory, `${version}-${rendering}-${bundler}-${deployment}.json`) },
      })
      const [code, signal] = await once(child, 'exit')
      if (code !== 0 || signal) process.exitCode = 1
    }
    if (process.env.NEXT_TEST_CLEANUP === '1') for (const output of ['node_modules', '.next', 'out']) await rm(join(cwd, output), { recursive: true, force: true })
  }
}
