import { expect, it } from 'vitest'
import { useSyncExternalStoreWithSelector } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

it('retains equal selections while advancing the cached store snapshot', () => {
  let snapshot = { count: 1, other: 0 }
  const listeners = new Set<() => void>()
  const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
  const getSnapshot = () => snapshot
  const seen: unknown[] = []
  let selections = 0
  const selector = (state: typeof snapshot) => { selections++; return { count: state.count } }
  function App() {
    const value = useSyncExternalStoreWithSelector(subscribe, getSnapshot, undefined, selector, (a, b) => a.count === b.count)
    seen.push(value)
    return <b>{value.count}</b>
  }
  const container = document.createElement('div'), root = createRoot(container)
  flushSync(() => root.render(<App />))
  const first = seen.at(-1)
  flushSync(() => { snapshot = { count: 1, other: 1 }; listeners.forEach(listener => listener()) })
  const afterChange = selections
  flushSync(() => listeners.forEach(listener => listener()))
  expect(selections).toBe(afterChange)
  expect(seen.at(-1)).toBe(first)
  flushSync(() => { snapshot = { count: 2, other: 1 }; listeners.forEach(listener => listener()) })
  expect(container.textContent).toBe('2')
  expect(seen.at(-1)).not.toBe(first)
  root.unmount()
  expect(listeners.size).toBe(0)
})

it('supports undefined selections and replacement selector functions', () => {
  const snapshot = { count: 2 }
  const subscribe = () => () => {}
  const getSnapshot = () => snapshot
  const values: unknown[] = []
  function App({ pick }: { pick: (value: typeof snapshot) => number | undefined }) {
    const value = useSyncExternalStoreWithSelector(subscribe, getSnapshot, undefined, pick, Object.is)
    values.push(value)
    return <b>{value ?? 'empty'}</b>
  }
  const container = document.createElement('div'), root = createRoot(container)
  flushSync(() => root.render(<App pick={() => undefined} />))
  expect(values.at(-1)).toBeUndefined()
  flushSync(() => root.render(<App pick={state => state.count} />))
  expect(container.textContent).toBe('2')
  flushSync(() => root.render(<App pick={() => undefined} />))
  expect(container.textContent).toBe('empty')
  root.unmount()
})
