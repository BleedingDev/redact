import { defineConfig } from 'vite'
import vinext from 'vinext'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { cloudflare } from '@cloudflare/vite-plugin'

const root = process.env.VINEXT_TEST_DIR || fileURLToPath(new URL('./.fixture/', import.meta.url))
const { redact } = process.env.VINEXT_TEST_PACKAGE
  ? await import(pathToFileURL(resolve(process.env.VINEXT_TEST_PACKAGE, 'dist/vinext/index.js')).href)
  : await import('@tanstack/redact/vinext')
export default defineConfig({
  root,
  cacheDir: `${root}/.vite`,
  plugins: [
    vinext({ appDir: root }),
    ...(process.env.VINEXT_TEST_WORKERS ? [cloudflare({
      configPath: resolve(root, 'wrangler.jsonc'),
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
      inspectorPort: false, persistState: false, remoteBindings: false, tunnel: false,
    })] : []),
    ...(process.env.VINEXT_TEST_REFERENCE ? [] : [redact()]),
  ],
})
