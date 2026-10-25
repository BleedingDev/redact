import { act, Component, startTransition, use, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { expect, it, vi } from 'vitest'

it('holds descendant updates while their ancestor waits for a navigation promise', async () => {
  const container = document.createElement('div'), root = createRoot(container, { onCaughtError() {} })
  let resolve!: (value: number) => void
  const pending = new Promise<number>(yes => { resolve = yes })
  const navigate = vi.fn()
  let update!: (value: number | Promise<number>) => void
  const redirect = new Error('redirect')
  function Page({ value }: { value: number }) { if (!value) throw redirect; return <h1>Destination</h1> }
  function Redirect({ reset }: { reset: () => void }) {
    const [count, setCount] = useState(0)
    useEffect(() => {
      navigate()
      startTransition(() => { update(pending); reset() })
    }, [reset])
    return <button onClick={() => setCount(count + 1)}>Redirecting:{count}</button>
  }
  class Boundary extends Component<{ children: any }, { failed: boolean }> {
    state = { failed: false }
    static getDerivedStateFromError() { return { failed: true } }
    render() { return this.state.failed ? <Redirect reset={() => this.setState({ failed: false })} /> : this.props.children }
  }
  function Router() {
    const [value, set] = useState<number | Promise<number>>(0)
    update = set
    const resolved = typeof value === 'number' ? value : use<number>(value)
    return <Boundary><Page value={resolved} /></Boundary>
  }
  try {
    await act(() => { flushSync(() => root.render(<Router />)) })
    await new Promise(r => setTimeout(r, 10))
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(container.textContent).toBe('Redirecting:0')
    await act(() => container.querySelector('button')!.click())
    expect(container.textContent).toBe('Redirecting:1')
    expect(navigate).toHaveBeenCalledTimes(1)
    await act(async () => { resolve(1); await pending })
    expect(container.textContent).toBe('Destination')
    expect(navigate).toHaveBeenCalledTimes(1)
  } finally { await act(() => root.unmount()) }
})
