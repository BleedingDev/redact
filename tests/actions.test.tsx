import { expect, it } from 'vitest'
import { Component, Suspense, startTransition, useActionState, useOptimistic, useState, useTransition } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

function deferred<T = void>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 10))

it('keeps a transition pending until all overlapping actions finish', async () => {
  const a = deferred(), b = deferred()
  let start!: (fn: () => void) => void
  function App() { const [pending, transition] = useTransition(); start = transition; return <b>{String(pending)}</b> }
  const container = document.createElement('div'), root = createRoot(container)
  flushSync(() => root.render(<App />))
  flushSync(() => { start(() => a.promise); start(() => b.promise) })
  expect(container.textContent).toBe('true')
  a.resolve(); await tick()
  expect(container.textContent).toBe('true')
  b.resolve(); await tick()
  expect(container.textContent).toBe('false')
  root.unmount()
})

it('serializes actions against the previous result and tracks their pending state', async () => {
  const a = deferred<number>(), b = deferred<number>()
  const inputs: number[] = []
  let dispatch!: (payload: Promise<number>) => void
  function App() {
    const [value, send, pending] = useActionState(async (state: number, payload: Promise<number>) => { inputs.push(state); return state + await payload }, 0)
    dispatch = send
    return <b>{value}:{String(pending)}</b>
  }
  const container = document.createElement('div'), root = createRoot(container)
  flushSync(() => root.render(<App />))
  const firstDispatch = dispatch
  flushSync(() => startTransition(() => { dispatch(a.promise); dispatch(b.promise) }))
  expect(inputs).toEqual([0])
  expect(container.textContent).toBe('0:true')
  a.resolve(2); await tick()
  expect(inputs).toEqual([0, 2])
  expect(container.textContent).toBe('2:true')
  b.resolve(3); await tick()
  expect(container.textContent).toBe('5:false')
  expect(dispatch).toBe(firstDispatch)
  root.unmount()
})

it('rebases optimistic updates on new props and removes them when the action completes', async () => {
  const work = deferred()
  let optimistic!: (amount: number) => void, setBase!: (value: number) => void
  function App() {
    const [base, set] = useState(1)
    setBase = set
    const [value, update] = useOptimistic(base, (state, amount: number) => state + amount)
    optimistic = update
    return <b>{value}</b>
  }
  const container = document.createElement('div'), root = createRoot(container)
  flushSync(() => root.render(<App />))
  flushSync(() => startTransition(async () => { optimistic(2); await work.promise }))
  expect(container.textContent).toBe('3')
  flushSync(() => setBase(10))
  expect(container.textContent).toBe('12')
  work.resolve(); await tick()
  expect(container.textContent).toBe('10')
  root.unmount()
})

class Boundary extends Component<{ children: any }, { error: boolean }> {
  state = { error: false }
  static getDerivedStateFromError() { return { error: true } }
  render() { return this.state.error ? <b>Failed</b> : this.props.children }
}
it('sends rejected actions to an error boundary and cancels queued actions', async () => {
  const work = deferred<number>()
  let dispatch!: (payload: number) => void
  let calls = 0
  function App() {
    const [value, send] = useActionState(async (state: number, payload: number) => { calls++; return state + payload + await work.promise }, 0)
    dispatch = send
    return <b>{value}</b>
  }
  const container = document.createElement('div'), root = createRoot(container)
  flushSync(() => root.render(<Boundary><App /></Boundary>))
  startTransition(() => { dispatch(1); dispatch(2) })
  work.reject(new Error('Rejected')); await tick()
  expect(container.textContent).toBe('Failed')
  expect(calls).toBe(1)
  root.unmount()
})

it('runs form actions with submitter data and publishes status only to descendants', async () => {
  const { useFormStatus } = await import('react-dom')
  const work = deferred()
  let received: FormData | undefined
  function Status() { const status = useFormStatus(); return <span>{status.pending ? `${status.method}:${status.data?.get('intent')}` : 'idle'}</span> }
  function App() { return <><Status /><form action={async (data: FormData) => { received = data; await work.promise }}><input name="name" defaultValue="initial" /><Status /><button name="intent" value="save">Save</button></form></> }
  const container = document.createElement('div'), root = createRoot(container)
  flushSync(() => root.render(<App />))
  const form = container.querySelector('form')!, input = container.querySelector('input')!, button = container.querySelector('button')!
  input.value = 'edited'
  form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: button }))
  await tick()
  expect(received?.get('name')).toBe('edited')
  expect(received?.get('intent')).toBe('save')
  expect([...container.querySelectorAll('span')].map(node => node.textContent)).toEqual(['idle', 'post:save'])
  work.resolve(); await tick()
  expect(input.value).toBe('initial')
  expect([...container.querySelectorAll('span')].map(node => node.textContent)).toEqual(['idle', 'idle'])
  root.unmount()
})

