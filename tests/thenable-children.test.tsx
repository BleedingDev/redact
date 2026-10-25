import { expect, it, vi } from 'vitest'
import { act, Component, lazy, Suspense, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'

it('does not revive a nested pending boundary abandoned by an outer suspension', async () => {
  const container = document.createElement('div'), root = createRoot(container)
  let first!: (value: any) => void, second!: (value: any) => void
  const First = lazy(() => new Promise<any>(yes => { first = yes }))
  const Second = lazy(() => new Promise<any>(yes => { second = yes }))
  const effect = vi.fn()
  function Loaded() { useEffect(effect, []); return <button>First</button> }
  try {
    await act(() => root.render(<Suspense fallback="Outer loading"><p key="old">Old</p></Suspense>))
    await act(() => root.render(<Suspense fallback="Outer loading"><Suspense key="inner" fallback="Inner loading"><First /></Suspense><Second key="second" /></Suspense>))
    await act(async () => first({ default: Loaded }))
    expect(container.querySelectorAll('button')).toHaveLength(0)
    expect(effect).not.toHaveBeenCalled()
    await act(async () => second({ default: () => <span>Second</span> }))
    expect(container.textContent).toBe('FirstSecond')
    expect(container.querySelectorAll('button')).toHaveLength(1)
    expect(effect).toHaveBeenCalledTimes(1)
  } finally { await act(() => root.unmount()) }
})

it('renders promised children and preserves committed state through a fresh promise', async () => {
  const container = document.createElement('div'), root = createRoot(container)
  let resolve!: (value: any) => void
  function Counter({ label }: { label: string }) { const [n, set] = useState(0); return <button onClick={() => set(n + 1)}>{label}:{n}</button> }
  const pending = new Promise(yes => { resolve = yes })
  try {
    await act(async () => root.render(<Suspense fallback="Loading"><Counter label="old"/></Suspense>))
    const button = container.querySelector('button')!
    await act(() => button.click())
    await act(() => root.render(<Suspense fallback="Loading">{pending as any}</Suspense>))
    expect(container.textContent).toContain('Loading')
    expect(container.querySelector('button')).toBe(button)
    await act(async () => { resolve(<Counter label="new"/>); await pending })
    expect(container.querySelector('button')).toBe(button)
    expect(container.textContent).toBe('new:1')
  } finally { await act(() => root.unmount()) }
})

it('unwraps fulfilled promises in arrays and iterables without losing sibling order', async () => {
  const container = document.createElement('div'), root = createRoot(container)
  const first = Promise.resolve(<b key="first">first</b>)
  const second = Promise.resolve(<i key="second">second</i>)
  function Children() { return ['before', first, new Set([second]), 'after'] as any }
  try {
    await act(async () => root.render(<Suspense fallback="Loading"><Children/></Suspense>))
    expect(container.textContent).toBe('beforefirstsecondafter')
    expect([...container.children].map(n => n.tagName)).toEqual(['B', 'I'])
  } finally { await act(() => root.unmount()) }
})

it('routes a rejected child promise through the error boundary', async () => {
  const container = document.createElement('div'), caught = vi.fn(), root = createRoot(container, { onCaughtError: caught })
  const failure = new Error('child promise failed')
  const promise = Promise.reject(failure)
  class Boundary extends Component<{ children: any }, { error: boolean }> {
    state = { error: false }
    static getDerivedStateFromError() { return { error: true } }
    render() { return this.state.error ? 'Caught child promise' : this.props.children }
  }
  try {
    await act(async () => root.render(<Boundary><Suspense fallback="Loading">{promise as any}</Suspense></Boundary>))
    expect(container.textContent).toBe('Caught child promise')
    expect(caught).toHaveBeenCalledWith(failure, expect.any(Object))
  } finally { await act(() => root.unmount()) }
})
