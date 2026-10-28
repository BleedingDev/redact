import { afterEach, expect, it, vi } from 'vitest'
import { Fragment, Suspense, createElement as h } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { renderToReadableStream, renderToPipeableStream } from 'react-dom/server'
import { Writable } from 'node:stream'

const cleanup: Array<() => void> = []
afterEach(() => { for (const dispose of cleanup.splice(0)) dispose(); document.body.innerHTML = '' })
function gate() {
  let resolve!: () => void, ready = false
  const promise = new Promise<void>(r => { resolve = r })
  return { read() { if (!ready) throw promise }, resolve() { ready = true; resolve() } }
}
function install(html: string) {
  const container = document.createElement('div')
  // Vitest's jsdom environment uses the real HTML parser (including table foster parenting).
  container.innerHTML = html
  document.body.appendChild(container)
  for (const script of container.querySelectorAll('script')) new Function(script.textContent!)()
  return container
}
const cases = [
  { parent: ['main'], child: h('p', { 'data-ready': '' }, 'ready'), selector: 'main > p', ns: 'http://www.w3.org/1999/xhtml' },
  { parent: ['table'], child: h('tbody', { 'data-ready': '' }, h('tr', null, h('td', null, 'ready'))), selector: 'table > tbody', ns: 'http://www.w3.org/1999/xhtml' },
  { parent: ['table', 'tbody'], child: h('tr', { 'data-ready': '' }, h('td', null, 'ready')), selector: 'tbody > tr', ns: 'http://www.w3.org/1999/xhtml' },
  { parent: ['table', 'thead'], child: h('tr', { 'data-ready': '' }, h('td', null, 'ready')), selector: 'thead > tr', ns: 'http://www.w3.org/1999/xhtml' },
  { parent: ['table', 'tbody', 'tr'], child: h('td', { 'data-ready': '' }, 'ready'), selector: 'tr > td', ns: 'http://www.w3.org/1999/xhtml' },
  { parent: ['table', 'colgroup'], child: h('col', { 'data-ready': '' }), selector: 'colgroup > col', ns: 'http://www.w3.org/1999/xhtml' },
  { parent: ['svg'], child: h('circle', { 'data-ready': '', strokeWidth: 2, cx: 3 }), selector: 'svg > circle', ns: 'http://www.w3.org/2000/svg' },
  { parent: ['math'], child: h('mi', { 'data-ready': '' }, 'x'), selector: 'math > mi', ns: 'http://www.w3.org/1998/Math/MathML' },
  { parent: ['svg', 'foreignObject'], child: h('div', { 'data-ready': '' }, 'ready'), selector: 'foreignObject > div', ns: 'http://www.w3.org/1999/xhtml' },
]
for (const mode of ['readable', 'pipeable']) {
  it.each(cases)(`${mode}: reveals streamed content in $parent parsing context`, async ({ parent, child, selector, ns }) => {
    const pending = gate()
    function Async() { pending.read(); return child }
    let tree = h(Suspense, { fallback: null }, h(Async))
    for (const tag of [...parent].reverse()) tree = h(tag, null, tree)
    let html: string
    if (mode === 'readable') {
      const stream = await renderToReadableStream(tree)
      pending.resolve()
      html = await new Response(stream).text()
    } else {
      html = await new Promise<string>((resolve, reject) => {
        const chunks: string[] = []
        const sink = new Writable({ write(chunk, _encoding, done) { chunks.push(String(chunk)); done() } })
        sink.on('finish', () => resolve(chunks.join('')))
        sink.on('error', reject)
        const stream = renderToPipeableStream(tree, { onError: reject, onShellReady() { stream.pipe(sink); pending.resolve() } })
      })
    }
    const container = install(html)
    const element = container.querySelector(selector + '[data-ready]')
    expect(element).not.toBeNull()
    expect(element!.namespaceURI).toBe(ns)
    if (element!.tagName === 'circle') expect(element!.getAttribute('stroke-width')).toBe('2')
    expect(container.querySelector('[id^="B:"], [id^="S:"], table[hidden]')).toBeNull()
  })
}

it('removes the whole fallback range including nested boundary markers', async () => {
  const pending = gate()
  function Async() { pending.read(); return <b>ready</b> }
  const fallback = <Fragment><Suspense fallback={null}><i>nested fallback</i></Suspense><span>tail fallback</span></Fragment>
  const stream = await renderToReadableStream(<main><Suspense fallback={fallback}><Async /></Suspense><em>sibling</em></main>)
  pending.resolve()
  const container = install(await new Response(stream).text())
  expect(container.querySelector('main')!.textContent).toBe('readysibling')
})

it('hydrates a pending table boundary and preserves the table when the streamed row reveals', async () => {
  const pending = gate()
  function Async() { pending.read(); return <tr><td>ready</td></tr> }
  const tree = <table><tbody><Suspense fallback={<tr><td>loading</td></tr>}><Async /></Suspense></tbody></table>
  const stream = await renderToReadableStream(tree), reader = stream.getReader(), decoder = new TextDecoder()
  const shell = decoder.decode((await reader.read()).value)
  const container = install(shell), table = container.querySelector('table'), errors = vi.fn()
  const root = hydrateRoot(container, tree, { onRecoverableError: errors })
  cleanup.push(() => root.unmount())
  expect(errors).not.toHaveBeenCalled()
  pending.resolve()
  let rest = ''
  for (;;) { const { done, value } = await reader.read(); if (done) break; rest += decoder.decode(value, { stream: true }) }
  const transport = document.createElement('div'); transport.innerHTML = rest + decoder.decode()
  const scripts = [...transport.querySelectorAll('script')]
  while (transport.firstChild) container.appendChild(transport.firstChild)
  for (const script of scripts) new Function(script.textContent!)()
  expect(errors).not.toHaveBeenCalled()
  expect(container.querySelector('table')).toBe(table)
  expect(container.querySelector('tbody > tr > td')!.textContent).toBe('ready')
})
