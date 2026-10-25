// @vitest-environment node
import { expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
// @ts-expect-error The consumer installer is a native Node runner.
import { prepareVinextConsumer } from '../scripts/prepare-vinext-consumer.mjs'
// @ts-expect-error The evidence collector is shared with native Node runners.
import { vinextInstallation } from '../scripts/vinext-results.mjs'

it('rejects reuse of an unrelated project before packing or installing', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vinext-consumer-ownership-'))
  try {
    const file = join(directory, 'package.json'), original = '{"name":"user-app"}'
    await writeFile(file, original)
    await expect(prepareVinextConsumer(directory)).rejects.toThrow('Use an empty directory')
    expect(await readFile(file, 'utf8')).toBe(original)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

it('distinguishes patched consumers and verifies the packed artifact', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'vinext-consumer-evidence-'))
  try {
    const contents = 'packed package', sha256 = createHash('sha256').update(contents).digest('hex')
    const tarball = `redact-${sha256.slice(0, 16)}.tgz`, marker = join(directory, 'package-evidence.json')
    await writeFile(join(directory, tarball), contents)
    await writeFile(marker, JSON.stringify({ tarball, sha256, patches: false }))
    expect(await vinextInstallation(directory)).toBe('npm-tarball')
    await writeFile(marker, JSON.stringify({ tarball, sha256, patches: true }))
    expect(await vinextInstallation(directory)).toBe('modified-consumer')
    await writeFile(marker, JSON.stringify({ tarball, sha256 }))
    expect(await vinextInstallation(directory)).toBe('modified-consumer')
    await writeFile(marker, JSON.stringify({ tarball, sha256, patches: false }))
    await writeFile(join(directory, tarball), 'modified package')
    await expect(vinextInstallation(directory)).rejects.toThrow('tarball changed')
    await rm(marker)
    await expect(vinextInstallation(directory)).rejects.toThrow()
    expect(await vinextInstallation()).toBe('workspace')
  } finally { await rm(directory, { recursive: true, force: true }) }
})
