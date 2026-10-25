import assert from 'node:assert/strict'

export async function checkVinextEdges({ browser, origin, reference }) {
  const scenarios = []
  const tests = {
    async 'transition-retains-visible-content'(page) {
      await page.goto(`${origin}/concurrent`)
      await page.locator('main[data-ready="true"]').waitFor()
      const section = page.getByRole('region', { name: 'Transition' })
      await section.getByRole('button', { name: 'Load second result' }).click()
      // The resource stays pending until the explicit release, so this observes
      // the intermediate UI without a race against a timer or a server response.
      await page.waitForLoadState('networkidle')
      const observed = {
        pending: await section.getByTestId('transition-pending').textContent(),
        retained: await section.getByTestId('result').filter({ hasText: 'First result' }).isVisible(),
        fallback: await section.getByTestId('transition-fallback').isVisible(),
      }
      await section.getByRole('button', { name: 'Release transition' }).click()
      await section.getByTestId('result').filter({ hasText: 'Second result' }).waitFor()
      assert.deepEqual(observed, { pending: 'true', retained: true, fallback: false })
      return observed
    },
    async 'deferred-search-retains-stale-results'(page) {
      await page.goto(`${origin}/concurrent`)
      await page.locator('main[data-ready="true"]').waitFor()
      const section = page.getByRole('region', { name: 'Deferred search' })
      await section.getByLabel('Search').fill('beta')
      await page.waitForLoadState('networkidle')
      const observed = {
        query: await section.getByLabel('Search').inputValue(),
        stale: await section.getByTestId('stale').textContent(),
        retained: await section.getByTestId('result').filter({ hasText: 'alpha' }).isVisible(),
        fallback: await section.getByTestId('search-fallback').isVisible(),
      }
      await section.getByRole('button', { name: 'Release search' }).click()
      await section.getByTestId('result').filter({ hasText: 'beta' }).waitFor()
      assert.deepEqual(observed, { query: 'beta', stale: 'true', retained: true, fallback: false })
      return observed
    },
    async 'uncontrolled-select-action-reset'(page) {
      await page.goto(`${origin}/select-reset`)
      await page.locator('main[data-ready="true"]').waitFor()
      assert.equal(await page.getByLabel('Status').inputValue(), 'In progress')
      await page.getByLabel('Status').selectOption('In review')
      await page.getByRole('button', { name: 'Save status' }).click()
      await page.getByTestId('saved').filter({ hasText: 'In review' }).waitFor()
      await page.getByRole('button', { name: 'Save status' }).waitFor()
      await page.waitForLoadState('networkidle')
      const selected = await page.getByLabel('Status').inputValue()
      assert.equal(selected, 'In progress', 'An uncontrolled select resets to its initial default after a successful action')
      return { selected }
    },
  }
  for (const [name, test] of Object.entries(tests)) {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.setDefaultTimeout(15000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    const started = Date.now()
    const result = { name, passed: true }
    try {
      result.observed = await test(page)
      assert.equal(await page.evaluate(() => !!globalThis[Symbol.for('@tanstack/redact.ReactSharedInternals')]), !reference)
      assert.deepEqual(errors, [], 'Unexpected browser errors')
    } catch (error) {
      Object.assign(result, { passed: false, error: error.stack || String(error), ...(error.actual !== undefined ? { actual: error.actual, expected: error.expected } : {}), ...(errors.length ? { browserErrors: errors } : {}) })
    } finally {
      result.durationMs = Date.now() - started
      scenarios.push(result)
      console.log(`${result.passed ? 'PASS' : 'FAIL'} Vinext edge ${JSON.stringify(result)}`)
      await context.close()
    }
  }
  return scenarios
}
