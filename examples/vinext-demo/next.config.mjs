export default {
  reactStrictMode: true,
  ...(process.env.VINEXT_TEST_CACHE_COMPONENTS === '1' ? { cacheComponents: true } : {}),
  ...(process.env.VINEXT_TEST_OUTPUT ? { output: process.env.VINEXT_TEST_OUTPUT } : {}),
  ...(process.env.VINEXT_TEST_BASE_PATH ? { basePath: process.env.VINEXT_TEST_BASE_PATH, trailingSlash: true } : {}),
  async rewrites() { return [{ source: '/rewritten/:slug', destination: '/routing/:slug' }] },
  async redirects() { return [{ source: '/configured-redirect', destination: '/routing/redirected?from=config', permanent: false }] },
}
