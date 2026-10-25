import { describe, expect, it, vi } from 'vitest'
import { Component, Fragment, Suspense, lazy, use, useEffect } from 'react'
import { hydrateRoot } from 'react-dom/client'
import { flushSync, __DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE as internals } from 'react-dom'

describe('Next document hydration', () => {
  it('adopts Server Action buttons whose transport fields precede their text', () => {
    const doc = new DOMParser().parseFromString('<!doctype html><html><head></head><body><form><button name="$ACTION_REF_1" formaction=""><input type="hidden" name="$ACTION_1:0" value="bound"><input type="hidden" name="$ACTION_KEY" value="state">Submit</button></form></body></html>', 'text/html')
    const button = doc.querySelector('button'), error = vi.fn()
    const root = hydrateRoot(doc, <html><body><form><button formAction={() => {}}>Submit</button></form></body></html>, { onRecoverableError: error })
    expect(error).not.toHaveBeenCalled()
    expect(doc.querySelector('button')).toBe(button)
    expect(button?.textContent).toBe('Submit')
    root.unmount()
  })

  it('does not revive a client-only boundary from an abandoned hydration attempt', async () => {
    const doc = new DOMParser().parseFromString('<!doctype html><html><head></head><body><main><!--$!--><template></template><p>Loading</p><!--/$--><span>Sibling</span></main></body></html>', 'text/html')
    let resolveFirst!: (module: { default: () => any }) => void, resolveSecond!: (module: { default: () => any }) => void
    const First = lazy(() => new Promise<{ default: () => any }>(yes => { resolveFirst = yes }))
    const Second = lazy(() => new Promise<{ default: () => any }>(yes => { resolveSecond = yes }))
    const effect = vi.fn(), error = vi.fn()
    function Counter() { useEffect(effect, []); return <button>Dynamic</button> }
    const root = hydrateRoot(doc, <html><body><main><Suspense fallback={<p>Loading</p>}><First /></Suspense><Second /></main></body></html>, { onRecoverableError: error, onUncaughtError: error })
    resolveFirst({ default: Counter })
    await new Promise(r => setTimeout(r, 10))
    expect(effect).not.toHaveBeenCalled()
    expect(doc.querySelectorAll('button')).toHaveLength(0)
    resolveSecond({ default: () => <span>Sibling</span> })
    await new Promise(r => setTimeout(r, 10))
    expect(error).not.toHaveBeenCalled()
    expect(doc.querySelectorAll('button')).toHaveLength(1)
    expect(effect).toHaveBeenCalledTimes(1)
    root.unmount()
  })

  it('retries an initial use(promise) before claiming the document shell', async () => {
    const doc = new DOMParser().parseFromString('<!doctype html><html><head></head><body><main>Flight</main></body></html>', 'text/html')
    const html = doc.documentElement, main = doc.querySelector('main')
    let resolve!: (value: any) => void
    const promise = new Promise<any>(r => { resolve = r })
    const effect = vi.fn(), error = vi.fn()
    function ServerRoot() { useEffect(effect, []); return use(promise) }
    const root = hydrateRoot(doc, <ServerRoot />, { onRecoverableError: error, onUncaughtError: error })
    expect(effect).not.toHaveBeenCalled()
    resolve(<html><body><main>Flight</main></body></html>)
    await new Promise(r => setTimeout(r, 10))
    expect(error).not.toHaveBeenCalled()
    expect(doc.documentElement).toBe(html)
    expect(doc.querySelector('main')).toBe(main)
    expect(effect).toHaveBeenCalledTimes(1)
    root.unmount()
  })

  it.each(['child', 'lazy'])('recovers a rejected Flight %s through the client error boundary', async kind => {
    const doc = new DOMParser().parseFromString('<!doctype html><html><head></head><body><!--$--><!--/$--></body></html>', 'text/html')
    const failure = new Error('Flight failed'), caught = vi.fn(), uncaught = vi.fn()
    let reject!: (error: Error) => void
    const promise = new Promise<any>((_, no) => { reject = no })
    const Lazy = lazy(() => promise)
    class Boundary extends Component<{ children: any }, { error: boolean }> {
      state = { error: false }
      static getDerivedStateFromError() { return { error: true } }
      render() { return this.state.error ? <main>Caught Flight</main> : this.props.children }
    }
    const root = hydrateRoot(doc, <html><body><Boundary><Suspense fallback={null}>{kind === 'child' ? promise as any : <Lazy />}</Suspense></Boundary></body></html>, { onCaughtError: caught, onUncaughtError: uncaught })
    reject(failure)
    await new Promise(r => setTimeout(r, 10))
    expect(doc.body.textContent).toBe('Caught Flight')
    expect(caught).toHaveBeenCalledWith(failure, expect.any(Object))
    expect(uncaught).not.toHaveBeenCalled()
    root.unmount()
  })

  it('adopts body content whose logical parent is the document and keeps it there on updates', () => {
    const doc = new DOMParser().parseFromString('<!doctype html><html><head></head><body><div hidden><!--$--><span>Metadata</span><!--/$--></div><main>Page</main></body></html>', 'text/html')
    const html = doc.documentElement
    const hidden = doc.querySelector('div')
    const main = doc.querySelector('main')
    const error = vi.fn()
    function App({ extra = false }) {
      return <Fragment>
        <div hidden><Suspense fallback={null}><span>Metadata</span></Suspense></div>
        {extra && <aside>Extra</aside>}
        <html><body><main>Page</main></body></html>
      </Fragment>
    }
    const root = hydrateRoot(doc, <App />, { onRecoverableError: error })
    expect(error).not.toHaveBeenCalled()
    expect(doc.documentElement).toBe(html)
    expect(doc.querySelector('div')).toBe(hidden)
    expect(doc.querySelector('main')).toBe(main)
    flushSync(() => root.render(<App extra />))
    expect(doc.querySelector('aside')?.parentNode).toBe(doc.body)
    expect(hidden?.parentNode).toBe(doc.body)
    expect(doc.documentElement).toBe(html)
    flushSync(() => root.render(<App />))
    expect(doc.querySelector('aside')).toBeNull()
  })

  it('keeps nested upstream Suspense markers inside their boundary', () => {
    const doc = new DOMParser().parseFromString('<!doctype html><html><head></head><body><main><!--$--><!--$--><span>Nested</span><!--/$--><!--/$--><p>Sibling</p></main></body></html>', 'text/html')
    const span = doc.querySelector('span')
    const sibling = doc.querySelector('p')
    const error = vi.fn()
    hydrateRoot(doc, <html><body><main><Suspense fallback={null}><Suspense fallback={null}><span>Nested</span></Suspense></Suspense><p>Sibling</p></main></body></html>, { onRecoverableError: error })
    expect(error).not.toHaveBeenCalled()
    expect(doc.querySelector('span')).toBe(span)
    expect(doc.querySelector('p')).toBe(sibling)
  })

  it('adopts hoisted metadata inside a body wrapper and removes it with that wrapper', () => {
    const doc = new DOMParser().parseFromString('<!doctype html><html><head><title>First</title><meta name="description" content="First"></head><body><div hidden><!--$--><!--/$--></div><main>Page</main></body></html>', 'text/html')
    const title = doc.querySelector('title')
    const error = vi.fn()
    function App({ name = 'First', show = true }) {
      return <><html><body>{show && <div hidden><Suspense fallback={null}><title>{name}</title><meta name="description" content={name} /></Suspense></div>}<main>Page</main></body></html></>
    }
    const root = hydrateRoot(doc, <App />, { onRecoverableError: error })
    expect(error).not.toHaveBeenCalled()
    expect(doc.querySelector('title')).toBe(title)
    flushSync(() => root.render(<App name="Second" />))
    expect(doc.title).toBe('Second')
    expect(doc.querySelectorAll('title')).toHaveLength(1)
    flushSync(() => root.render(<App show={false} />))
    expect(doc.querySelector('title')).toBeNull()
    expect(doc.querySelector('meta')).toBeNull()
  })

  it.each([false, true])('retries lazy hydration without consuming sibling DOM or committing partial effects (boundary=%s)', async boundary => {
    const doc = new DOMParser().parseFromString(`<!doctype html><html><head></head><body><main>${boundary ? '<!--$-->' : ''}<button>Lazy</button><a>Sibling</a>${boundary ? '<!--/$-->' : ''}</main></body></html>`, 'text/html')
    const button = doc.querySelector('button')
    const sibling = doc.querySelector('a')
    const effect = vi.fn()
    let resolve!: (value: { default: () => any }) => void
    const Lazy = lazy(() => new Promise<{ default: () => any }>(r => { resolve = r }))
    function App() {
      useEffect(effect, [])
      const children = <><Lazy /><a>Sibling</a></>
      return <html><body><main>{boundary ? <Suspense fallback={null}>{children}</Suspense> : children}</main></body></html>
    }
    const error = vi.fn()
    hydrateRoot(doc, <App />, { onRecoverableError: error })
    expect(effect).not.toHaveBeenCalled()
    expect(doc.querySelector('button')).toBe(button)
    resolve({ default: () => <button>Lazy</button> })
    await new Promise(r => setTimeout(r, 10))
    expect(error).not.toHaveBeenCalled()
    expect(effect).toHaveBeenCalledTimes(1)
    expect(doc.querySelector('button')).toBe(button)
    expect(doc.querySelector('a')).toBe(sibling)
  })

  it('does not revive an unmounted root when a lazy module resolves', async () => {
    const container = document.createElement('div')
    container.innerHTML = '<button>Lazy</button>'
    let resolve!: (value: { default: () => any }) => void
    const Lazy = lazy(() => new Promise<{ default: () => any }>(r => { resolve = r }))
    const effect = vi.fn()
    function Loaded() { useEffect(effect, []); return <button>Lazy</button> }
    const root = hydrateRoot(container, <Lazy />)
    root.unmount()
    resolve({ default: Loaded })
    await new Promise(r => setTimeout(r, 10))
    expect(effect).not.toHaveBeenCalled()
    expect(container.childNodes).toHaveLength(0)
  })

  it('dispatches Flight resource hints through the DOM resource APIs', () => {
    internals.d.D('https://next-redact.example')
    internals.d.C('https://next-redact.example', 'anonymous')
    internals.d.L('/next-redact.css', 'style', { fetchPriority: 'high' })
    internals.d.S('/next-redact.css', 'next')
    expect(document.head.querySelector('link[rel="dns-prefetch"][href="https://next-redact.example"]')).not.toBeNull()
    expect(document.head.querySelector('link[rel="preconnect"][href="https://next-redact.example"]')).not.toBeNull()
    expect(document.head.querySelector('link[rel="stylesheet"][href="/next-redact.css"]')?.getAttribute('data-precedence')).toBe('next')
  })
})

it('retains hoisted document metadata when root hydration must recover', () => {
  const doc = new DOMParser().parseFromString('<!doctype html><html><head><meta name="test-recovery" content="old"></head><body><div>server</div></body></html>', 'text/html')
  const errors: unknown[] = []
  const tree = [<meta key="meta" name="test-recovery" content="new" />, <html key="html"><head /><body><main>client</main></body></html>]
  const root = hydrateRoot(doc, tree, { onRecoverableError() {}, onUncaughtError(error) { errors.push(error) } })
  expect(doc.head.querySelector('meta[name="test-recovery"]')?.getAttribute('content')).toBe('new')
  expect(doc.body.textContent).toBe('client')
  expect(errors).toEqual([])
  root.unmount()
})
