import { afterEach, expect, it } from 'vitest'
import { Component, Suspense, startTransition, useDeferredValue, useLayoutEffect, useState, useTransition } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

const cleanups: Array<() => void> = []
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup() })
const tick = () => new Promise(resolve => setTimeout(resolve, 10))
function gate() {
  let release!: () => void
  const resource = { ready: false, promise: new Promise<void>(resolve => { release = resolve }), release() { resource.ready = true; release() } }
  return resource
}
function setup(element: any) {
  const container = document.createElement('div'), root = createRoot(container)
  document.body.appendChild(container)
  cleanups.push(() => { root.unmount(); container.remove() })
  flushSync(() => root.render(element))
  return container
}

it('retains visible state and effects until a transition can commit', async () => {
  const resource = gate(), effects: string[] = []
  let begin!: () => void
  function Result({ value }: { value: number }) {
    useLayoutEffect(() => { effects.push(`mount ${value}`); return () => { effects.push(`cleanup ${value}`) } }, [value])
    if (value && !resource.ready) throw resource.promise
    return <b>{value}</b>
  }
  function App() {
    const [value, set] = useState(0), [pending, transition] = useTransition()
    begin = () => transition(() => set(1))
    return <><output>{String(pending)}</output><Suspense fallback="Loading"><Result value={value} /></Suspense></>
  }
  const container = setup(<App />), original = container.querySelector('b')
  begin(); await tick()
  expect(container.textContent).toBe('true0')
  expect(container.querySelector('b')).toBe(original)
  expect(effects).toEqual(['mount 0'])
  resource.release(); await tick()
  expect(container.textContent).toBe('false1')
  expect(effects).toEqual(['mount 0', 'cleanup 0', 'mount 1'])
})

it('commits urgent state beside a suspended deferred value', async () => {
  const resource = gate()
  let set!: (value: string) => void
  function Result({ value }: { value: string }) {
    if (value === 'beta' && !resource.ready) throw resource.promise
    return <b>{value}</b>
  }
  function App() {
    const [query, update] = useState('alpha'); set = update
    const deferred = useDeferredValue(query)
    return <><output>{query}:{String(query !== deferred)}</output><Suspense fallback="Loading"><Result value={deferred} /></Suspense></>
  }
  const container = setup(<App />)
  set('beta'); await tick()
  expect(container.textContent).toBe('beta:truealpha')
  resource.release(); await tick()
  expect(container.textContent).toBe('beta:falsebeta')
})

it('rebases an urgent update after a suspended transition in source order', async () => {
  const resource = gate()
  let set!: (value: number | ((previous: number) => number)) => void
  function Result({ value }: { value: number }) {
    if (value === 1 && !resource.ready) throw resource.promise
    return <b>{value}</b>
  }
  function App() {
    const [value, update] = useState(0); set = update
    return <Suspense fallback="Loading"><Result value={value} /></Suspense>
  }
  const container = setup(<App />)
  startTransition(() => set(value => value + 1)); await tick()
  expect(container.textContent).toBe('0')
  set(10); await tick()
  expect(container.textContent).toBe('10')
  resource.release(); await tick()
  expect(container.textContent).toBe('10')
})

it('allows a new Suspense boundary to show its fallback during a transition', async () => {
  const resource = gate()
  let set!: (value: boolean) => void
  function Child() { if (!resource.ready) throw resource.promise; return <b>Ready</b> }
  function App() {
    const [show, update] = useState(false); set = update
    return show ? <Suspense fallback="Loading"><Child /></Suspense> : <b>Home</b>
  }
  const container = setup(<App />)
  startTransition(() => set(true)); await tick()
  expect(container.textContent).toBe('Loading')
  resource.release()
  // React keeps a newly shown fallback visible briefly before revealing content.
  await expect.poll(() => container.textContent).toBe('Ready')
})

it('keeps overlapping transitions pending until their latest work commits', async () => {
  const first = gate(), second = gate()
  let begin!: (value: number) => void
  function Result({ value }: { value: number }) {
    const resource = value === 1 ? first : second
    if (value && !resource.ready) throw resource.promise
    return <b>{value}</b>
  }
  function App() {
    const [value, set] = useState(0), [pending, transition] = useTransition()
    begin = value => transition(() => set(value))
    return <><output>{String(pending)}</output><Suspense fallback="Loading"><Result value={value} /></Suspense></>
  }
  const container = setup(<App />)
  begin(1); await tick()
  begin(2); await tick()
  first.release(); await tick()
  expect(container.textContent).toBe('true0')
  second.release(); await tick()
  expect(container.textContent).toBe('false2')
})

it('supersedes a blocked deferred value without waiting for its old promise', async () => {
  const resource = gate()
  let set!: (value: string) => void
  function Result({ value }: { value: string }) {
    if (value === 'blocked' && !resource.ready) throw resource.promise
    return <b>{value}</b>
  }
  function App() {
    const [query, update] = useState('first'); set = update
    const deferred = useDeferredValue(query)
    return <><output>{query}</output><Suspense fallback="Loading"><Result value={deferred} /></Suspense></>
  }
  const container = setup(<App />)
  set('blocked'); await tick()
  expect(container.textContent).toBe('blockedfirst')
  set('latest'); await tick()
  expect(container.textContent).toBe('latestlatest')
  resource.release(); await tick()
  expect(container.textContent).toBe('latestlatest')
})

it('rebases class updates and runs each callback once after the matching commit', async () => {
  const resource = gate(), callbacks: string[] = []
  let instance!: Counter
  class Counter extends Component<{}, { value: number }> {
    state = { value: 0 }
    render() {
      instance = this
      if (this.state.value === 1 && !resource.ready) throw resource.promise
      return <b>{this.state.value}</b>
    }
  }
  const container = setup(<Suspense fallback="Loading"><Counter /></Suspense>)
  startTransition(() => instance.setState(({ value }) => ({ value: value + 1 }), () => callbacks.push('transition')))
  await tick()
  expect(container.textContent).toBe('0')
  expect(callbacks).toEqual([])
  instance.setState({ value: 10 }, () => callbacks.push('urgent'))
  await tick()
  expect(container.textContent).toBe('10')
  expect(callbacks).toEqual(['urgent', 'transition'])
  resource.release(); await tick()
  expect(callbacks).toEqual(['urgent', 'transition'])
  expect(container.textContent).toBe('10')
})

it('settles pending scopes when a root is unmounted before a transition resolves', async () => {
  const resource = gate(), renders: number[] = []
  let begin!: () => void
  function App() {
    const [value, set] = useState(0), [, transition] = useTransition()
    begin = () => transition(() => set(1))
    renders.push(value)
    if (value && !resource.ready) throw resource.promise
    return <b>{value}</b>
  }
  const container = setup(<App />)
  begin(); await tick()
  cleanups.pop()!()
  const count = renders.length
  resource.release(); await tick()
  expect(container.textContent).toBe('')
  expect(renders).toHaveLength(count)
})

it('routes a transition render failure to an already mounted error boundary', async () => {
  let begin!: () => void
  function Child() {
    const [value, set] = useState(0)
    begin = () => startTransition(() => set(1))
    if (value) throw new Error('transition render failed')
    return <b>Ready</b>
  }
  class Boundary extends Component<{ children: any }, { failed: boolean }> {
    state = { failed: false }
    static getDerivedStateFromError() { return { failed: true } }
    render() { return this.state.failed ? <b>Recovered</b> : this.props.children }
  }
  const container = setup(<Boundary><Child /></Boundary>)
  begin(); await tick()
  expect(container.textContent).toBe('Recovered')
})
