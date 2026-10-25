import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

export async function checkExtended({ page, context, origin, production, errors, visit, reload, flushErrors, scenario, beforeBoundaryReset, isExpectedBoundaryLog }) {
  const id = randomUUID()
  const slash = new URL(origin).pathname !== '/' ? '/' : ''
  const heading = name => page.getByRole('heading', { name, exact: true }).waitFor()
  const ready = () => page.waitForFunction(() => document.querySelector('main[data-ready="true"]'))
  // Cache Components retains inactive pages in Activity. Assert the visible
  // route while keeping the retained DOM available for back/forward checks.
  const text = id => page.getByTestId(id).filter({ visible: true }).textContent()
  const click = name => page.getByRole('button', { name, exact: true }).click()

  await scenario('routing', async () => {
    console.log('Checking route params, queries, history, refresh, and layout retention')
    page = await visit(`${origin}/routing/one?q=initial`)
    await ready()
    assert.equal(await text('route-hooks'), 'one:initial:/routing/one' + slash)
    await page.evaluate(() => { window.routingDocument = document.documentElement })
    await click('Layout: 0')
    await page.getByRole('link', { name: 'Second route', exact: true }).click()
    await heading('Route two')
    assert.equal(await text('route-query'), 'link')
    assert.equal(await text('route-hooks'), 'two:link:/routing/two' + slash)
    await click('Layout: 1')
    await click('Push route')
    await heading('Route pushed')
    await click('Replace route')
    await heading('Route replaced')
    assert.equal(await text('route-hooks'), 'replaced:replace:/routing/replaced' + slash)
    await page.goBack()
    await heading('Route two')
    await page.goForward()
    await heading('Route replaced')
    const before = await text('generation')
    await click('Refresh route')
    await page.getByTestId('generation').filter({ visible: true, hasNotText: before }).waitFor()
    await page.getByRole('button', { name: 'Layout: 2', exact: true }).waitFor()
    assert.ok(await page.evaluate(() => window.routingDocument === document.documentElement), 'App navigation must preserve the document')

  })
  await scenario('boundaries', async () => {
    console.log('Checking redirects, rewrites, and not-found boundaries')
    page = await visit(`${origin}/routing/redirect`)
    await heading('Route destination')
    assert.equal(await text('route-query'), 'server')
    page = await visit(`${origin}/configured-redirect`)
    await heading('Route redirected')
    assert.equal(await text('route-query'), 'config')
    page = await visit(`${origin}/rewritten/alias?q=rewrite`)
    await heading('Route alias')
    assert.equal(await text('route-query'), 'rewrite')
    assert.equal(new URL(page.url()).pathname.replace(/\/$/, ''), `${new URL(origin).pathname.replace(/\/$/, '')}/rewritten/alias`)
    const missingStart = errors.length
    page = await visit(`${origin}/routing/missing`)
    await heading('Missing route')
    await flushErrors()
    for (const message of errors.splice(missingStart)) assert.match(message, /404|Not Found|not found/i, 'Only the expected missing-route response may be logged')

  })
  await scenario('loading-cancellation', async () => {
    console.log('Checking loading boundaries and canceled navigation')
    page = await visit(`${origin}/routing/one`)
    await ready()
    try {
      await page.getByRole('link', { name: 'Slow route', exact: true }).click({ noWaitAfter: true })
      await page.getByText('Loading slow route', { exact: true }).waitFor()
      await page.getByRole('link', { name: 'Cancel slow route', exact: true }).click()
      await heading('Route three')
    } finally {
      const response = await page.request.post(`${origin}/api/release-slow`)
      assert.ok((await response.json()).released > 0, 'The canceled server render must actually have been pending')
    }
    await page.waitForLoadState('networkidle')
    assert.equal(await page.getByRole('heading', { name: 'Slow route complete', exact: true }).count(), 0)
    await heading('Route three')

  })
  await scenario('navigation-cancellation', async () => {
    page = await visit(`${origin}/routing/one`)
    await ready()
    await click('Layout: 0')
    try {
      await page.getByRole('link', { name: 'Pending route', exact: true }).click({ noWaitAfter: true })
      const deadline = Date.now() + 15000
      for (;;) {
        const response = await page.request.get(`${origin}/api/release-slow`, { timeout: Math.max(1, deadline - Date.now()) })
        assert.ok(response.ok())
        if ((await response.json()).pending > 0) break
        assert.ok(Date.now() < deadline, 'The server render must suspend before navigation is canceled')
        await new Promise(resolve => setTimeout(resolve, 25))
      }
      // Use the retained layout's link, so a route replacement cannot hide the
      // click target while Playwright checks its position and visibility.
      await page.getByRole('link', { name: 'Third route', exact: true }).click()
      await heading('Route three')
    } catch (error) {
      console.error('Pending navigation failed before cleanup:', error)
      throw error
    } finally {
      const response = await page.request.post(`${origin}/api/release-slow`)
      assert.ok((await response.json()).released > 0, 'The canceled server render must actually have been pending')
    }
    await page.waitForLoadState('networkidle')
    assert.equal(await page.getByRole('heading', { name: 'Pending route complete', exact: true }).count(), 0)
    await page.getByRole('button', { name: 'Layout: 1', exact: true }).waitFor()
    await heading('Route three')
  })
  await scenario('parallel-routes', async () => {
    console.log('Checking parallel and intercepting routes')
    page = await visit(`${origin}/gallery`)
    await page.waitForFunction(() => document.querySelector('button[data-ready="true"]'))
    await click('Count: 0')
    await page.getByRole('link', { name: 'Open photo', exact: true }).click()
    await page.getByRole('dialog', { name: 'Photo', exact: true }).waitFor()
    await heading('Gallery')
    await page.getByRole('button', { name: 'Count: 1', exact: true }).waitFor()
    await click('Close photo')
    await page.getByRole('dialog', { name: 'Photo', exact: true }).waitFor({ state: 'detached' })
    await page.getByRole('button', { name: 'Count: 1', exact: true }).waitFor()
    await page.getByRole('link', { name: 'Open photo', exact: true }).click()
    await page.getByRole('dialog', { name: 'Photo', exact: true }).waitFor()
    await reload()
    await heading('Photo 1')
    assert.equal(await page.getByRole('dialog').count(), 0, 'A hard load must use the full route')

  })
  await scenario('mutations', async () => {
    console.log('Checking cache invalidation, cookies, bound actions, and FormData')
    page = await visit(`${origin}/mutations?id=${id}`)
    await ready()
    assert.equal(await text('cached-record'), 'initial')
    await page.getByRole('textbox', { name: 'Record', exact: true }).fill(id)
    await click('Update cached record')
    await page.getByTestId('cached-record').getByText(id, { exact: true }).waitFor()
    await reload()
    await ready()
    assert.equal(await text('cached-record'), id)
    await page.getByRole('textbox', { name: 'Session', exact: true }).fill(id)
    await click('Set session')
    await page.getByTestId('session').getByText(id, { exact: true }).waitFor()
    const cookie = (await page.context().cookies()).find(cookie => cookie.name === 'redact-session')
    assert.equal(cookie?.value, id)
    assert.equal(cookie?.httpOnly, true)
    await page.getByLabel('Upload', { exact: true }).setInputFiles({ name: 'fixture.txt', mimeType: 'text/plain', buffer: Buffer.from('file contents') })
    await click('Send payload')
    await page.getByText('bound:payload:fixture.txt:file contents', { exact: true }).waitFor()
    await page.getByRole('textbox', { name: 'Payload', exact: true }).fill('override')
    await click('Alternate action')
    await page.getByText('alternate:override', { exact: true }).waitFor()
    await click('Action redirect')
    await heading('Route action-destination')
    assert.equal(await text('route-query'), 'action')

  })
  await scenario('components', async () => {
    console.log('Checking Next dynamic, Image, Script, CSS, context, and portals')
    page = await visit(`${origin}/components`)
    await ready()
    await click('Dynamic: 0')
    await page.getByRole('button', { name: 'Dynamic: 1', exact: true }).waitFor()
    await page.waitForFunction(() => document.querySelector('[data-testid="image-ready"]')?.textContent === 'true')
    assert.ok(await page.getByAltText('Fixture image', { exact: true }).evaluate(image => image.naturalWidth > 0))
    await page.waitForFunction(() => document.querySelector('[data-testid="script-ready"]')?.textContent === 'true')
    assert.equal(await page.evaluate(() => window.nextFixtureScript), 1)
    assert.equal(await page.locator('main').evaluate(main => getComputedStyle(main).color), 'rgb(12, 34, 56)')
    await click('Open portal')
    await page.getByRole('dialog', { name: 'Portal', exact: true }).getByText('Context through portal', { exact: true }).waitFor()
    await click('Close portal')
    await page.getByRole('dialog', { name: 'Portal', exact: true }).waitFor({ state: 'detached' })

  })
  await scenario('pages-data', async () => {
    console.log('Checking Pages SSR, static props, cookies, and shallow routing')
    await context.addCookies([{ name: 'redact-session', value: id, url: origin, httpOnly: true }])
    page = await visit(`${origin}/legacy-data/one?q=initial`)
    await ready()
    assert.equal(await text('legacy-session'), id)
    assert.equal(await text('legacy-server-query'), 'initial')
    await click('Legacy count: 0')
    await click('Shallow update')
    await page.waitForFunction(() => document.querySelector('[data-testid="legacy-router-query"]')?.textContent === 'shallow')
    assert.equal(await text('legacy-server-query'), 'initial', 'Shallow routing must not rerun getServerSideProps')
    await page.getByRole('button', { name: 'Legacy count: 1', exact: true }).waitFor()
    await click('Full update')
    await heading('Legacy two')
    assert.equal(await text('legacy-server-query'), 'full')
    await page.getByRole('button', { name: 'Legacy count: 1', exact: true }).waitFor()
    page = await visit(`${origin}/legacy-static`)
    await heading('Generated static props')

  })
  await scenario('error-boundaries', async () => {
    console.log('Checking render/action error boundaries and reset')
    await flushErrors()
    assert.deepEqual(errors, [], 'Earlier scenarios must not log errors')
    for (const kind of ['Render', 'Action']) {
      page = await visit(`${origin}/fail`)
      await ready()
      await flushErrors()
      const start = errors.length
      await click(`${kind} failure`)
      await heading('Recovered boundary')
      assert.ok((await text('error-message')).length > 0)
      if (kind === 'Render' || !production) assert.match(await text('error-message'), new RegExp(`Expected ${kind.toLowerCase()} failure`))
      await beforeBoundaryReset?.(page)
      await click('Reset boundary')
      await heading('Failure controls')
      await ready()
      await flushErrors()
      for (const message of errors.splice(start)) {
        if (isExpectedBoundaryLog?.(message)) continue
        assert.match(message, /Expected (?:render|action) failure|Server Components render|An error occurred in the|The above error occurred in the <(?:Page|Unknown)> component\. It was handled by the <ErrorBoundaryHandler> error boundary\.|Minified React error|redact-errors|redact\.dev\/errors|https:\/\/react\.dev\/errors|500.*Internal Server Error|Internal Server Error.*500/i, 'Only the deliberately triggered boundary error may be logged')
      }
    }
  })
  await scenario('server-runtime', async () => {
    page = await visit(origin)
    const server = await (await page.request.get(`${origin}/api/runtime`)).json()
    assert.match(server.version, /^19\./)
    assert.equal(server.redact, false, 'The server must keep the original React runtime')
  })
}
