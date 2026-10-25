import assert from 'node:assert/strict'
import { watchBrowserErrors } from './next-browser-errors.mjs'

export async function checkVinextStatic({ browser, origin, reference }) {
    const page = await browser.newPage(), errors = []
    page.setDefaultTimeout(15000)
    const observed = watchBrowserErrors(page, errors)
    await page.route('**/favicon.ico', route => route.fulfill({ status: 204 }))
    let release
    const gate = new Promise(yes => { release = yes })
    await page.route('**/*.js*', async route => { await gate; await route.continue() })
    await page.goto(origin + '/', { waitUntil: 'commit' })
    await page.getByRole('button', { name: 'Count: 0', exact: true }).waitFor()
    const id = await page.getByLabel('Static input').getAttribute('id')
    await page.evaluate(() => { window.staticButton = document.querySelector('button'); window.staticDocument = document.documentElement })
    release()
    await page.waitForFunction(() => document.querySelector('button[data-ready="true"]'))
    assert.equal(await page.evaluate(() => !!globalThis[Symbol.for('@tanstack/redact.ReactSharedInternals')]), !reference)
    assert.ok(await page.evaluate(() => window.staticButton === document.querySelector('button')))
    assert.equal(await page.getByLabel('Static input').getAttribute('id'), id)
    await page.getByRole('button', { name: 'Count: 0', exact: true }).click()
    await page.getByRole('link', { name: 'First post', exact: true }).click()
    await page.getByRole('heading', { name: 'Post one', exact: true }).waitFor()
    await page.waitForFunction(() => document.title === 'Post one')
    await page.getByRole('button', { name: 'Count: 1', exact: true }).waitFor()
    assert.ok(await page.evaluate(() => window.staticDocument === document.documentElement))
    await page.getByRole('link', { name: 'Second post', exact: true }).click()
    await page.getByRole('heading', { name: 'Post two', exact: true }).waitFor()
    await page.goBack()
    await page.getByRole('heading', { name: 'Post one', exact: true }).waitFor()
    await observed.navigate(() => page.reload())
    await page.getByRole('heading', { name: 'Post one', exact: true }).waitFor()
    await page.waitForFunction(() => document.querySelector('button[data-ready="true"]'))
    assert.equal(await page.locator('main').evaluate(node => getComputedStyle(node).color), 'rgb(12, 34, 56)')
    await observed.flush()
    assert.deepEqual(errors, [])
    const missing = await page.request.get(`${origin}/missing/`)
    assert.equal(missing.status(), 404)
    assert.ok((await missing.text()).includes('Static missing page'))
    return { expectedNavigationCancellations: observed.cancellations.length }
}
