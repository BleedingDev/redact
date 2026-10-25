import { expect, it, vi } from 'vitest'
import { act, Component, createRef, forwardRef, lazy, memo, Suspense, use, useState } from 'react'
import { createRoot } from 'react-dom/client'

it('resolves lazy memo/ref wrappers and preserves their ref and state', async () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  const ref = createRef<HTMLButtonElement>()
  const Counter = lazy(async () => ({
    default: memo(forwardRef<HTMLButtonElement, {}>((_props, ref) => {
      const [count, setCount] = useState(0)
      return <button ref={ref} onClick={() => setCount(count + 1)}>{count}</button>
    })),
  }))
  try {
    await act(async () => {
      root.render(<Suspense fallback="Loading"><Counter ref={ref} /></Suspense>)
    })
    const button = container.querySelector('button')!
    expect(button).not.toBeNull()
    expect(ref.current).toBe(button)
    expect(button.textContent).toBe('0')
    await act(() => button.click())
    expect(container.querySelector('button')).toBe(button)
    expect(button.textContent).toBe('1')
  } finally {
    await act(() => root.unmount())
  }
  expect(ref.current).toBeNull()
})

it('resolves a frozen promise without changing the loader result', async () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  let resolve!: (value: { default: () => JSX.Element }) => void
  const promise = Object.freeze(new Promise<{ default: () => JSX.Element }>(yes => { resolve = yes }))
  const loader = vi.fn(() => promise)
  const Content = lazy(loader)
  try {
    await act(() => root.render(<Suspense fallback="Loading"><Content /></Suspense>))
    expect(container.textContent).toBe('Loading')
    await act(async () => { resolve({ default: () => <button>Resolved</button> }); await promise })
    const button = container.querySelector('button')
    expect(button?.textContent).toBe('Resolved')
    await act(() => root.render(<Suspense fallback="Loading"><Content /></Suspense>))
    expect(container.querySelector('button')).toBe(button)
    expect(loader).toHaveBeenCalledTimes(1)
    expect(Object.isFrozen(promise)).toBe(true)
  } finally { await act(() => root.unmount()) }
})

it('renders a synchronously fulfilled thenable without committing a fallback', async () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  const fallback = vi.fn(() => <span>Loading</span>)
  const Fallback = fallback
  const result = { default: () => <button>Immediate</button> }
  const loader = vi.fn(() => ({ then(resolve: (value: typeof result) => void) { resolve(result) } }) as unknown as Promise<typeof result>)
  const Content = lazy(loader)
  try {
    await act(() => root.render(<Suspense fallback={<Fallback />}><Content /></Suspense>))
    expect(container.textContent).toBe('Immediate')
    expect(fallback).not.toHaveBeenCalled()
    expect(loader).toHaveBeenCalledTimes(1)
  } finally { await act(() => root.unmount()) }
})

it('keeps the original rejection cached across boundary remounts', async () => {
  const container = document.createElement('div')
  const caught = vi.fn()
  const root = createRoot(container, { onCaughtError: caught })
  const error = new Error('loader rejected')
  const loader = vi.fn(() => Promise.reject(error))
  const Content = lazy(loader)
  class Boundary extends Component<{ children: any; key?: number }, { failed: boolean }> {
    state = { failed: false }
    static getDerivedStateFromError() { return { failed: true } }
    render() { return this.state.failed ? 'Failed' : this.props.children }
  }
  try {
    for (const key of [1, 2]) {
      await act(async () => {
        root.render(<Boundary key={key}><Suspense fallback="Loading"><Content /></Suspense></Boundary>)
      })
      expect(container.textContent).toBe('Failed')
    }
    expect(loader).toHaveBeenCalledTimes(1)
    expect(caught).toHaveBeenCalledTimes(2)
    expect(caught.mock.calls.every(([failure]) => failure === error)).toBe(true)
  } finally { await act(() => root.unmount()) }
})

it('shares a module promise with use without confusing the module and its default export', async () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  const promise = Promise.resolve({ default: () => <button>Shared</button> })
  const Content = lazy(() => promise)
  function ReadModule() {
    const module = use(promise)
    return <module.default />
  }
  try {
    await act(async () => {
      root.render(<Suspense fallback="Loading"><Content /><ReadModule /></Suspense>)
    })
    expect([...container.querySelectorAll('button')].map(button => button.textContent)).toEqual(['Shared', 'Shared'])
  } finally { await act(() => root.unmount()) }
})

it.each([false, true])('preserves state across fresh lazy wrappers for the same component, keyed=%s', async keyed => {
  const container = document.createElement('div')
  const root = createRoot(container)
  function Counter({ label }: { label: string }) {
    const [count, setCount] = useState(0)
    return <button onClick={() => setCount(count + 1)}>{label}:{count}</button>
  }
  const First = lazy(async () => ({ default: Counter }))
  const Second = lazy(async () => ({ default: Counter }))
  try {
    await act(async () => root.render(<Suspense fallback="Loading"><First key={keyed ? 'counter' : undefined} label="first"/><span key="tail">tail</span></Suspense>))
    const button = container.querySelector('button')!
    await act(() => button.click())
    expect(button.textContent).toBe('first:1')
    const children = [<Second key={keyed ? 'counter' : undefined} label="second"/>, <span key="tail">tail</span>]
    if (keyed) children.unshift(<span key="head">head</span>)
    await act(async () => root.render(<Suspense fallback="Loading">{children}</Suspense>))
    expect(container.querySelector('button')).toBe(button)
    expect(button.textContent).toBe('second:1')
  } finally { await act(() => root.unmount()) }
})

it('preserves state when a lazy component and its resolved type replace each other', async () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  function Counter({ label }: { label: string }) {
    const [count, setCount] = useState(0)
    return <button onClick={() => setCount(count + 1)}>{label}:{count}</button>
  }
  const Deferred = lazy(async () => ({ default: Counter }))
  try {
    await act(async () => root.render(<Suspense fallback="Loading"><Counter label="direct"/></Suspense>))
    const button = container.querySelector('button')!
    await act(() => button.click())
    await act(async () => root.render(<Suspense fallback="Loading"><Deferred label="lazy"/></Suspense>))
    expect(container.querySelector('button')).toBe(button)
    expect(button.textContent).toBe('lazy:1')
    await act(async () => root.render(<Suspense fallback="Loading"><Counter label="again"/></Suspense>))
    expect(container.querySelector('button')).toBe(button)
    expect(button.textContent).toBe('again:1')
  } finally { await act(() => root.unmount()) }
})
