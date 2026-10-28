import { afterEach, expect, it, vi } from 'vitest'
import { Suspense } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { renderToReadableStream } from 'react-dom/server'

const cleanup: Array<() => void> = []
afterEach(() => { for (const dispose of cleanup.splice(0)) dispose(); vi.unstubAllGlobals() })

it.each(['replace', 'unmount'])('retires an opaque pending stream range on %s and ignores its late reveal', async action => {
  let ready = false, resolve!: () => void
  const pending = new Promise<void>(yes => { resolve = () => { ready = true; yes() } })
  function Child() { if (!ready) throw pending; return <b>READY</b> }
  const tree = <main><Suspense fallback={<i>LOADING</i>}><Child /></Suspense><em>STAYS</em></main>
  const stream = await renderToReadableStream(tree)
  const reader = stream.getReader()
  const shell = new TextDecoder().decode((await reader.read()).value)
  const container = document.createElement('div')
  container.innerHTML = shell
  document.body.append(container)
  cleanup.push(() => container.remove())
  for (const script of container.querySelectorAll('script')) new Function(script.textContent!)()
  const root = hydrateRoot(container, tree)
  const sibling = container.querySelector('em')
  expect(container.querySelector('i')?.textContent).toBe('LOADING')
  if (action === 'replace') {
    flushSync(() => root.render(<main><strong>REPLACEMENT</strong><em>STAYS</em></main>))
    cleanup.push(() => root.unmount())
    expect(container.querySelector('em')).toBe(sibling)
  } else flushSync(() => root.unmount())
  expect(container.querySelector('i, template')).toBeNull()
  resolve()
  let tail = ''
  for (;;) { const chunk = await reader.read(); if (chunk.done) break; tail += new TextDecoder().decode(chunk.value) }
  const transport = document.createElement('div')
  transport.innerHTML = tail
  document.body.append(transport)
  cleanup.push(() => transport.remove())
  for (const script of transport.querySelectorAll('script')) new Function(script.textContent!)()
  await Promise.resolve()
  expect(container.querySelector('b,i,template')).toBeNull()
  expect(container.querySelector('main')?.textContent ?? '').toBe(action === 'replace' ? 'REPLACEMENTSTAYS' : '')
})

it('does not retry a deleted pending boundary when its registered reveal callback fires', () => {
  let reveal!: () => void
  vi.stubGlobal('$RH', (_id: string, callback: () => void) => { reveal = callback })
  const container = document.createElement('div')
  container.innerHTML = '<!--$?0--><div id="B:0"><i>LOADING</i></div><!--/$-->'
  document.body.append(container)
  cleanup.push(() => container.remove())
  const effect = vi.fn()
  function Child() { effect(); return <b>READY</b> }
  const root = hydrateRoot(container, <Suspense fallback={<i>LOADING</i>}><Child /></Suspense>)
  flushSync(() => root.render(<strong>REPLACEMENT</strong>))
  reveal()
  expect(effect).not.toHaveBeenCalled()
  expect(container.innerHTML).toBe('<strong>REPLACEMENT</strong>')
  root.unmount()
})