it('honors prevented submit events and button action overrides', async () => {
  let normal = 0, override = 0
  const container = document.createElement('div'), root = createRoot(container)
  function App({ prevent = false }) { return <div onSubmit={prevent ? (event: Event) => event.preventDefault() : undefined}><form action={() => { normal++ }}><button formAction={() => { override++ }}>Save</button></form></div> }
  flushSync(() => root.render(<App prevent />))
  const submit = () => container.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true, submitter: container.querySelector('button')! }))
  submit(); await tick()
  expect([normal, override]).toEqual([0, 0])
  flushSync(() => root.render(<App />))
  submit(); await tick()
  expect([normal, override]).toEqual([0, 1])
  root.unmount()
})

it('restores controlled controls and resets uncontrolled controls after a successful action', async () => {
  const work = deferred()
  let value = 'controlled'
  const container = document.createElement('div'), root = createRoot(container)
  function App() { return <Boundary><form action={() => work.promise}><input name="reset" value={value} onChange={() => {}} /><input name="free" defaultValue="initial" /><button>Submit</button></form></Boundary> }
  flushSync(() => root.render(<App />))
  const form = container.querySelector('form')!
  const inputs = container.querySelectorAll('input')
  inputs[1]!.value = 'edited'
  form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
  work.resolve(); await tick()
  expect(inputs[0]!.value).toBe('controlled')
  expect(inputs[1]!.value).toBe('initial')
  root.unmount()
})

it('rolls back optimistic state after rejection and routes a transition error to its boundary', async () => {
  const work = deferred()
  let run!: () => void
  function App() {
    const [value, update] = useOptimistic('saved')
    const [, start] = useTransition()
    run = () => start(async () => { update('saving'); await work.promise })
    return <b>{value}</b>
  }
  const container = document.createElement('div'), root = createRoot(container)
  flushSync(() => root.render(<Boundary><App /></Boundary>))
  flushSync(run)
  expect(container.textContent).toBe('saving')
  work.reject(new Error('Failed')); await tick()
  expect(container.textContent).toBe('Failed')
  root.unmount()
})

it('updates output elements after the browser resets their text nodes', async () => {
  const { useFormStatus } = await import('react-dom')
  const work = deferred()
  function Status() { return <output>{useFormStatus().pending ? 'pending' : 'idle'}</output> }
  const container = document.createElement('div'), root = createRoot(container)
  flushSync(() => root.render(<form action={() => work.promise}><Status /><button>Submit</button></form>))
  container.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
  await tick()
  expect(container.querySelector('output')!.textContent).toBe('pending')
  work.resolve(); await tick()
  expect(container.querySelector('output')!.textContent).toBe('idle')
  root.unmount()
})

it('hydrates a progressively submitted action state and uses that value for the next action', async () => {
  const { hydrateRoot } = await import('../packages/redact/src/next/client')
  let dispatch!: (amount: number) => void
  function App() {
    const [state, send] = useActionState((previous: number, amount: number) => previous + amount, 0)
    dispatch = send
    return <b>{state}</b>
  }
  const container = document.createElement('div')
  container.innerHTML = '<!--&--><!--&--><!--F!--><b>3</b><!--/&--><!--/&-->'
  const original = container.querySelector('b')
  const root = hydrateRoot(container, <App />, { formState: [3, 'path', 'action', 0] })
  expect(container.textContent).toBe('3')
  expect(container.querySelector('b')).toBe(original)
  startTransition(() => dispatch(2)); await tick()
  expect(container.textContent).toBe('5')
  root.unmount()
})

