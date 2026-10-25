import { afterEach, expect, it, vi } from 'vitest'
import React, { act, useEffect, useState } from 'react'
import { act as domAct } from 'react-dom/test-utils'
import { createRoot, type Root } from 'react-dom/client'

const roots: Root[] = []
afterEach(() => {
  for (const root of roots.splice(0)) act(() => root.unmount())
  vi.useRealTimers()
})
function setup() {
  const container = document.createElement('div')
  const root = createRoot(container)
  roots.push(root)
  return { container, root }
}

it('shares act across React and DOM test utilities', () => {
  expect(React.act).toBe(act)
  expect(domAct).toBe(act)
})

it('flushes effects and their cascading updates before a synchronous scope returns', () => {
  const { container, root } = setup()
  const events: number[] = []
  function App() {
    const [value, set] = useState(0)
    useEffect(() => {
      events.push(value)
      if (value < 3) set(value + 1)
    }, [value])
    return <span>{value}</span>
  }
  act(() => root.render(<App />))
  expect(container.textContent).toBe('3')
  expect(events).toEqual([0, 1, 2, 3])
})

it('batches nested synchronous scopes until the outer scope completes', () => {
  const { container, root } = setup()
  const events: number[] = []
  let set!: (value: number) => void
  function App() {
    const [value, update] = useState(0)
    set = update
    useEffect(() => { events.push(value) }, [value])
    return <span>{value}</span>
  }
  act(() => root.render(<App />))
  act(() => {
    set(1)
    act(() => set(2))
    expect(events).toEqual([0])
    set(3)
  })
  expect(container.textContent).toBe('3')
  expect(events).toEqual([0, 3])
})

it('drains promise continuations and subsequent effects when awaited', async () => {
  const { container, root } = setup()
  function App() {
    const [value, set] = useState(0)
    useEffect(() => {
      if (value < 3) Promise.resolve().then(() => set(value + 1))
    }, [value])
    return <span>{value}</span>
  }
  await act(async () => { await Promise.resolve(); root.render(<App />) })
  expect(container.textContent).toBe('3')
})

it('does not depend on fake timers advancing to finish an awaited scope', async () => {
  vi.useFakeTimers()
  const { container, root } = setup()
  await act(() => root.render(<span>ready</span>))
  expect(container.textContent).toBe('ready')
})

it('preserves synchronous exceptions and remains usable afterwards', () => {
  const { container, root } = setup()
  const error = new Error('callback failed')
  expect(() => act(() => { throw error })).toThrow(error)
  act(() => root.render(<span>recovered</span>))
  expect(container.textContent).toBe('recovered')
})

it('rejects async exceptions and remains usable afterwards', async () => {
  const { container, root } = setup()
  await expect(act(async () => { throw new Error('async failure') })).rejects.toThrow('async failure')
  await act(() => root.render(<span>recovered</span>))
  expect(container.textContent).toBe('recovered')
})

it('throws uncaught render errors through act instead of a host event', () => {
  const { root } = setup()
  function Broken(): never { throw new Error('render failed') }
  expect(() => act(() => root.render(<Broken />))).toThrow('render failed')
})

it('throws uncaught effect errors through act', () => {
  const { root } = setup()
  function Broken() { useEffect(() => { throw new Error('effect failed') }, []); return null }
  expect(() => act(() => root.render(<Broken />))).toThrow('effect failed')
})

it('keeps awaited nested synchronous scopes batched inside an async scope', async () => {
  const { container, root } = setup()
  await act(async () => {
    await act(() => root.render(<span>ready</span>))
    expect(container.textContent).toBe('')
  })
  expect(container.textContent).toBe('ready')
})

it('does not corrupt subsequent scopes when an async result is awaited twice', async () => {
  const { container, root } = setup()
  const result = act(async () => { root.render(<span>first</span>); return 42 })
  expect(await result).toBe(42)
  expect(await result).toBe(42)
  act(() => root.render(<span>second</span>))
  expect(container.textContent).toBe('second')
})
