import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = process.env.NEXT_TEST_MATRIX_DIR || join(tmpdir(), 'redact-next-matrix')
for (const script of ['test-next-matrix.mjs', 'test-next-deployments.mjs', 'report-next-coverage.mjs']) {
  const child = spawn(process.execPath, [fileURLToPath(new URL(script, import.meta.url)), ...(script.startsWith('report-') ? [directory] : [])], {
    stdio: 'inherit', env: { ...process.env, NEXT_TEST_MATRIX_DIR: directory },
  })
  const [code, signal] = await once(child, 'exit')
  if (code !== 0 || signal) process.exitCode = 1
}
