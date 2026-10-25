import { expect, it, vi } from 'vitest'
import { startTransition, useActionState, useOptimistic, ReactSharedInternals } from '../packages/redact/src/react'
import { createRoot } from '../packages/redact/src/dom/client'
import { flushSync } from '../packages/redact/src/dom'

it('shares action context when another renderer copy installs the transition bridge', async () => {
  let finish!: () => void
  const work = new Promise<void>(resolve => { finish = resolve })
  let run!: () => void
  function App() {
    const [value, send, pending] = useActionState(async (previous: number) => { await work; return previous + 1 }, 0)
    const [optimistic, update] = useOptimistic<number, void>(value, (previous: number) => previous + 1)
    run = () => startTransition(() => { update(undefined); send() })
    return <b>{value}:{optimistic}:{String(pending)}</b>
  }
  const container = document.createElement('div'), root = createRoot(container)
  const bridge = ReactSharedInternals.X!
  try {
    flushSync(() => root.render(<App />))
    vi.resetModules()
    const second = await import('../packages/redact/src/dom/client')
    expect(second.createRoot).not.toBe(createRoot)
    expect(ReactSharedInternals.X).not.toBe(bridge)
    flushSync(run)
    expect(container.textContent).toBe('0:1:true')
    finish()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(container.textContent).toBe('1:1:false')
  } finally {
    finish()
    flushSync(() => root.unmount())
    ReactSharedInternals.X = bridge
  }
})
