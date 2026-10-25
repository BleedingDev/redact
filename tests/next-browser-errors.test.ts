import { expect, it } from 'vitest'
// @ts-expect-error The browser runner is an untyped Node script.
import { matchesCanceledRequest, matchesUnloadedDocument, watchBrowserErrors } from '../scripts/next-browser-errors.mjs'

it('matches only a framework transport error for the exact canceled URL', () => {
  const url = 'http://localhost:3000/routing/two?q=link&_rsc=cache-key'
  expect(matchesCanceledRequest('Failed to fetch RSC payload for http://localhost:3000/routing/two?q=link. Falling back to browser navigation. TypeError: Load failed', url)).toBe(true)
  expect(matchesCanceledRequest('/localhost:3000/routing/two?q=link due to access control checks.', url)).toBe(true)
  expect(matchesCanceledRequest('Unexpected render error for ' + url, url)).toBe(false)
  const moduleURL = 'http://localhost:3000/@fs/app-browser-entry.js?v=123'
  expect(matchesCanceledRequest('error loading dynamically imported module: ' + moduleURL, moduleURL)).toBe(true)
  expect(matchesCanceledRequest('error loading dynamically imported module: ' + moduleURL + '-other', moduleURL)).toBe(false)
  expect(matchesCanceledRequest('Failed to fetch RSC payload for http://localhost:3000/routing/other. Falling back to browser navigation.', url)).toBe(false)
  expect(matchesCanceledRequest('Failed to fetch RSC payload for http://localhost:3000/routing/two?q=other. Falling back to browser navigation.', url)).toBe(false)
  expect(matchesCanceledRequest('Failed to fetch RSC payload for http://localhost:3000/routing/two?q=link-extra. Falling back to browser navigation.', url)).toBe(false)
})

it('accepts transport cancellation only after its document has been discarded', () => {
  const url = 'http://localhost:3000/_next/static/chunks/hmr.js'
  const message = `Failed to load chunk ${url} from module hmr`
  const document = { url: 'http://localhost:3000/redirect', discarded: true, finished: true, scripts: [url], requests: [] }
  expect(matchesUnloadedDocument(message, document)).toBe(true)
  expect(matchesUnloadedDocument(message, { ...document, discarded: false })).toBe(false)
  expect(matchesUnloadedDocument(message, { ...document, finished: false })).toBe(false)
  expect(matchesUnloadedDocument(message, { ...document, scripts: [] })).toBe(false)
  expect(matchesUnloadedDocument('Unexpected render failure', document)).toBe(false)
  const moduleError = 'TypeError: Importing a module script failed.'
  expect(matchesUnloadedDocument(moduleError, document)).toBe(false)
  expect(matchesUnloadedDocument(moduleError, { ...document, canceledModules: [url] })).toBe(true)
  expect(matchesUnloadedDocument(moduleError, { ...document, canceledModules: [url], discarded: false })).toBe(false)
  expect(matchesUnloadedDocument(moduleError, { ...document, canceledModules: [url], finished: false })).toBe(false)
  const unprefixed = 'Importing a module script failed.'
  expect(matchesUnloadedDocument(unprefixed, document)).toBe(false)
  expect(matchesUnloadedDocument(unprefixed, { ...document, canceledModules: [url] })).toBe(true)
  expect(matchesUnloadedDocument(unprefixed, { ...document, canceledModules: [url], discarded: false })).toBe(false)
  expect(matchesUnloadedDocument(unprefixed, { ...document, canceledModules: [url], finished: false })).toBe(false)
  expect(matchesUnloadedDocument('/localhost:3000/_next/static/webpack/abc.webpack.hot-update.json due to access control checks.', document)).toBe(true)
  expect(matchesUnloadedDocument('/localhost:3000/routing/two?_rsc=key due to access control checks.', document)).toBe(true)
  expect(matchesUnloadedDocument('/localhost:3000/api/record due to access control checks.', document)).toBe(false)
  expect(matchesUnloadedDocument('https://another.example/routing/two?_rsc=key due to access control checks.', document)).toBe(false)
})

it('requires a recorded static Flight request and a completed document replacement', () => {
  const url = 'http://127.0.0.1:4602/coverage/posts/two/index.txt'
  const message = '/127.0.0.1:4602/coverage/posts/two/index.txt due to access control checks.'
  for (const discarded of [false, true]) for (const finished of [false, true]) for (const recorded of [false, true]) {
    const document = { url: 'http://127.0.0.1:4602/coverage/', discarded, finished, scripts: [], requests: recorded ? [url] : [] }
    expect(matchesUnloadedDocument(message, document)).toBe(discarded && finished && recorded)
    expect(matchesUnloadedDocument(message.replace('posts/two', 'posts/other'), document)).toBe(false)
    expect(matchesUnloadedDocument(message.replace('127.0.0.1:4602', 'another.example'), document)).toBe(false)
  }
})

