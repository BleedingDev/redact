// @vitest-environment node
import { expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error The fixture runner is a native Node ESM module.
import { prepareVinextPackage } from '../scripts/prepare-vinext-fixture.mjs'
// @ts-expect-error The evidence collector is shared with native Node runners.
import { vinextPackageEvidence } from '../scripts/vinext-results.mjs'

it('pins the tested source and built runtime while the workspace is rebuilt', async () => {
  const source = await mkdtemp(join(tmpdir(), 'vinext-package-'))
  let snapshot: string | undefined
  try {
    await mkdir(join(source, 'src'), { recursive: true })
    await mkdir(join(source, 'dist/vinext'), { recursive: true })
    await writeFile(join(source, 'package.json'), '{"type":"module"}')
    await writeFile(join(source, 'src/index.ts'), 'export const value = 1')
    await writeFile(join(source, 'dist/vinext/index.js'), 'export const value = 1')
    const original = await vinextPackageEvidence(source)
    snapshot = await prepareVinextPackage(source, join(source, '.snapshots'))
    expect(await vinextPackageEvidence(snapshot)).toEqual(original)
    await rm(join(source, 'dist'), { recursive: true })
    await writeFile(join(source, 'src/index.ts'), 'export const value = 2')
    expect(await vinextPackageEvidence(snapshot)).toEqual(original)
    expect(await readFile(join(snapshot!, 'dist/vinext/index.js'), 'utf8')).toBe('export const value = 1')
    expect(await vinextPackageEvidence(source)).not.toEqual(original)
  } finally {
    await rm(source, { recursive: true, force: true })
    if (snapshot) await rm(snapshot, { recursive: true, force: true })
  }
})

it('rejects a package without a built Vinext entry', async () => {
  const source = await mkdtemp(join(tmpdir(), 'vinext-package-'))
  try { await expect(prepareVinextPackage(source, join(source, '.snapshots'))).rejects.toThrow('Build Redact before preparing Vinext checks') }
  finally { await rm(source, { recursive: true, force: true }) }
})
