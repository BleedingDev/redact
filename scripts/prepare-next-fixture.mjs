import { cp, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import assert from 'node:assert/strict'

const root = fileURLToPath(new URL('../', import.meta.url))
export async function prepareNextFixture(version, destination, example = 'next-demo', rendering) {
  assert.match(version, /^\d+\.\d+\.\d+$/)
  const packageRoot = resolve(process.env.NEXT_TEST_PACKAGE || resolve(root, 'packages/redact'))
  const cwd = destination || await mkdtemp(join(tmpdir(), `redact-next-${version}-`))
  await mkdir(cwd, { recursive: true })
  // A fixture must not reuse optimized images or builds from another package.
  for (const output of ['.next', 'out']) await rm(join(cwd, output), { recursive: true, force: true })
  await cp(resolve(root, 'examples', example), cwd, {
    recursive: true,
    filter: source => !source.split(/[\\/]/).some(part => ['node_modules', '.next', 'out'].includes(part)),
  })
  // This route explicitly opts into Cache Components. Standard-mode fixtures
  // must build without enabling that feature, and exercise every other route.
  if (rendering === 'standard' && Number(version.split('.')[0]) >= 16) await rm(join(cwd, 'app/cached'), { recursive: true, force: true })
  const packed = spawn('pnpm', ['pack', '--pack-destination', cwd], { cwd: packageRoot, stdio: ['ignore', 'pipe', 'pipe'] })
  let packLog = ''
  for (const stream of [packed.stdout, packed.stderr]) stream.on('data', data => { packLog += data })
  assert.equal((await once(packed, 'exit'))[0], 0, packLog)
  const pkg = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'))
  const tarball = join(cwd, `tanstack-redact-${pkg.version}.tgz`)
  const packedName = `redact-${createHash('sha256').update(await readFile(tarball)).digest('hex').slice(0, 16)}.tgz`
  await rename(tarball, join(cwd, packedName))
  await writeFile(join(cwd, 'package.json'), JSON.stringify({
    name: 'redact-next-compatibility', private: true, type: 'module',
    dependencies: { '@tanstack/redact': `file:./${packedName}`, next: version, react: '19.2.3', 'react-dom': '19.2.3' },
  }, null, 2))
  const install = spawn('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd, stdio: 'inherit' })
  assert.equal((await once(install, 'exit'))[0], 0, `Could not install Next ${version}`)
  return cwd
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cwd = await prepareNextFixture(process.argv[2], process.argv[3] && resolve(process.argv[3]), process.argv[4], process.argv[5])
  console.log(`NEXT_TEST_DIR=${cwd}`)
}
