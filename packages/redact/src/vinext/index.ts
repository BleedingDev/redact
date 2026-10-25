import { fileURLToPath } from 'node:url'

/** Use Redact in Vinext's browser environment, with native React for SSR and RSC. */
export function redact(): any {
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
    name: 'redact:vinext',
    enforce: 'pre',
    configEnvironment: {
      order: 'post',
      handler(name: string, config: any) {
        if (name !== 'client' && config.consumer !== 'client') return
        config.optimizeDeps = {
          ...config.optimizeDeps,
          exclude: [...new Set([...(config.optimizeDeps?.exclude || []), ...Object.keys(entries), '@tanstack/redact'])],
          include: config.optimizeDeps?.include?.filter((id: string) => !entries[id.split('>').pop()!.trim()]),
        }
      },
    },
    resolveId(this: any, id: string) {
      // Vite's alias table is global, even inside configEnvironment. Resolve
      // through the environment-aware hook so SSR and Flight keep native React.
      if (this.environment?.config.consumer !== 'client') return null
      return resolved[id] ?? null
    },
  }
}

export default redact
