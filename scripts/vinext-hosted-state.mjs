import { DurableObject, WorkerEntrypoint } from 'cloudflare:workers'
import { MemoryCacheHandler } from 'vinext/shims/cache-handler'

// Each preview gets its own object. This is fixture infrastructure, not part of
// the renderer: requests must share data even when served by different isolates.
export class HostedTestState extends DurableObject {
  pending = new Set()
  dataCache = new MemoryCacheHandler()

  cache(operation, args) {
    if (!['get', 'set', 'revalidateTag'].includes(operation)) throw new Error('Unknown cache operation')
    return this.dataCache[operation](...args)
  }

  async fetch(request) {
    const path = new URL(request.url).pathname
    if (request.method === 'GET' && path === '/wait') {
      let timer, finish
      const body = new ReadableStream({
        start: controller => {
          finish = released => {
            clearTimeout(timer)
            this.pending.delete(finish)
            if (released) { controller.enqueue(new TextEncoder().encode('released')); controller.close() }
            else controller.error(new Error('Test data was not released within 60 seconds'))
          }
          this.pending.add(finish)
          timer = setTimeout(() => finish(false), 60000)
        },
        cancel: () => { clearTimeout(timer); this.pending.delete(finish) },
      })
      return new Response(body, { headers: { 'cache-control': 'no-store' } })
    }
    if (path === '/' && request.method === 'GET') return Response.json({ pending: this.pending.size })
    if (path === '/' && request.method === 'POST') {
      const released = this.pending.size
      for (const finish of this.pending) finish(true)
      return Response.json({ released })
    }
    if (path.startsWith('/records/')) {
      const id = decodeURIComponent(path.slice('/records/'.length))
      if (request.method === 'GET') return Response.json({ value: await this.ctx.storage.get(id) ?? 'initial' })
      if (request.method === 'PUT') {
        await this.ctx.storage.put(id, await request.text())
        return new Response(null, { status: 204 })
      }
    }
    return new Response('Not found', { status: 404 })
  }
}

export default class extends WorkerEntrypoint {
  cache(namespace, operation, args) {
    return this.env.STATE.getByName('cache:' + namespace).cache(operation, args)
  }

  async fetch(request) {
    const env = this.env
    const url = new URL(request.url)
    const [, key, ...path] = url.pathname.split('/')
    if (key !== env.TEST_KEY) return new Response('Not found', { status: 404 })
    url.pathname = '/' + path.join('/')
    return env.STATE.getByName('verification').fetch(new Request(url, request))
  }
}
