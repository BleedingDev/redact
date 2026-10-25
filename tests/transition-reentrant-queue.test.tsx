import { expect, it } from 'vitest'
import { createElement as h, startTransition, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

it('does not retain an applied transition when an updater flushes another root', async () => {
  const hostA = document.createElement('div'), hostB = document.createElement('div')
  const rootA = createRoot(hostA), rootB = createRoot(hostB)
  let setA: any, setB: any
  function A() { const [value, set] = useState(0); setA = set; return h('b', null, value) }
  function B() { const [value, set] = useState(0); setB = set; return h('b', null, value) }
  try {
    flushSync(() => { rootA.render(h(A)); rootB.render(h(B)) })
    startTransition(() => {
      setA((value: number) => {
        flushSync(() => setB((other: number) => other + 10))
        return value + 1
      })
      setB((value: number) => value + 1)
    })
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(hostA.textContent).toBe('1')
    expect(hostB.textContent).toBe('11')
    flushSync(() => setA((value: number) => value + 2))
    expect(hostA.textContent).toBe('3')
  } finally {
    flushSync(() => { rootA.unmount(); rootB.unmount() })
  }
})
