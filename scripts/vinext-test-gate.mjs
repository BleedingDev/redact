import { createServer } from 'node:http'
import { once } from 'node:events'

// A real I/O dependency keeps suspended Worker requests alive. Resolving a
// promise stored in another request's isolate context is not supported there.
export async function startVinextTestGate() {
  const pending = new Set()
  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/wait') {
      pending.add(response)
      return
    }
    response.setHeader('content-type', 'application/json')
    if (request.method === 'GET' && request.url === '/') {
      response.end(JSON.stringify({ pending: pending.size }))
    } else if (request.method === 'POST' && request.url === '/') {
      const released = pending.size
      for (const waiting of pending) waiting.end('released')
      pending.clear()
      response.end(JSON.stringify({ released }))
    } else {
      response.writeHead(404).end('{}')
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    async close() {
      const closed = once(server, 'close')
      server.close()
      server.closeAllConnections()
      pending.clear()
      await closed
    },
  }
}
