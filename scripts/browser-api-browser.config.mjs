import { resolve } from 'node:path'
import config from './browser-api.config.mjs'

export default {
  ...config,
  root: resolve(config.root, 'tests'),
  resolve: { alias: config.resolve.alias.map((alias) => alias.find.source === '^react-dom\\/server$' && process.env.REACT_REFERENCE === '1'
    ? { ...alias, replacement: resolve('benchmarks/reference/node_modules/react-dom/server.browser.js') }
    : alias) },
  // Source aliases must not reuse optimized code from an earlier test run.
  optimizeDeps: { include: ['react/jsx-dev-runtime'], force: true },
  test: {
    include: ['browser-api.test.tsx'],
    testNamePattern: /^(?!.*pipeable).*$/,
    browser: {
      enabled: true, name: process.env.PLAYWRIGHT_BROWSER || 'chromium', provider: 'playwright',
      providerOptions: { launch: !process.env.PLAYWRIGHT_BROWSER || process.env.PLAYWRIGHT_BROWSER === 'chromium' ? { channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome' } : {} },
      headless: true, screenshotFailures: false,
    },
  },
}
