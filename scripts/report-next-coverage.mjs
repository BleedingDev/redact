import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { nextVersions, nextScenarios, nextRenderings } from './next-versions.mjs'

const directory = resolve(process.argv[2] || '/tmp/redact-next-matrix')
const expected = []
for (const version of nextVersions) for (const bundler of ['turbopack', 'webpack']) {
  for (const rendering of nextRenderings(version)) for (const mode of ['development', 'production']) for (const browser of ['chromium', 'firefox', 'webkit']) expected.push({ version, bundler, mode, browser, rendering, deployment: 'node' })
  if (version === nextVersions[0] || version === nextVersions.at(-1)) {
    for (const deployment of ['standalone', 'static-export']) for (const rendering of deployment === 'static-export' ? ['standard'] : nextRenderings(version)) for (const browser of ['chromium', 'firefox', 'webkit']) expected.push({ version, bundler, mode: 'production', browser, rendering, deployment })
  }
}
const key = result => ['version', 'rendering', 'bundler', 'mode', 'deployment', 'browser'].map(name => result[name]).join('/')
const results = new Map(), problems = [], evidence = []
for (const file of (await readdir(directory)).filter(name => name.endsWith('.json') && name !== 'coverage.json').sort()) {
  const record = JSON.parse(await readFile(join(directory, file), 'utf8'))
  if (!Array.isArray(record.results)) continue
  evidence.push({ file, ...record.evidence })
  if (!record.complete) problems.push(`${file}: incomplete run`)
  for (const result of record.results) {
    if (result.reference) continue
    const id = key(result)
    if (results.has(id)) problems.push(`${id}: duplicate result`)
    const names = (result.scenarios || []).map(scenario => scenario.name).sort()
    const expectedNames = nextScenarios(result.version, result.mode, result.deployment, result.rendering).sort()
    if (JSON.stringify(names) !== JSON.stringify(expectedNames)) problems.push(`${id}: missing or unexpected scenarios`)
    if (result.passed && result.scenarios?.some(scenario => !scenario.passed)) problems.push(`${id}: failed scenario reported as a pass`)
    results.set(id, result)
  }
}
for (const item of expected) if (!results.has(key(item))) problems.push(`${key(item)}: missing run`)
for (const id of results.keys()) if (!expected.some(item => key(item) === id)) problems.push(`${id}: unexpected run`)
for (const field of ['packageSha256', 'suiteSha256']) {
  const values = new Set(evidence.map(item => item[field]))
  if (values.size !== 1 || values.has(undefined) || values.has(null)) problems.push(`Results do not share one recorded ${field}`)
}
const scenarios = [...results.values()].flatMap(result => result.scenarios || [])
const report = {
  recordedAt: new Date().toISOString(), complete: problems.length === 0,
  passed: problems.length === 0 && [...results.values()].every(result => result.passed),
  matrix: { expected: expected.length, executed: results.size, passed: [...results.values()].filter(result => result.passed).length },
  scenarios: { executed: scenarios.length, passed: scenarios.filter(result => result.passed).length },
  problems,
  failures: [...results.values()].filter(result => !result.passed).map(result => ({ ...result, scenarios: result.scenarios?.filter(scenario => !scenario.passed) })),
  evidence,
}
await writeFile(join(directory, 'coverage.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
if (!report.passed) process.exitCode = 1
