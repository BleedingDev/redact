import { expect, it, vi } from 'vitest'
import { Suspense, useEffect, useState } from 'react'
import { hydrateRoot } from '../packages/redact/src/next/client'
import { flushSync } from 'react-dom'
const tick = () => new Promise(resolve => setTimeout(resolve, 10))

it.each(['$?', '$~'])('keeps %s server ranges pending while hydrating interactive siblings, then adopts the reveal', async marker => {
  const container = document.createElement('div')
  container.innerHTML = `<button>0</button><!--${marker}--><template id="B:0"></template><p>Loading</p><!--/$--><span>After</span>`
  const before = container.firstChild, after = container.lastChild
  const start = before!.nextSibling as Comment
  const end = after!.previousSibling!
  const effect = vi.fn(), error = vi.fn()
  function Counter() { const [count, set] = useState(0); return <button onClick={() => set(count + 1)}>{count}</button> }
  function Loaded() { useEffect(effect, []); return <strong>Ready</strong> }
  const root = hydrateRoot(container, <><Counter /><Suspense fallback={<p>Loading</p>}><Loaded /></Suspense><span>After</span></>, { onRecoverableError: error })
  flushSync(() => (before as HTMLButtonElement).click())
  expect(before?.textContent).toBe('1')
  expect(effect).not.toHaveBeenCalled()
  expect(container.querySelector('p')?.textContent).toBe('Loading')
  while (start.nextSibling !== end) start.nextSibling!.remove()
  const revealed = document.createElement('strong'); revealed.textContent = 'Ready'
  container.insertBefore(revealed, end)
  start.data = '$'
  ;(start as any)._reactRetry()
  await tick()
  expect(error).not.toHaveBeenCalled()
  expect(effect).toHaveBeenCalledTimes(1)
  expect(container.querySelector('strong')).toBe(revealed)
  expect(container.lastChild).toBe(after)
  root.unmount()
})

it('removes an abandoned pending range and ignores a later server retry', async () => {
  const container = document.createElement('div')
  container.innerHTML = '<!--$?--><template id="B:0"></template><p>Loading</p><!--/$--><span>After</span>'
  const start = container.firstChild as any
  const root = hydrateRoot(container, <><Suspense fallback={<p>Loading</p>}><strong>Ready</strong></Suspense><span>After</span></>)
  const retry = start._reactRetry
  flushSync(() => root.render(<span>After</span>))
  expect(container.textContent).toBe('After')
  retry(); await tick()
  expect(container.textContent).toBe('After')
  root.unmount()
})

it('switches an updated pending boundary to client rendering without waiting for the server', async () => {
  const container = document.createElement('div')
  container.innerHTML = '<!--$?--><template id="B:0"></template><p>Loading</p><!--/$--><span>After</span>'
  const root = hydrateRoot(container, <><Suspense fallback={<p>Loading</p>}><strong>Old</strong></Suspense><span>After</span></>)
  flushSync(() => root.render(<><Suspense fallback={<p>Loading</p>}><strong>Updated</strong></Suspense><span>After</span></>))
  expect(container.textContent).toBe('UpdatedAfter')
  expect(container.querySelector('template')).toBeNull()
  root.unmount()
})
