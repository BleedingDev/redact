import { createRoot as create, hydrateRoot as hydrate, type RootOptions } from '../dom/client'
export type { Root, RootOptions } from '../dom/client'

export function createRoot(container: Element | DocumentFragment | Document, options: RootOptions = {}) {
  return create(container, { ...options, identifierStrategy: 'react' })
}
export function hydrateRoot(container: Element | Document, children: any, options: RootOptions = {}) {
  return hydrate(container, children, { ...options, identifierStrategy: 'react' })
}
export default { createRoot, hydrateRoot }
