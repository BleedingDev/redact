import assert from 'node:assert/strict'
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve, join } from 'node:path'
import { chromium, firefox, webkit } from 'playwright'
import { startJourney } from './next-journey.mjs'

const output = resolve(process.env.JOURNEY_RESULTS || 'benchmarks/results/next-journey')
await mkdir(output, { recursive: true })
const service = process.env.JOURNEY_URL ? null : await startJourney({ port: 4410 })
const url = process.env.JOURNEY_URL || service.url
const config = await (await fetch(`${url}/config.json`)).json()
const results = []
const hash = createHash('sha256')
async function hashSources(directory) {
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.next')) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await hashSources(path)
    else hash.update(path).update(await readFile(path))
  }
}
await hashSources('examples/next-journey')
const sourceHash = hash.digest('hex')
const selector = name => `[data-journey="${name}"]`
const engines = { chromium, firefox, webkit }

async function textIs(page, name, value) {
  await page.waitForFunction(({ name, value }) => document.querySelector(`[data-journey="${name}"]`)?.textContent === value, { name, value })
}
async function hydrated(page) { await page.locator('html[data-hydrated="true"]').waitFor() }
function watch(page, errors) {
  page.on('pageerror', error => errors.push(error.stack || error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
}
async function viewportFits(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Horizontal overflow')
}

try {
  for (const engine of (process.env.JOURNEY_BROWSERS || 'chromium,firefox,webkit').split(',')) {
    assert.ok(engines[engine], `Unknown browser ${engine}`)
    const browser = await engines[engine].launch({ headless: true })
    const errors = []
    const result = { browser: engine, version: browser.version(), checks: [] }
    const pass = name => { result.checks.push(name); console.log(`PASS ${engine}: ${name}`) }
    try {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, ...(engine === 'chromium' ? { recordVideo: { dir: join(output, 'video'), size: { width: 1440, height: 1000 } } } : {}) })
      async function compareApps(phase) {
        // Separate, identically positioned viewports avoid comparing the shell's
        // rounded clipping, scrollbar hover, and subpixel iframe composition.
        const captures = []
        const captureContext = await browser.newContext({ viewport: { width: 640, height: 940 }, storageState: await context.storageState() })
        try {
          for (const renderer of ['react', 'redact']) {
            const app = await captureContext.newPage()
            watch(app, errors)
            await app.goto(config[renderer])
            await hydrated(app)
            await app.bringToFront()
            const capture = await app.screenshot({ animations: 'disabled', fullPage: true })
            await writeFile(join(output, `${engine}-${renderer}-${phase}.png`), capture)
            captures.push(capture)
            await app.close()
          }
          assert.ok(captures[0].equals(captures[1]), `${phase} app screenshots differ`)
        } finally { await captureContext.close() }
      }
      const page = await context.newPage()
      watch(page, errors)
      await page.goto(url)
      await page.locator('#play:enabled').waitFor()
      for (const renderer of ['react', 'redact']) {
        const frame = page.frames().find(frame => frame.url().startsWith(config[renderer]))
        assert.ok(frame)
        assert.equal(await frame.evaluate(() => !!globalThis[Symbol.for('@tanstack/redact.ReactSharedInternals')]), renderer === 'redact')
      }
      pass('Both expected browser runtimes are hydrated')
      if (engine === 'chromium') await page.screenshot({ path: join(output, 'comparison.png'), fullPage: true })
      await compareApps('initial')
      pass('Initial app screenshots match exactly')
      await page.bringToFront()
      await page.locator('#play').click()
      await page.waitForFunction(() => document.body.dataset.journey === 'passed' || document.body.dataset.journey === 'failed', null, { timeout: 60000 })
      assert.equal(await page.getAttribute('body', 'data-journey'), 'passed', await page.locator('#narration').textContent())
      assert.equal(await page.locator('#steps li.done').count(), 6)
      pass('Synchronized journey: navigation, optimistic saves, server validation, comments, return')
      result.observedDifferences = await page.locator('#observations').textContent()
      assert.equal(await page.evaluate(() => window.scrollY), 0, 'The journey scrolled the comparison controls away')
      await compareApps('final')
      pass('Final app screenshots match exactly')
      if (engine === 'chromium') await page.screenshot({ path: join(output, 'completed.png'), fullPage: true })
      const video = page.video()
      await context.close()
      if (video) await rename(await video.path(), join(output, 'journey.webm'))

      // These checks drive ordinary controls directly, independently of the replay bridge.
      const manual = await browser.newContext({ viewport: { width: 640, height: 940 } })
      for (const renderer of ['react', 'redact']) {
        const app = await manual.newPage()
        watch(app, errors)
        await app.goto(config[renderer])
        await hydrated(app)
        await app.getByRole('button', { name: 'Open', exact: true }).click()
        assert.equal(await app.locator('.task-list li').count(), 3)
        await app.getByRole('button', { name: 'All tasks', exact: true }).click()
        await app.getByLabel('Find a task').fill('checkout')
        assert.equal(await app.locator('.task-list li').count(), 1)
        await Promise.all([
          app.locator(selector('streaming')).waitFor({ state: 'visible' }),
          app.locator(selector('FW-104')).click(),
        ])
        await app.locator(selector('activity-ready')).waitFor()
        pass(`${renderer}: client filtering, route navigation, streamed activity`)

        await app.getByLabel('Task status', { exact: true }).selectOption('In review')
        await app.getByRole('button', { name: 'Update status' }).click()
        await textIs(app, 'status', 'In review')
        await textIs(app, 'status-result', 'Saving…')
        await textIs(app, 'status-result', 'Saved')
        await app.locator(selector('activity-ready')).waitFor()
        await app.getByLabel('Add a comment').fill('<ready> & reviewed')
        await app.getByRole('button', { name: 'Post comment' }).click()
        await app.locator('.comment[data-pending]').waitFor()
        await app.locator('.comment[data-pending]').waitFor({ state: 'detached' })
        await app.locator(selector('post-comment') + ':enabled').waitFor()
        assert.equal(await app.getByLabel('Add a comment').inputValue(), '')
        assert.equal(await app.locator('.comment p').last().textContent(), '<ready> & reviewed')
        assert.equal(await app.locator('.comment ready').count(), 0)
        pass(`${renderer}: optimistic status and comment, form reset, escaped text`)

        await app.reload()
        await hydrated(app)
        await app.locator(selector('activity-ready')).waitFor()
        await textIs(app, 'status', 'In review')
        assert.equal(await app.locator('.comment p').last().textContent(), '<ready> & reviewed')
        await app.locator(selector('back')).click()
        await app.locator(selector('FW-104')).waitFor()
        assert.equal(await app.locator(selector('FW-104') + ' .status-pill').textContent(), 'In review')
        await app.goBack()
        await app.locator(selector('activity-ready')).waitFor()
        await textIs(app, 'status', 'In review')
        await app.goForward()
        await app.locator(selector('FW-104')).waitFor()
        pass(`${renderer}: server persistence after reload, browser back and forward`)

        if (renderer === 'react') {
          const untouched = await manual.newPage()
          await untouched.goto(config.redact)
          await hydrated(untouched)
          assert.equal(await untouched.locator(selector('FW-104') + ' .status-pill').textContent(), 'In progress')
          await untouched.close()
          pass('React mutations do not affect the Redact session')
        }
        await app.close()
      }
      await manual.close()

      const controls = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
      const replay = await controls.newPage()
      watch(replay, errors)
      await replay.goto(url)
      await replay.locator('#play:enabled').waitFor()
      await replay.locator('#play').click()
      const reactFrame = replay.frames().find(frame => frame.url().startsWith(config.react))
      await reactFrame.waitForFunction(() => document.querySelector('[data-journey="status-result"]')?.textContent === 'Saving…')
      await replay.getByRole('button', { name: 'Stop journey' }).click()
      await replay.locator('#reset:enabled').click()
      await replay.waitForFunction(() => document.querySelector('#narration').textContent.startsWith('Fresh sessions.'))
      for (const frame of replay.frames().filter(frame => Object.values(config).some(origin => frame.url().startsWith(origin)))) {
        assert.equal(await frame.locator(selector('FW-104') + ' .status-pill').textContent(), 'In progress')
      }
      await controls.close()
      pass('Stopping during a save and resetting leaves both sessions fresh')

      const noJS = await browser.newContext({ javaScriptEnabled: false })
      for (const renderer of ['react', 'redact']) {
        const app = await noJS.newPage()
        await app.goto(config[renderer])
        assert.equal(await app.locator('.task-list li').count(), 5)
        assert.equal(await app.locator('html[data-hydrated]').count(), 0)
        await app.locator(selector('FW-104')).click()
        await app.waitForLoadState('load')
        assert.equal(await app.locator('h1').textContent(), 'Polish the mobile checkout')
        assert.equal(await app.locator('.comment').count(), 2)
        await app.close()
        pass(`${renderer}: server HTML and navigation without JavaScript`)
      }
      await noJS.close()

      const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
      const small = await mobile.newPage()
      await small.goto(url)
      await small.locator('#play:enabled').waitFor()
      await viewportFits(small)
      for (const frame of small.frames().filter(frame => Object.values(config).some(origin => frame.url().startsWith(origin)))) {
        assert.ok(await frame.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      }
      if (engine === 'chromium') {
        // Full-page screenshots can leave offscreen cross-origin frames blank.
        // The fit check above uses the phone viewport; expand only for capture.
        const height = await small.evaluate(() => document.documentElement.scrollHeight)
        await small.setViewportSize({ width: 390, height })
        await small.screenshot({ path: join(output, 'mobile.png'), fullPage: true })
      }
      await mobile.close()
      pass('Mobile comparison fits at 390px with reduced motion')
      assert.deepEqual(errors, [], 'Browser errors were observed')
      pass('No browser errors')
      result.passed = true
    } catch (error) {
      result.passed = false
      result.error = error.stack || String(error)
      result.browserErrors = errors
      console.error(`FAIL ${engine}`, result.error)
      process.exitCode = 1
    } finally {
      await browser.close()
      results.push(result)
      await writeFile(join(output, 'results.json'), JSON.stringify({ next: '16.4.3', mode: 'production', bundler: 'turbopack', sourceHash, results }, null, 2) + '\n')
    }
  }
} finally { await service?.stop() }
