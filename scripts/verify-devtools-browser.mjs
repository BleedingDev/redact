import { build } from 'esbuild'
import { chromium } from 'playwright'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'packages/redact/src')
const require = createRequire(import.meta.url)
const artifact = name => resolve(process.env.DEVTOOLS_ARTIFACT_DIR || tmpdir(), name)
async function bundle(contents, ui = false) {
  const result = await build({ stdin: { contents, resolveDir: resolve(root, 'tests') }, bundle: true, write: false, format: 'iife', tsconfigRaw: { compilerOptions: { useDefineForClassFields: true } }, alias: ui ? { react: require.resolve('devtools-react'), 'react-dom/client': require.resolve('devtools-react-dom/client'), 'react-dom': require.resolve('devtools-react-dom') } : {}, define: { 'process.env.NODE_ENV': '"development"' } })
  return result.outputFiles[0].text
}
const frontend = await bundle(`
  import React from 'react';
  import {createRoot} from 'react-dom/client';
  import {initialize as backend, activate} from 'react-devtools-inline/backend';
  import {initialize as frontend} from 'react-devtools-inline/frontend';
  const frame=document.querySelector('iframe');
  backend(frame.contentWindow);
  const DevTools=frontend(frame.contentWindow);
  createRoot(document.querySelector('#tools')).render(React.createElement(DevTools,{showTabBar:true}));
  activate(frame.contentWindow);
`, true)
const app = await bundle(`
  import {createElement as h,useState,useEffect} from ${JSON.stringify(source + '/react/index.ts')};
  import {createRoot} from ${JSON.stringify(source + '/dom/client.ts')};
  function Counter(){const[count,set]=useState(0);useEffect(()=>{},[count]);const end=performance.now()+1;while(performance.now()<end){};return h('button',{onClick:()=>set(n=>n+1)},'Count: '+count)}
  function App(){return h(Counter)}
  createRoot(document.body).render(h(App));
`)
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_CHANNEL ? { channel: process.env.CHROME_CHANNEL } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => { errors.push(error.message); console.error(error.message) })
  await page.route('http://redact-devtools.test/', route => route.fulfill({ contentType: 'text/html', body: '<html><body style="margin:0"><iframe style="height:100px;width:100%;border:0"></iframe><div id="tools" style="height:850px"></div></body></html>' }))
  await page.goto('http://redact-devtools.test/')
  await page.addScriptTag({ content: frontend })
  await page.frames()[1].addScriptTag({ content: app + '\n//# sourceURL=http://redact-devtools.test/app.js' })
  await page.getByText('Counter', { exact: true }).first().waitFor()
  await page.getByText('Counter', { exact: true }).first().click()
  await page.getByText('hooks', { exact: true }).first().waitFor()
  await page.frames()[1].getByRole('button', { name: 'Count: 0' }).click()
  await page.frames()[1].getByRole('button', { name: 'Count: 1' }).waitFor()
  await page.waitForFunction(() => [...document.querySelectorAll('input')].some(input => input.value === '1'))
  const inspected = await page.frames()[1].evaluate(() => {
    const api = [...window.__REACT_DEVTOOLS_GLOBAL_HOOK__.rendererInterfaces.values()][0]
    const id = api.getElementIDForHostInstance(document.querySelector('button'))
    return api.inspectElement(1, id, null, true).value
  })
  assert.deepEqual(inspected.errors, [])
  assert.deepEqual(inspected.warnings, [])
  assert(JSON.stringify(inspected.source).includes('http://redact-devtools.test/app.js'))
  await page.screenshot({ path: artifact('redact-devtools-components.png') })
  await page.getByText('Profiler', { exact: true }).click()
  await page.locator('[data-testname="ProfilerToggleButton"]').click()
  await page.frames()[1].getByRole('button', { name: 'Count: 1' }).click()
  await page.frames()[1].waitForFunction(() => [...window.__REACT_DEVTOOLS_GLOBAL_HOOK__.rendererInterfaces.values()][0].getProfilingData().dataForRoots.some(root => root.commitData.length > 0))
  await page.locator('[data-testname="ProfilerToggleButton"]').click()
  await page.getByText('No profiling data has been recorded', { exact: true }).waitFor({ state: 'hidden' })
  const downloaded = page.waitForEvent('download')
  // The official toolbar uses tooltips rather than accessible button names.
  const exportIcon = page.locator('path[d="M15.82,2.14v7H21l-9,9L3,9.18H8.18v-7ZM3,20.13H21v1.73H3Z"]')
  await exportIcon.locator('xpath=ancestor::button').click()
  const download = await downloaded
  const path = await download.path()
  const profile = JSON.parse(await readFile(path, 'utf8'))
  await download.saveAs(artifact('redact-devtools-profile.json'))
  assert(profile.dataForRoots.some(root => root.commitData.length > 0))
  const recorded = profile.dataForRoots[0]
  const counterID = recorded.snapshots.find(([, node]) => node.displayName === 'Counter')[0]
  assert(recorded.commitData[0].fiberSelfDurations.some(([id, duration]) => id === counterID && duration >= 0.5))
  await page.locator('input[type="file"]').setInputFiles(path)
  await page.getByText('Commit information', { exact: true }).waitFor()
  assert.equal(await page.getByText('Import failed', { exact: true }).count(), 0)
  await page.screenshot({ path: artifact('redact-devtools-recording.png') })
  console.log(JSON.stringify({ components: true, liveInspection: true, profiling: true, exportImport: true, errors, artifacts: [artifact('redact-devtools-components.png'), artifact('redact-devtools-recording.png')] }))
  if (errors.length) throw new Error(errors.join('\n'))
} finally { await browser.close() }
