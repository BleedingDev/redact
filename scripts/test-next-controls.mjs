import { readFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'

// A failed release check stays failed. This separate native React run explains
// whether the same browser and scenario fail without the Redact adapter.
const path = process.env.NEXT_TEST_RESULT
let report
try { report = JSON.parse(await readFile(path, 'utf8')) }
catch (error) {
  if (error.code !== 'ENOENT') throw error
  console.log('No completed result is available for a native React comparison')
  process.exit(0)
}
const failed = report.results.filter(result => !result.passed)
if (failed.length) {
  const scenarios = [...new Set(failed.flatMap(result => result.scenarios?.filter(scenario => !scenario.passed).map(scenario => scenario.name) || []))]
  const child = spawn(process.execPath, [fileURLToPath(new URL('./test-next.mjs', import.meta.url)), ...process.argv.slice(2)], {
    stdio: 'inherit',
    env: { ...process.env, NEXT_TEST_TRACE: '1', NEXT_TEST_REFERENCE: '1', NEXT_TEST_BROWSERS: [...new Set(failed.map(result => result.browser))].join(','), NEXT_TEST_SCENARIOS: scenarios.join(','), NEXT_TEST_RESULT: path + '.native.json' },
  })
  const [code, signal] = await once(child, 'exit')
  if (code !== 0 || signal) process.exitCode = 1
}
