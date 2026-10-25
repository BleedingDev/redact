import { readFileSync } from 'node:fs'
import * as module from 'node:module'

let loaded: Promise<any> | undefined
const vendorURL = new URL('../../vendor/cloudflare-vite-plugin/', import.meta.url)

async function load() {
  if (typeof module.registerHooks !== 'function') {
    throw new Error('Redact Cloudflare integration requires Node.js 22.15 or newer. The release matrix uses Node.js 24.22.')
  }
  // This optional entry uses the installed peer's dependency graph, including
  // the application's security overrides.
  const peerURL = import.meta.resolve('@cloudflare/vite-plugin')
  const peer = JSON.parse(readFileSync(new URL('../package.json', peerURL), 'utf8'))
  if (peer.name !== '@cloudflare/vite-plugin' || peer.version !== '1.65.0') {
    throw new Error(`Redact Cloudflare integration supports @cloudflare/vite-plugin 1.65.0; found ${peer.version}.`)
  }
  const hook = module.registerHooks({
    resolve(specifier: string, context: any, nextResolve: any) {
      if (context.parentURL?.startsWith(vendorURL.href) &&
          !specifier.startsWith('.') && !specifier.startsWith('/') &&
          !/^[a-z][a-z+.-]*:/i.test(specifier)) {
        return nextResolve(specifier, { ...context, parentURL: peerURL })
      }
      return nextResolve(specifier, context)
    },
  })
  try {
    return await import(new URL('dist/index.mjs', vendorURL).href)
  } catch (error) {
    hook.deregister()
    throw error
  }
}

/**
 * Cloudflare's Vite plugin with Redact's maintained development evaluator fix.
 * Accepts the same options as @cloudflare/vite-plugin 1.65.0. Await this factory
 * in the Vite config so framework plugins receive the resolved plugin array.
 */
export async function cloudflare(options?: object): Promise<any[]> {
  const plugin = await (loaded ||= load().catch(error => { loaded = undefined; throw error }))
  return plugin.cloudflare(options)
}
