import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'
import * as Redact from 'react'
import * as RedactDOM from 'react-dom'
import * as RedactClient from 'react-dom/client'

const require = createRequire(import.meta.url)
require('react-devtools-inline/backend').initialize(globalThis)
const hook = (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__
const React = require('react')
const ReactDOM = require('react-dom')
const ReactClient = require('react-dom/client')

const runtimes = [
  { name: 'React', R: React, dom: ReactDOM, client: ReactClient, packageName: 'react-dom' },
  { name: 'Redact', R: Redact, dom: RedactDOM, client: RedactClient, packageName: '@tanstack/redact' },
]

describe.each(runtimes)('$name with the official DevTools backend', ({ R, dom, client, packageName }) => {
  function backend() {
    const entry = [...hook.renderers.entries()].find(([, renderer]: any) => renderer.rendererPackageName === packageName) as any
    const result = hook.rendererInterfaces.get(entry[0])
    result.flushInitialOperations()
    result.updateComponentFilters([{ type: 1, value: 7, isEnabled: true }])
    return result
  }

  it('records separate commits, effects, hook changes, and update attribution', async () => {
    const container = document.createElement('div')
    let update!: (value: number) => void
    const work = () => { const end = performance.now() + 0.2; while (performance.now() < end) {} }
    function Profiled() {
      const [count, set] = R.useState(0)
      update = set
      R.useLayoutEffect(work, [count])
      R.useEffect(work, [count])
      return R.createElement('button', null, count)
    }
    const root = client.createRoot(container)
    try {
      dom.flushSync(() => root.render(R.createElement(Profiled)))
      await Promise.resolve()
      const updateCount = update
      const api = backend()
      const id = api.getElementIDForHostInstance(container.firstChild)
      api.startProfiling(true)
      dom.flushSync(() => updateCount(1))
      dom.flushSync(() => updateCount(2))
      await Promise.resolve()
      api.stopProfiling()
      const commits = api.getProfilingData().dataForRoots[0].commitData
      expect(commits).toHaveLength(2)
      for (const commit of commits) {
        expect(commit.duration).toBeGreaterThan(0)
        expect(commit.effectDuration).toBeGreaterThan(0)
        expect(commit.passiveEffectDuration).toBeGreaterThan(0)
        expect(commit.updaters).toEqual(expect.arrayContaining([expect.objectContaining({ displayName: 'Profiled' })]))
        expect(commit.changeDescriptions).toEqual(expect.arrayContaining([
          [id, expect.objectContaining({ didHooksChange: true })],
        ]))
      }
    } finally { dom.flushSync(() => root.unmount()); await Promise.resolve() }
  })

  it('inspects use() thenables without shifting later state hooks', () => {
    const container = document.createElement('div')
    const value = Object.assign(Promise.resolve('resolved'), { status: 'fulfilled', value: 'resolved' })
    function UsesPromise() {
      const result = R.use(value)
      const [tail] = R.useState('tail')
      return R.createElement('button', null, `${result}:${tail}`)
    }
    const root = client.createRoot(container)
    try {
      dom.flushSync(() => root.render(R.createElement(UsesPromise)))
      const api = backend()
      const id = api.getElementIDForHostInstance(container.firstChild)
      expect(api.inspectElement(1, id, null, true).value.hooks.data).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'Use', value: 'resolved' }),
        expect.objectContaining({ name: 'State', value: 'tail' }),
      ]))
    } finally { dom.flushSync(() => root.unmount()) }
  })

  it('finds portal hosts and cleans up multiple roots', () => {
    const container = document.createElement('div')
    const target = document.createElement('div')
    const second = document.createElement('div')
    function PortalChild({ label }: any) { return R.createElement('button', null, label) }
    function App() { return dom.createPortal(R.createElement(PortalChild, { label: 'portal' }), target) }
    const root = client.createRoot(container)
    const other = client.createRoot(second)
    try {
      dom.flushSync(() => { root.render(R.createElement(App)); other.render(R.createElement(PortalChild, { label: 'second' })) })
      const api = backend()
      const id = api.getElementIDForHostInstance(target.firstChild)
      expect(api.inspectElement(1, id, null, true).value.props.data.label).toBe('portal')
      expect(api.findHostInstancesForElementID(id)).toContain(target.firstChild)
      expect(api.getElementIDForHostInstance(second.firstChild)).not.toBe(id)
      dom.flushSync(() => root.unmount())
      expect(target.childNodes).toHaveLength(0)
      expect(api.inspectElement(2, id, null, true).type).toBe('not-found')
    } finally { dom.flushSync(() => other.unmount()) }
  })

  it('inspects retained Activity children while hidden', () => {
    const container = document.createElement('div')
    function Child() { const [value] = R.useState('retained'); return R.createElement('button', null, value) }
    const root = client.createRoot(container)
    const render = (mode: string) => root.render(R.createElement(R.Activity, { mode }, R.createElement(Child)))
    try {
      dom.flushSync(() => render('visible'))
      const api = backend()
      const button = container.firstChild as HTMLElement
      const id = api.getElementIDForHostInstance(button)
      dom.flushSync(() => render('hidden'))
      expect(button.style.display).toBe('none')
      expect(api.inspectElement(1, id, null, true).value.hooks.data).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'State', value: 'retained' })]))
      dom.flushSync(() => render('visible'))
      expect(container.firstChild).toBe(button)
      expect(api.getElementIDForHostInstance(button)).toBe(id)
    } finally { dom.flushSync(() => root.unmount()) }
  })

  it('hydrates without replacing the server DOM and labels the root', async () => {
    const container = document.createElement('div')
    container.innerHTML = '<button>SSR</button>'
    const button = container.firstChild
    function Hydrated() { return R.createElement('button', null, 'SSR') }
    const root = client.hydrateRoot(container, R.createElement(Hydrated))
    try {
      const api = backend()
      await expect.poll(() => api.getElementIDForHostInstance(button), { timeout: 2000 }).toBeTruthy()
      const id = api.getElementIDForHostInstance(button)
      expect(container.firstChild).toBe(button)
      expect(api.inspectElement(1, id, null, true).value.rootType).toBe('hydrateRoot()')
    } finally { dom.flushSync(() => root.unmount()) }
  })

  it('inspects lazy and memo-wrapped class components', async () => {
    const container = document.createElement('div')
    class Child extends R.Component {
      state = { count: 2 }
      render() { return R.createElement('button', null, this.state.count) }
    }
    const Lazy = R.lazy(() => Promise.resolve({ default: Child }))
    const Memo = R.memo(Child)
    const root = client.createRoot(container)
    try {
      dom.flushSync(() => root.render(R.createElement(R.Suspense, { fallback: 'loading' }, R.createElement(Lazy), R.createElement(Memo))))
      await expect.poll(() => container.querySelectorAll('button').length, { timeout: 2000 }).toBe(2)
      const api = backend()
      for (const button of container.querySelectorAll('button')) {
        const id = api.getElementIDForHostInstance(button)
        expect(api.inspectElement(1, id, null, true).value.state.data.count).toBe(2)
        dom.flushSync(() => api.overrideValueAtPath('state', id, null, ['count'], 3))
        expect(button.textContent).toBe('3')
      }
    } finally { dom.flushSync(() => root.unmount()) }
  })

  it('inspects and edits props and state through backend commands', () => {
    const container = document.createElement('div')
    function Counter({ label }: any) {
      const [count] = R.useState(3)
      const double = R.useMemo(() => count * 2, [count])
      return R.createElement('button', null, `${label}:${count}:${double}`)
    }
    const root = client.createRoot(container)
    try {
      dom.flushSync(() => root.render(R.createElement(Counter, { label: 'count' })))
      const api = backend()
      const id = api.getElementIDForHostInstance(container.firstChild)
      const inspection = api.inspectElement(1, id, null, true)
      expect(inspection.type).toBe('full-data')
      expect(inspection.value.props.data.label).toBe('count')
      expect(inspection.value.hooks.data).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'State', value: 3 }),
        expect.objectContaining({ name: 'Memo', value: 6 }),
      ]))
      dom.flushSync(() => api.overrideValueAtPath('hooks', id, 0, [], 7))
      expect(container.textContent).toBe('count:7:14')
      dom.flushSync(() => api.overrideValueAtPath('props', id, null, ['label'], 'edited'))
      expect(container.textContent).toBe('edited:7:14')
      expect(api.getElementIDForHostInstance(container.firstChild)).toBe(id)
    } finally { dom.flushSync(() => root.unmount()) }
  })

  it('preserves an explicit memo display name', () => {
    const container = document.createElement('div')
    const Named = R.memo(function Inner() { return R.createElement('button', null, 'named') })
    Named.displayName = 'NamedMemo'
    const root = client.createRoot(container)
    try {
      dom.flushSync(() => root.render(R.createElement(Named)))
      const api = backend()
      const id = api.getElementIDForHostInstance(container.firstChild)
      expect(api.getOwnersList(id).at(-1).displayName).toBe('NamedMemo')
    } finally { dom.flushSync(() => root.unmount()) }
  })

  it('forces and releases Suspense while preserving state and the DOM', async () => {
    const container = document.createElement('div')
    function Content() {
      const [value] = R.useState('preserved')
      return R.createElement('button', null, value)
    }
    const root = client.createRoot(container)
    try {
      dom.flushSync(() => root.render(R.createElement(R.Suspense, { fallback: R.createElement('span', null, 'waiting') }, R.createElement(Content))))
      const api = backend()
      const button = container.querySelector('button')!
      const id = api.getElementIDForHostInstance(button)
      expect(api.inspectElement(1, id, null, true).value.canToggleSuspense).toBe(true)
      dom.flushSync(() => api.overrideSuspense(id, true))
      expect(container.querySelector('span')?.textContent).toBe('waiting')
      expect(button.style.display).toBe('none')
      dom.flushSync(() => api.overrideSuspense(id, false))
      await expect.poll(() => container.querySelector('span'), { timeout: 2000 }).toBeNull()
      expect(container.querySelector('button')).toBe(button)
      expect(button.textContent).toBe('preserved')
    } finally { dom.flushSync(() => root.unmount()) }
  })

  it('forces and clears an error boundary', async () => {
    const container = document.createElement('div')
    const errors: string[] = []
    class Boundary extends R.Component {
      state = { error: false }
      static getDerivedStateFromError() { return { error: true } }
      static getDerivedStateFromProps(props: any) { return { label: props.label } }
      componentDidCatch(error: Error) { errors.push(error.message) }
      render() { return this.state.error ? R.createElement('span', null, 'failed') : this.props.children }
    }
    function Content() { return R.createElement('button', null, 'ready') }
    const instance = R.createRef()
    const root = client.createRoot(container, { onCaughtError() {} })
    try {
      dom.flushSync(() => root.render(R.createElement(Boundary, { ref: instance, label: 'derived' }, R.createElement(Content))))
      const api = backend()
      const id = api.getElementIDForHostInstance(container.firstChild)
      expect(api.inspectElement(1, id, null, true).value.canToggleError).toBe(true)
      dom.flushSync(() => api.overrideError(id, true))
      expect(container.textContent).toBe('failed')
      expect(errors).toEqual(['Simulated error coming from DevTools'])
      const failedID = api.getElementIDForHostInstance(container.firstChild)
      dom.flushSync(() => api.overrideError(failedID, false))
      await expect.poll(() => container.textContent, { timeout: 2000 }).toBe('ready')
      expect(instance.current.state.label).toBe('derived')
    } finally { dom.flushSync(() => root.unmount()) }
  })

  it('edits class state and props', () => {
    const container = document.createElement('div')
    class Counter extends R.Component {
      state = { count: 1 }
      render() { return R.createElement('button', null, `${this.props.label}:${this.state.count}`) }
    }
    const root = client.createRoot(container)
    try {
      dom.flushSync(() => root.render(R.createElement(Counter, { label: 'count' })))
      const api = backend()
      const id = api.getElementIDForHostInstance(container.firstChild)
      dom.flushSync(() => api.overrideValueAtPath('state', id, null, ['count'], 7))
      expect(container.textContent).toBe('count:7')
      dom.flushSync(() => api.overrideValueAtPath('props', id, null, ['label'], 'edited'))
      expect(container.textContent).toBe('edited:7')
    } finally { dom.flushSync(() => root.unmount()) }
  })

  it('reports and resets a naturally caught error', async () => {
    const container = document.createElement('div')
    let fail = true
    class Boundary extends R.Component {
      state = { error: false }
      static getDerivedStateFromError() { return { error: true } }
      render() { return this.state.error ? R.createElement('button', null, 'failed') : this.props.children }
    }
    function Child() { if (fail) throw new Error('actual failure'); return R.createElement('button', null, 'ready') }
    const root = client.createRoot(container, { onCaughtError() {} })
    try {
      dom.flushSync(() => root.render(R.createElement(Boundary, null, R.createElement(Child))))
      const api = backend()
      const id = api.getElementIDForHostInstance(container.firstChild)
      expect(api.inspectElement(1, id, null, true).value.isErrored).toBe(true)
      fail = false
      dom.flushSync(() => api.overrideError(id, false))
      await expect.poll(() => container.textContent, { timeout: 2000 }).toBe('ready')
    } finally { dom.flushSync(() => root.unmount()) }
  })

  it('attributes render and effect warnings to the component', async () => {
    const container = document.createElement('div')
    function Warns() {
      console.warn('devtools render warning')
      R.useLayoutEffect(() => { console.warn('devtools layout warning') }, [])
      R.useEffect(() => { console.warn('devtools passive warning') }, [])
      return R.createElement('button', null, 'warnings')
    }
    const root = client.createRoot(container)
    try {
      dom.flushSync(() => root.render(R.createElement(Warns)))
      await Promise.resolve()
      const api = backend()
      const id = api.getElementIDForHostInstance(container.firstChild)
      const warnings = api.inspectElement(1, id, null, true).value.warnings
      for (const phase of ['render', 'layout', 'passive']) {
        expect(warnings).toEqual(expect.arrayContaining([[`devtools ${phase} warning`, 1]]))
      }
      api.clearWarningsForElementID(id)
      expect(api.inspectElement(2, id, null, true).value.warnings).toEqual([])
    } finally { dom.flushSync(() => root.unmount()); await Promise.resolve() }
  })

  it('deletes and renames nested props and hook state', () => {
    const container = document.createElement('div')
    function Editable({ data }: any) {
      const [state] = R.useState({ old: 1, remove: 2 })
      return R.createElement('button', null, JSON.stringify({ data, state }))
    }
    const root = client.createRoot(container)
    try {
      dom.flushSync(() => root.render(R.createElement(Editable, { data: { old: 3, remove: 4 } })))
      const api = backend()
      const id = api.getElementIDForHostInstance(container.firstChild)
      dom.flushSync(() => api.renamePath('hooks', id, 0, ['old'], ['new']))
      dom.flushSync(() => api.deletePath('hooks', id, 0, ['remove']))
      dom.flushSync(() => api.renamePath('props', id, null, ['data', 'old'], ['data', 'new']))
      dom.flushSync(() => api.deletePath('props', id, null, ['data', 'remove']))
      expect(JSON.parse(container.textContent!)).toEqual({ data: { new: 3 }, state: { new: 1 } })
    } finally { dom.flushSync(() => root.unmount()) }
  })

  it('keeps bailed-out siblings inspectable and attributes sparse profiles', () => {
    const container = document.createElement('div')
    let update!: (value: number) => void
    function Leaf({ label }: any) {
      const [count, set] = R.useState(0)
      if (label === 'left') update = set
      return R.createElement('button', null, `${label}:${count}`)
    }
    function App() { return R.createElement('div', null, R.createElement(Leaf, { label: 'left' }), R.createElement(Leaf, { label: 'right' })) }
    const root = client.createRoot(container)
    try {
      dom.flushSync(() => root.render(R.createElement(App)))
      const api = backend()
      const left = api.getElementIDForHostInstance(container.querySelectorAll('button')[0])
      const right = api.getElementIDForHostInstance(container.querySelectorAll('button')[1])
      const set = update
      api.startProfiling(true)
      for (let count = 1; count <= 3; count++) dom.flushSync(() => set(count))
      api.stopProfiling()
      const commits = api.getProfilingData().dataForRoots[0].commitData
      expect(commits).toHaveLength(3)
      for (const commit of commits) {
        expect(commit.fiberActualDurations.some(([id]: any) => id === left)).toBe(true)
        expect(commit.fiberActualDurations.some(([id]: any) => id === right)).toBe(false)
      }
      expect(api.inspectElement(1, right, null, true).value.props.data.label).toBe('right')
      dom.flushSync(() => api.overrideValueAtPath('hooks', right, 0, [], 9))
      expect(container.textContent).toBe('left:3right:9')
      expect(api.getElementIDForHostInstance(container.querySelectorAll('button')[1])).toBe(right)
    } finally { dom.flushSync(() => root.unmount()) }
  })

  it('reports custom hook labels, source locations, and owners', () => {
    const container = document.createElement('div')
    function useLabeledValue() {
      const [value] = R.useState('value')
      R.useDebugValue(value, (item: string) => `label:${item}`)
      return value
    }
    function Child() { return R.createElement('button', null, useLabeledValue()) }
    function Owner() { return R.createElement(Child) }
    const root = client.createRoot(container)
    try {
      dom.flushSync(() => root.render(R.createElement(Owner)))
      const api = backend()
      const id = api.getElementIDForHostInstance(container.firstChild)
      const inspected = api.inspectElement(1, id, null, true).value
      expect(api.getElementSourceFunctionById(id)).toBe(Child)
      expect(JSON.stringify(inspected.hooks.data)).toContain('devtools-react-parity.test.ts')
      expect(inspected.hooks.data).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'LabeledValue', value: 'label:value' }),
      ]))
      expect(api.getOwnersList(id).map((owner: any) => owner.displayName)).toEqual(['Owner', 'Child'])
    } finally { dom.flushSync(() => root.unmount()) }
  })

  it('preserves special wrapper nodes in the DevTools tree', () => {
    const container = document.createElement('div')
    function Child() { return R.createElement('button', null, 'wrapped') }
    const root = client.createRoot(container)
    try {
      for (const [Wrapper, tag, props] of [[R.Profiler, 12, { id: 'profile', onRender() {} }], [R.ViewTransition, 30, { name: 'transition' }]] as const) {
        dom.flushSync(() => root.render(R.createElement(Wrapper, props, R.createElement(Child))))
        const api = backend()
        const [rendererID] = [...hook.renderers.entries()].find(([, renderer]: any) => renderer.rendererPackageName === packageName) as any
        const fibers = [...hook.getFiberRoots(rendererID)].map((root: any) => root.current)
        let profile
        while (fibers.length) {
          const fiber = fibers.pop()
          if (fiber.tag === tag) profile = fiber
          if (fiber.child) fibers.push(fiber.child)
          if (fiber.sibling) fibers.push(fiber.sibling)
        }
        expect(profile?.memoizedProps).toMatchObject(props)
        expect(api.getElementIDForHostInstance(container.firstChild)).toBeTruthy()
      }
    } finally { dom.flushSync(() => root.unmount()) }
  })
})
