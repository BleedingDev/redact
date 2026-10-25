import { afterEach, expect, it } from 'vitest'
import { Activity, Component, Suspense, useLayoutEffect, useState, useTransition, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

const cleanups: Array<() => void> = []
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup() })
const tick = () => new Promise(resolve => setTimeout(resolve, 30))

for (const kind of ['function', 'class', 'promise']) for (const innerBoundary of [false, true]) {
  it(`commits visible transitions while hidden Activity (${kind}) ${innerBoundary ? 'has its own Suspense boundary' : 'suspends without a boundary'}`, async () => {
    let resolve!: () => void, ready = false
    const pending = new Promise<Awaited<ReactNode>>(done => { resolve = () => { ready = true; done(<b>prepared 1</b>) } })
    const effects: string[] = []
    let begin!: () => void, reveal!: () => void
    function Child({ value }: { value: number }) {
      useLayoutEffect(() => { effects.push(`mount ${value}`); return () => { effects.push(`cleanup ${value}`) } }, [value])
      if (value && !ready) throw pending
      return <b>{`prepared ${value}`}</b>
    }
    class ClassChild extends Component<{ value: number }> {
      componentDidMount() { effects.push(`mount ${this.props.value}`) }
      componentWillUnmount() { effects.push(`cleanup ${this.props.value}`) }
      render() {
        if (this.props.value && !ready) throw pending
        return <b>{`prepared ${this.props.value}`}</b>
      }
    }
    function App() {
      const [value, update] = useState(0), [visible, show] = useState(false), [busy, transition] = useTransition()
      begin = () => transition(() => update(1))
      reveal = () => show(true)
      const child = kind === 'function' ? <Child value={value} /> : kind === 'class' ? <ClassChild value={value} /> : value ? pending : <b>prepared 0</b>
      return <Suspense fallback={<em>outer fallback</em>}>
        <output>{`${value}:${busy}`}</output>
        <Activity mode={visible ? 'visible' : 'hidden'}>
          {innerBoundary ? <Suspense fallback={<i>inner fallback</i>}>{child}</Suspense> : child}
        </Activity>
      </Suspense>
    }
    const container = document.createElement('div'), root = createRoot(container)
    document.body.appendChild(container)
    cleanups.push(() => { flushSync(() => root.unmount()); container.remove() })
    flushSync(() => root.render(<App />))
    await expect.poll(() => container.querySelector('b')?.textContent).toBe('prepared 0')
    const original = container.querySelector('b')!
    expect(original.style.display).toBe('none')
    expect(effects).toEqual([])
    begin()
    await expect.poll(() => container.querySelector('output')?.textContent).toBe('1:false')
    expect(container.querySelector('em')).toBeNull()
    expect(original.style.display).toBe('none')
    expect(effects).toEqual([])
    resolve()
    await expect.poll(() => container.querySelector('b')?.textContent).toBe('prepared 1')
    expect(container.querySelector('b')).toBe(original)
    expect(original.style.display).toBe('none')
    expect(effects).toEqual([])
    flushSync(reveal)
    expect(original.style.display).toBe('')
    expect(effects).toEqual(kind === 'promise' ? [] : ['mount 1'])
    expect(container.querySelector('i')).toBeNull()
    await tick()
    expect(container.querySelector('output')?.textContent).toBe('1:false')
  })
}
