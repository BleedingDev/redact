import { expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'

it.each(['hydrate', 'create'])('preserves the document shell and resources during %s recovery and unmount', async mode => {
  const doc = new DOMParser().parseFromString('<!doctype html><html lang="server"><head><script src="/bootstrap.js" async></script><style>body{color:red}</style><link rel="stylesheet" href="/app.css"><meta name="old" content="old"></head><body class="server"><script src="/chunk.js" async></script><div>server</div></body></html>', 'text/html')
  const html = doc.documentElement, head = doc.head, body = doc.body
  const resources = [...doc.querySelectorAll('script,style,link')]
  const errors = vi.fn(), recovered = vi.fn()
  const tree = <html lang="client"><head><title>Client title</title></head><body><main>client</main></body></html>
  let root: ReturnType<typeof createRoot> | undefined
  try {
    await act(() => {
      if (mode === 'hydrate') root = hydrateRoot(doc, tree, { onRecoverableError: recovered, onUncaughtError: errors })
      else { root = createRoot(doc as any, { onUncaughtError: errors }); root.render(tree) }
    })
    expect(errors).not.toHaveBeenCalled()
    if (mode === 'hydrate') expect(recovered).toHaveBeenCalled()
    expect(doc.documentElement).toBe(html)
    expect(doc.head).toBe(head)
    expect(doc.body).toBe(body)
    expect(doc.documentElement.lang).toBe('client')
    expect(doc.body.hasAttribute('class')).toBe(false)
    expect(doc.querySelector('main')?.textContent).toBe('client')
    expect(doc.querySelector('meta[name="old"]')).toBeNull()
    for (const node of resources) expect(node.parentNode).toBe(node.nodeName === 'SCRIPT' && (node as HTMLScriptElement).getAttribute('src') === '/chunk.js' ? body : head)
    await act(() => root!.unmount())
    root = undefined
    expect(doc.documentElement).toBe(html)
    expect(doc.head).toBe(head)
    expect(doc.body).toBe(body)
    expect(doc.querySelector('main')).toBeNull()
    expect(doc.documentElement.hasAttribute('lang')).toBe(false)
    for (const node of resources) expect(node.parentNode).not.toBeNull()
  } finally { if (root) await act(() => root!.unmount()) }
})