it.each([false, true])('correlates a WebKit transport rejection with its framework log only after unload=%s', async unloaded => {
  const listeners = new Map<string, (...args: any[]) => void>()
  const page = { addInitScript: async () => {}, on: (name: string, listener: (...args: any[]) => void) => listeners.set(name, listener), isClosed: () => false }
  const errors: string[] = []
  const observed = watchBrowserErrors(page, errors)
  const consoleMessage = (text: string, type = 'debug') => listeners.get('console')!({ text: () => text, type: () => type, args: () => [] })
  const marker = (id: number, kind: string) => consoleMessage('__REDACT_TEST_NAVIGATION__' + JSON.stringify({ id, kind, url: 'http://localhost:3000/coverage/redirect' }))
  marker(1, 'open')
  if (unloaded) marker(1, 'leave')
  // The framework log can arrive before the browser's corresponding error.
  consoleMessage('Failed to fetch RSC payload for http://localhost:3000/coverage/next?q=one. Falling back to browser navigation. TypeError: Load failed', 'error')
  listeners.get('pageerror')!({ message: 'Fetch API cannot load http://localhost:3000/coverage/next?q=one&_rsc=key due to access control checks.' })
  consoleMessage('Failed to fetch RSC payload for http://localhost:3000/coverage/next?q=two. Falling back to browser navigation. TypeError: Load failed', 'error')
  marker(2, 'open')
  await observed.flush()
  expect(observed.cancellations).toHaveLength(unloaded ? 2 : 0)
  expect(errors).toHaveLength(unloaded ? 1 : 3)
  expect(errors.at(-1)).toContain('q=two')
})

it.each([[true, true], [true, false], [false, true], [false, false]])('requires a canceled module and a replacement document, canceled=%s replaced=%s', async (canceled, replaced) => {
  const listeners = new Map<string, (...args: any[]) => void>()
  const page = { addInitScript: async () => {}, on: (name: string, listener: (...args: any[]) => void) => listeners.set(name, listener), isClosed: () => false }
  const errors: string[] = []
  const observed = watchBrowserErrors(page, errors)
  const marker = (id: number) => listeners.get('console')!({ text: () => '__REDACT_TEST_NAVIGATION__' + JSON.stringify({ id, kind: 'open', url: 'http://localhost:3000/actions' }) })
  const request = { url: () => 'http://localhost:3000/entry.js', headers: () => ({}), isNavigationRequest: () => false, resourceType: () => 'script', failure: () => ({ errorText: canceled ? 'cancelled' : 'connection reset' }) }
  marker(1)
  listeners.get('request')!(request)
  await observed.navigate(async () => {
    listeners.get('requestfailed')!(request)
    listeners.get('pageerror')!({ message: 'TypeError: Importing a module script failed.' })
  })
  expect(errors).toEqual([])
  if (replaced) marker(2)
  await observed.flush()
  expect(observed.cancellations).toHaveLength(canceled && replaced ? 1 : 0)
  expect(errors).toHaveLength(canceled && replaced ? 0 : 1)
})

it.each(['NS_BINDING_ABORTED', 'connection reset'])('keeps module cancellation evidence scoped to the old document after a URL is reused: %s', async failure => {
  const listeners = new Map<string, (...args: any[]) => void>()
  const page = { addInitScript: async () => {}, on: (name: string, listener: (...args: any[]) => void) => listeners.set(name, listener), isClosed: () => false }
  const errors: string[] = [], observed = watchBrowserErrors(page, errors)
  const url = 'http://localhost:3000/entry.js', message = `error loading dynamically imported module: ${url}`
  const marker = (id: number) => listeners.get('console')!({ text: () => '__REDACT_TEST_NAVIGATION__' + JSON.stringify({ id, kind: 'open', url: 'http://localhost:3000/actions' }) })
  const request = () => ({ url: () => url, headers: () => ({}), isNavigationRequest: () => false, resourceType: () => 'script', failure: () => ({ errorText: failure }) })
  marker(1)
  const previous = request()
  listeners.get('request')!(previous)
  await observed.navigate(async () => {
    listeners.get('requestfailed')!(previous)
    listeners.get('pageerror')!({ message })
    marker(2)
    listeners.get('request')!(request())
  })
  const canceled = failure === 'NS_BINDING_ABORTED'
  expect(observed.cancellations).toEqual(canceled ? [message] : [])
  expect(errors).toEqual(canceled ? [] : [message])
  listeners.get('pageerror')!({ message })
  await observed.flush()
  expect(errors).toEqual(canceled ? [message] : [message, message])
})
