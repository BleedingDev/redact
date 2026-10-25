import { withRedact } from '@tanstack/redact/next'

const renderer = process.env.JOURNEY_RENDERER || 'redact'
if (!['react', 'redact'].includes(renderer)) throw new Error('Unknown journey renderer')
const config = {
  reactStrictMode: true,
  agentRules: false,
  distDir: process.env.JOURNEY_DIST_DIR || `.next-${renderer}`,
  env: {
    NEXT_PUBLIC_JOURNEY_RENDERER: renderer,
    NEXT_PUBLIC_JOURNEY_HOST: process.env.JOURNEY_HOST || 'http://localhost:4310',
  },
}

export default renderer === 'redact' ? withRedact(config) : config
