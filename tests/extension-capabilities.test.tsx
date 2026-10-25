import { expect, it } from 'vitest'
import { act, createContext, useContext } from 'react'
import { createRoot, installCapability } from '../packages/redact/src/dom/_all'

it('preserves named capability registration through the extension entry point', async () => {
  const context = createContext('default')
  installCapability('readContext', (_f, received) => {
    expect(received).toBe(context)
    return 'extension value'
  })
  function Reader() { return <span>{useContext(context)}</span> }
  const container = document.createElement('div'), root = createRoot(container)
  try {
    await act(() => root.render(<Reader />))
    expect(container.textContent).toBe('extension value')
  } finally { await act(() => root.unmount()) }
})

it('passes the physical parent and next sibling to extension renderers', async () => {
  const { registerRenderer, registerTypeMatcher, reconcileChildren, childrenToArray } = await import('../packages/redact/src/dom/_all')
  const marker = Symbol('extension renderer')
  const type = { $$typeof: marker } as any
  const calls: Array<[Node, Node | null]> = []
  registerTypeMatcher((_type, value) => value === marker ? 20 as any : null)
  registerRenderer(20 as any, (fiber, parent, anchor) => {
    calls.push([parent, anchor])
    reconcileChildren(fiber, childrenToArray(fiber.v.children), parent, anchor)
    fiber.m = fiber.v
  })
  const { createElement } = await import('react')
  const container = document.createElement('div'), root = createRoot(container)
  const content = (text: string) => [createElement(type, { key: 'custom' }, <b>{text}</b>), <span key="tail">tail</span>]
  try {
    await act(() => root.render(content('first')))
    const bold = container.firstChild, tail = container.lastChild
    await act(() => root.render(content('second')))
    expect(calls.at(-1)).toEqual([container, tail])
    expect(container.firstChild).toBe(bold)
    expect(container.lastChild).toBe(tail)
    expect(container.innerHTML).toBe('<b>second</b><span>tail</span>')
  } finally { await act(() => root.unmount()) }
})

it('keeps nullable normalized children supported by the extension API', async () => {
  const { registerRenderer, registerTypeMatcher, reconcileChildren } = await import('../packages/redact/src/dom/_all')
  const { createElement } = await import('react')
  const marker = Symbol('nullable extension'), type = { $$typeof: marker } as any
  registerTypeMatcher((_type, value) => value === marker ? 21 as any : null)
  registerRenderer(21 as any, (fiber, parent, anchor) => {
    reconcileChildren(fiber, [null, fiber.v.children, null], parent, anchor)
    fiber.m = fiber.v
  })
  const container = document.createElement('div'), root = createRoot(container)
  try {
    await act(() => root.render(createElement(type, null, <button>first</button>)))
    const button = container.firstChild
    await act(() => root.render(createElement(type, null, <button>second</button>)))
    expect(container.firstChild).toBe(button)
    expect(container.innerHTML).toBe('<button>second</button>')
  } finally { await act(() => root.unmount()) }
})
