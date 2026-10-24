import type { Fiber, ReactElement } from './index'

// Development metadata lives outside elements and fibers, so the production
// object layouts stay unchanged. Nothing is captured without DevTools attached.
export const devToolsMetadata = {
  enabled: false,
  owner: null as Fiber | null,
  stackBudget: 10000,
  stackResetTime: 0,
  elements: /* @__PURE__ */ new WeakMap<object, { owner: Fiber | null; stack: Error | null; source: any }>(),
  fibers: /* @__PURE__ */ new WeakMap<Fiber, { owner: Fiber | null; stack: Error | null; source: any }>(),
}

export function rememberDevToolsElement(element: ReactElement, source?: any, original?: ReactElement): ReactElement {
  if (!devToolsMetadata.enabled) return element
  const previous = original && devToolsMetadata.elements.get(original)
  devToolsMetadata.elements.set(element, previous || {
    owner: devToolsMetadata.owner,
    // React also caps owner stack capture at 10,000 elements per second.
    // Keep owner relationships, but don't invent a source once the budget ends.
    stack: devToolsMetadata.stackBudget-- > 0 ? new Error('react-stack-top-frame') : null,
    source: source || null,
  })
  return element
}