it('leaves nonmatching action hooks at their own initial state', async () => {
  const { hydrateRoot } = await import('../packages/redact/src/next/client')
  function App() {
    const [first] = useActionState((state: number) => state, 1)
    const [second] = useActionState((state: number) => state, 2)
    return <b>{first}:{second}</b>
  }
  const container = document.createElement('div')
  container.innerHTML = '<!--F--><!--F!--><b>1<!-- -->:<!-- -->9</b>'
  const root = hydrateRoot(container, <App />, { formState: [9, 'path', 'action', 0] })
  expect(container.textContent).toBe('1:9')
  root.unmount()
})

it('restores controlled fields associated with the form from outside its subtree', async () => {
  const work = deferred()
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  flushSync(() => root.render(<><input form="external-action" value="owned" onChange={() => {}} /><form id="external-action" action={() => work.promise}><button>Submit</button></form></>))
  const input = container.querySelector('input')!
  input.defaultValue = 'other'
  container.querySelector('form')!.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
  work.resolve(); await tick()
  expect(input.value).toBe('owned')
  root.unmount()
  container.remove()
})

it('keeps nested transition scopes pending until their shared action settles', async () => {
  const work = deferred()
  let run!: () => void
  function App() {
    const [outerPending, outer] = useTransition()
    const [innerPending, inner] = useTransition()
    run = () => outer(() => inner(() => work.promise))
    return <b>{String(outerPending)}:{String(innerPending)}</b>
  }
  const container = document.createElement('div'), root = createRoot(container)
  try {
    flushSync(() => root.render(<App />))
    flushSync(run)
    expect(container.textContent).toBe('true:true')
    work.resolve()
    await tick()
    expect(container.textContent).toBe('false:false')
  } finally { root.unmount() }
})

it('preserves a nested transition rejection through the enclosing action scope', async () => {
  const work = deferred(), failure = new Error('Nested action failed')
  const caught: unknown[] = []
  let run!: () => void
  function App() {
    const [outerPending, outer] = useTransition()
    const [innerPending, inner] = useTransition()
    run = () => outer(() => inner(() => work.promise))
    return <b>{String(outerPending)}:{String(innerPending)}</b>
  }
  const container = document.createElement('div')
  const root = createRoot(container, { onCaughtError: error => caught.push(error) })
  try {
    flushSync(() => root.render(<Boundary><App /></Boundary>))
    flushSync(run)
    expect(container.textContent).toBe('true:true')
    work.reject(failure)
    await tick()
    expect(container.textContent).toBe('Failed')
    expect(caught).toEqual([failure])
  } finally { root.unmount() }
})

for (const reset of ['request', 'action']) {
  it(`restores controlled selects in a Suspense fallback after ${reset} reset`, async () => {
    const { requestFormReset } = await import('react-dom')
    const container = document.createElement('div'), root = createRoot(container)
    const pending = new Promise<never>(() => {})
    function Pending(): never { throw pending }
    try {
      flushSync(() => root.render(<form action={() => {}}><Suspense fallback={
        <select value="b" onChange={() => {}}><option value="a">A</option><option value="b">B</option></select>
      }><Pending /></Suspense></form>))
      const form = container.querySelector('form')!, select = container.querySelector('select')!
      expect(select.value).toBe('b')
      if (reset === 'request') requestFormReset(form)
      else form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
      await tick()
      expect(select.value).toBe('b')
    } finally { root.unmount() }
  })

  it(`restores controlled select values after ${reset} reset, including duplicate option values`, async () => {
    const { requestFormReset } = await import('react-dom')
    const container = document.createElement('div'), root = createRoot(container)
    try {
      flushSync(() => root.render(<form action={() => {}}>
        <select name="single" value="same" onChange={() => {}}>
          <option value="other">Other</option><option value="same">First match</option><option value="same">Second match</option>
        </select>
        <select name="multiple" multiple value={['b', 'c']} onChange={() => {}}>
          <option value="a">A</option><option value="b">B</option><option value="c">C</option>
        </select>
      </form>))
      const form = container.querySelector('form')!
      const [single, multiple] = container.querySelectorAll('select')
      expect(single!.selectedIndex).toBe(1)
      if (reset === 'request') requestFormReset(form)
      else form.dispatchEvent(new SubmitEvent('submit', { bubbles: true, cancelable: true }))
      await tick()
      expect(single!.selectedIndex).toBe(1)
      expect([...multiple!.selectedOptions].map(option => option.value)).toEqual(['b', 'c'])
    } finally { root.unmount() }
  })
}
