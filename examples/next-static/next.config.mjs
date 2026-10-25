import { withRedact } from '@tanstack/redact/next'

export default withRedact({
  output: 'export',
  trailingSlash: true,
  ...(process.env.NEXT_TEST_BASE_PATH ? { basePath: process.env.NEXT_TEST_BASE_PATH } : {}),
})
