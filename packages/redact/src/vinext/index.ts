import { fileURLToPath } from 'node:url'
import { vinextCompatibility } from './compatibility'

/** Use Redact in Vinext's browser environment, with native React for SSR and RSC. */
export function redact(options: { renderer?: 'redact' | 'react' } = {}): any {
  const compatibility = vinextCompatibility()
  const entries: Record<string, string> = {
    react: '../next/react.js',
    'react/jsx-runtime': '../react/jsx-runtime.js',
    'react/jsx-dev-runtime': '../react/jsx-runtime.js',
    'react/compiler-runtime': '../react/compiler-runtime.js',
    'react-dom': '../dom/index.js',
    'react-dom/client': '../next/client.js',
    'react-dom/test-utils': '../dom/test-utils.js',
    scheduler: '../scheduler/index.js',
  }
  const resolved = Object.fromEntries(Object.entries(entries).map(([name, target]) => [name, fileURLToPath(new URL(target, import.meta.url))]))
  return {
    ...compatibility,
    name: 'redact:vinext',
    enforce: 'pre',
    configEnvironment: {
      order: 'post',
      handler(name: string, config: any) {
        compatibility.configEnvironment.handler(name, config)
        if (options.renderer === 'react' || (name !== 'client' && config.consumer !== 'client')) return
        config.optimizeDeps = {
          ...config.optimizeDeps,
          exclude: [...new Set([...(config.optimizeDeps?.exclude || []), ...Object.keys(entries), '@tanstack/redact'])],
          include: config.optimizeDeps?.include?.filter((id: string) => !entries[id.split('>').pop()!.trim()]),
        }
      },
    },
    resolveId: {
      order: 'pre',
      handler(this: any, id: string) {
        if (this.environment?.config.consumer !== 'client') return compatibility.resolveHandler(id)
        // Vite aliases are global. Browser React must resolve here so SSR and
        // Flight retain their native React module and export conditions.
        if (options.renderer === 'react') return null
        return resolved[id] ?? null
      },
    },
  }
}

export default redact
