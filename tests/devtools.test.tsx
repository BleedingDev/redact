import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

const { initialize, activate, createBridge } = createRequire(import.meta.url)('react-devtools-inline/backend')
initialize(globalThis)
const hook = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__
const messages: any[] = []
const bridge = createBridge(globalThis, { listen: () => () => {}, send: (event: string, payload: any) => messages.push({ event, payload }) })
activate(globalThis, { bridge })
// Match the extension's default filter, host nodes are hidden in Components.
bridge.emit('savedPreferences', { componentFilters: [{ type: 1, value: 7, isEnabled: true }] })
await Promise.resolve()

describe('official React DevTools backend', () => {
  it('forces and releases Suspense without losing primary state', async () => {
    const container = document.createElement('div')
    function Content() {
      const [value] = React.useState('preserved')
      return <button>{value}</button>
    }
    const root = createRoot(container)
    try {
      flushSync(() => root.render(<React.Suspense fallback={<span>waiting</span>}><Content /></React.Suspense>))
      const [rendererID] = [...hook.renderers.entries()][0] as any
      const backend = hook.rendererInterfaces.get(rendererID)
      backend.flushInitialOperations()
      const button = container.querySelector('button')!
      const id = backend.getElementIDForHostInstance(button)
      expect(backend.inspectElement(1, id, null, true).value.canToggleSuspense).toBe(true)
      backend.overrideSuspense(id, true)
      expect(container.querySelector('span')?.textContent).toBe('waiting')
      expect(button.style.display).toBe('none')
      backend.overrideSuspense(id, false)
      await Promise.resolve()
      expect(container.querySelector('span')).toBeNull()
      expect(container.querySelector('button')).toBe(button)
      expect(button.style.display).not.toBe('none')
      expect(button.textContent).toBe('preserved')
    } finally {
      flushSync(() => root.unmount())
    }
  })

  it('forces and resets an error boundary', () => {
    const container = document.createElement('div')
    const errors: string[] = []
    class Boundary extends React.Component<any, { error: boolean }> {
      state = { error: false }
      static getDerivedStateFromError() { return { error: true } }
      componentDidCatch(error: Error) { errors.push(error.message) }
      render() { return this.state.error ? <span>failed</span> : this.props.children }
    }
    function Content() { return <button>ready</button> }
    const root = createRoot(container)
    try {
      flushSync(() => root.render(<Boundary><Content /></Boundary>))
      const [rendererID, renderer] = [...hook.renderers.entries()][0] as any
      const backend = hook.rendererInterfaces.get(rendererID)
      backend.flushInitialOperations()
      const id = backend.getElementIDForHostInstance(container.firstChild)
      expect(backend.inspectElement(1, id, null, true).value.canToggleError).toBe(true)
      backend.overrideError(id, true)
      expect(container.textContent).toBe('failed')
      expect(errors).toEqual(['Simulated error coming from DevTools'])
      const failedID = backend.getElementIDForHostInstance(container.firstChild)
      expect(backend.inspectElement(2, failedID, null, true).value.isErrored).toBe(true)
      backend.overrideError(failedID, false)
      expect(container.textContent).toBe('ready')
      expect(renderer.findFiberByHostInstance(container.firstChild)).toBeTruthy()
    } finally {
      flushSync(() => root.unmount())
    }
  })

  it('reports owners and preserves component IDs across keyed reordering', () => {
    const container = document.createElement('div')
    function Item({ value }: { value: string; key?: string }) { return <button>{value}</button> }
    function Owner({ values }: { values: string[] }) { return <div>{values.map(value => <Item key={value} value={value} />)}</div> }
    const root = createRoot(container)
    try {
      flushSync(() => root.render(<Owner values={['a', 'b']} />))
      const [rendererID] = [...hook.renderers.entries()][0] as any
      const backend = hook.rendererInterfaces.get(rendererID)
      backend.flushInitialOperations()
      backend.updateComponentFilters([{ type: 1, value: 7, isEnabled: true }])
      const button = container.querySelector('button')!
      const id = backend.getElementIDForHostInstance(button)
      expect(backend.getOwnersList(id)).toEqual(expect.arrayContaining([
        expect.objectContaining({ displayName: 'Owner' }),
        expect.objectContaining({ displayName: 'Item' }),
      ]))
      flushSync(() => root.render(<Owner values={['b', 'a']} />))
      expect(container.querySelectorAll('button')[1]).toBe(button)
      expect(backend.getElementIDForHostInstance(button)).toBe(id)
    } finally {
      flushSync(() => root.unmount())
    }
  })

  it('inspects a Suspense fallback and its replacement without losing the root', async () => {
    const container = document.createElement('div')
    let ready = false
    let resolve!: () => void
    const promise = new Promise<void>(done => { resolve = done })
    function Content() {
      if (!ready) throw promise
      return <button>ready</button>
    }
    function Fallback({ label }: { label: string }) { return <span>{label}</span> }
    const root = createRoot(container)
    try {
      flushSync(() => root.render(<React.Suspense fallback={<Fallback label="waiting" />}><Content /></React.Suspense>))
      const [rendererID] = [...hook.renderers.entries()][0] as any
      const backend = hook.rendererInterfaces.get(rendererID)
      backend.flushInitialOperations()
      backend.updateComponentFilters([{ type: 1, value: 7, isEnabled: true }])
      expect(container.textContent).toBe('waiting')
      const fallbackID = backend.getElementIDForHostInstance(container.firstChild)
      expect(backend.inspectElement(3, fallbackID, null, true).value.props.data.label).toBe('waiting')
      ready = true
      resolve()
      await promise
      await Promise.resolve()
      flushSync(() => {})
      expect(container.textContent).toBe('ready')
      const contentID = backend.getElementIDForHostInstance(container.firstChild)
      expect(contentID).toBeTruthy()
      expect(contentID).not.toBe(fallbackID)
      expect(backend.inspectElement(4, contentID, null, true).type).toBe('full-data')
    } finally {
      flushSync(() => root.unmount())
    }
  })

  it('keeps hook inspection aligned across synchronous downgrades and wrappers', () => {
    const container = document.createElement('div')
    const Context = React.createContext('default')
    const subscribe = () => () => {}
    const snapshot = () => 'snapshot'
    const Component = React.memo(React.forwardRef(function MixedHooks(_props: {}, ref: any) {
      const context = React.useContext(Context)
      React.useTransition()
      React.useDeferredValue('deferred')
      React.useSyncExternalStore(subscribe, snapshot)
      React.useActionState((state: string) => state, 'action')
      React.useOptimistic('optimistic')
      React.useEffectEvent(() => 'event')
      const [tail] = React.useState('tail')
      React.useImperativeHandle(ref, () => ({ tail }))
      return <button>{context}:{tail}</button>
    }))
    const root = createRoot(container)
    try {
      flushSync(() => root.render(<Context.Provider value="provided"><Component /></Context.Provider>))
      const [rendererID, renderer] = [...hook.renderers.entries()][0] as any
      const backend = hook.rendererInterfaces.get(rendererID)
      backend.flushInitialOperations()
      backend.updateComponentFilters([{ type: 1, value: 7, isEnabled: true }])
      const id = backend.getElementIDForHostInstance(container.firstChild)
      const inspected = backend.inspectElement(2, id, null, true)
      expect(inspected.type).toBe('full-data')
      expect(inspected.value.hooks.data).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'Context', value: 'provided' }),
        expect.objectContaining({ name: 'Transition', value: false }),
        expect.objectContaining({ name: 'DeferredValue', value: 'deferred' }),
        expect.objectContaining({ name: 'SyncExternalStore', value: 'snapshot' }),
        expect.objectContaining({ name: 'ActionState', value: 'action' }),
        expect.objectContaining({ name: 'Optimistic', value: 'optimistic' }),
        expect.objectContaining({ name: 'State', value: 'tail' }),
      ]))
      const state = inspected.value.hooks.data.find((item: any) => item.name === 'State')
      renderer.overrideHookState(renderer.findFiberByHostInstance(container.firstChild).return, state.id, [], 'edited')
      expect(container.textContent).toBe('provided:edited')
      expect(backend.getElementIDForHostInstance(container.firstChild)).toBe(id)
    } finally {
      flushSync(() => root.unmount())
    }
  })

  it('attaches, inspects hooks and edits a live component', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    let setCount!: (n: number) => void
    function Counter({ label }: { label: string }) {
      const [count, set] = React.useState(3)
      setCount = set
      const memo = React.useMemo(() => count * 2, [count])
      return <button>{label}:{count}:{memo}</button>
    }
    const root = createRoot(container)
    try {
      flushSync(() => root.render(<Counter label="count" />))
      // Hook inspection replays the component with DevTools' read-only dispatcher.
      const updateCount = setCount
      const [id, renderer] = [...hook.renderers.entries()][0] as any
      const backend = hook.rendererInterfaces.get(id)
      expect(backend).toBeDefined()
      backend.flushInitialOperations()
      backend.updateComponentFilters([{ type: 1, value: 7, isEnabled: true }])
      const fiber = renderer.findFiberByHostInstance(container.firstChild).return
      expect(fiber.type).toBe(Counter)
      const elementID = backend.getElementIDForHostInstance(container.firstChild)
      expect(elementID).toBeTruthy()
      const inspected = backend.inspectElement(1, elementID, null, true)
      expect(inspected.type).toBe('full-data')
      expect(inspected.value.props.data.label).toBe('count')
      expect(inspected.value.hooks.data).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'State', value: 3 }),
        expect.objectContaining({ name: 'Memo', value: 6 }),
      ]))
      backend.startProfiling(true)
      flushSync(() => updateCount(4))
      expect(container.textContent).toBe('count:4:8')
      renderer.overrideHookState(fiber, 0, [], 7)
      expect(container.textContent).toBe('count:7:14')
      renderer.overrideProps(fiber, ['label'], 'edited')
      expect(container.textContent).toBe('edited:7:14')
      backend.stopProfiling()
      const profile = backend.getProfilingData()
      expect(profile.dataForRoots).toHaveLength(1)
      expect(profile.dataForRoots[0].commitData).toHaveLength(3)
      for (const commit of profile.dataForRoots[0].commitData) {
        expect(commit.duration).toBeGreaterThan(0)
        expect(commit.fiberActualDurations.length).toBeGreaterThan(0)
        expect(commit.fiberSelfDurations.every(([, duration]: any) => duration >= 0)).toBe(true)
      }
    } finally {
      flushSync(() => root.unmount())
      container.remove()
    }
    expect([...hook.getFiberRoots(1)]).toHaveLength(0)
  })
})
