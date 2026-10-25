const normalizeURL = (value, base) => {
  const parsed = new URL(value, base)
  parsed.searchParams.delete('_rsc')
  return decodeURI(parsed.href)
}

function transportURL(message, base) {
  const text = message.replace(/^(?:Error|ChunkLoadError):\s*/, '')
  const address = text.match(/^Failed to fetch RSC payload for (\S+)\. Falling back/)?.[1] ||
    text.match(/^Failed to load chunk (\S+) from module /)?.[1] ||
    text.match(/^error loading dynamically imported module: (\S+)$/)?.[1]
  const access = text.match(/(\S+) due to access control checks\./)?.[1]
  if (!address && !access) return null
  try {
    return new URL(access ? access.startsWith('http') ? access : new URL(base).protocol + '//' + access.replace(/^\/+/, '') : address, base)
  } catch { return null }
}

export function matchesCanceledRequest(message, url) {
  const address = transportURL(message, url)
  return !!address && normalizeURL(address.href) === normalizeURL(url)
}

export function matchesUnloadedDocument(message, document) {
  if (!document?.discarded || !document.finished) return false
  if (/^(TypeError: )?Importing a module script failed\.$/.test(message)) return !!document.canceledModules?.length
  const address = transportURL(message, document.url)
  if (!address || address.origin !== new URL(document.url).origin) return false
  // WebKit rejects these fetches before emitting a network request when the
  // old document has already lost permission to access its own origin.
  const denied = /due to access control checks\./.test(message) && (
    address.searchParams.has('_rsc') ||
    /^\/_next\/static\/webpack\/[^/]+\.webpack\.hot-update\.json$/.test(address.pathname) ||
    address.pathname === '/__nextjs_original-stack-frames')
  return denied || [...document.scripts, ...document.requests, ...(document.canceledModules || [])].some(url => matchesCanceledRequest(message, url))
}

export function watchBrowserErrors(page, errors) {
  const pending = new Set(), abandoned = new WeakSet(), canceled = []
  const requestDocuments = new WeakMap()
  const consoleWork = new Set(), cancellations = [], queued = []
  const documents = new Map()
  let beforeCommit = false, currentDocument
  const marker = '__REDACT_TEST_NAVIGATION__'
  const initialized = page.addInitScript(marker => {
    const id = performance.timeOrigin + ':' + Math.random()
    const report = (kind, url = location.href) => console.debug(marker + JSON.stringify({ id, kind, url }))
    let leaving = false
    report('open')
    addEventListener('beforeunload', () => { leaving = true; report('leave') })
    addEventListener('pagehide', () => { leaving = true; report('leave') })
    addEventListener('error', event => {
      if (leaving && event.target?.tagName === 'SCRIPT') report('script', event.target.src)
    }, true)
  }, marker)
  const queueError = message => {
    const entry = { message, document: currentDocument, discarded: !!currentDocument?.discarded }
    queued.push(entry)
    return entry
  }
  const flush = async (deferUnfinishedNavigation = false) => {
    await initialized
    await Promise.all([...consoleWork])
    const unloaded = entry => entry.document && { ...entry.document, discarded: entry.discarded, finished: entry.document.finished || page.isClosed() }
    // WebKit can reject an unloading document's fetch before a request event.
    // Correlate its proven cancellation with Next's second log for that exact
    // URL, regardless of which of the two messages arrived first.
    for (const entry of queued) {
      const address = transportURL(entry.message, entry.document?.url)
      if (address && matchesUnloadedDocument(entry.message, unloaded(entry))) entry.document.requests.push(address.href)
    }
    for (const entry of queued.splice(0)) {
      const document = unloaded(entry)
      if (deferUnfinishedNavigation && document?.discarded && !document.finished) {
        queued.push(entry)
        continue
      }
      if (process.env.NEXT_TEST_TRACE) console.error('[classified browser error]', JSON.stringify({ message: entry.message, document, canceled }))
      if (canceled.some(url => matchesCanceledRequest(entry.message, url)) || matchesUnloadedDocument(entry.message, document)) cancellations.push(entry.message)
      else errors.push(entry.message)
    }
  }
  page.on('console', message => {
    const text = message.text()
    if (text.startsWith(marker)) {
      const event = JSON.parse(text.slice(marker.length))
      if (process.env.NEXT_TEST_TRACE) console.error('[document lifecycle]', JSON.stringify(event))
      if (event.kind === 'open') {
        if (currentDocument) currentDocument.finished = true
        currentDocument = { id: event.id, url: event.url, scripts: [], requests: [], canceledModules: [], discarded: false, finished: false }
        documents.set(event.id, currentDocument)
      } else {
        const document = documents.get(event.id)
        if (document && event.kind === 'leave') document.discarded = true
        if (document && event.kind === 'script') document.scripts.push(event.url)
      }
      return
    }
    if (process.env.NEXT_TEST_TRACE && message.type() !== 'timeStamp') console.error('[browser console]', message.type(), page.url(), text)
    if (message.type() !== 'error') return
    const entry = queueError(text)
    const work = Promise.all(message.args().map(arg => arg.evaluate(value => value instanceof Error ? value.message : '').catch(() => '')))
      .then(messages => { entry.message += messages.filter(Boolean).map(value => '\n' + value).join('') })
    consoleWork.add(work)
    work.finally(() => consoleWork.delete(work))
  })
  page.on('request', request => {
    pending.add(request)
    if (currentDocument) requestDocuments.set(request, currentDocument)
    if (request.headers().rsc === '1') currentDocument?.requests.push(request.url())
    if (beforeCommit && !request.isNavigationRequest()) abandoned.add(request)
    for (let i = canceled.length - 1; i >= 0; i--) {
      if (normalizeURL(canceled[i]) === normalizeURL(request.url())) canceled.splice(i, 1)
    }
  })
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) beforeCommit = false })
  page.on('requestfinished', request => pending.delete(request))
  page.on('requestfailed', request => {
    pending.delete(request)
    if (abandoned.has(request) && /cancel|abort/i.test(request.failure()?.errorText || '')) {
      canceled.push(request.url())
      if (request.resourceType() === 'script') requestDocuments.get(request)?.canceledModules.push(request.url())
    }
    if (process.env.NEXT_TEST_TRACE) console.error('[request failed]', page.url(), request.url(), request.failure())
  })
  page.on('pageerror', error => {
    if (process.env.NEXT_TEST_TRACE) console.error('[page error]', page.url(), error.stack)
    queueError(error.message)
  })
  if (process.env.NEXT_TEST_TRACE) page.on('response', response => {
    if (response.status() >= 400) console.error('[response error]', response.status(), response.url())
  })
  return {
    flush, cancellations,
    async navigate(work) {
      await flush()
      if (process.env.NEXT_TEST_TRACE) console.error('[document navigation]', page.url(), [...pending].map(request => request.url()))
      for (const request of pending) abandoned.add(request)
      if (currentDocument) currentDocument.discarded = true
      canceled.length = 0
      beforeCommit = true
      try { return await work() }
      finally { await flush(true); beforeCommit = false }
    },
  }
}
