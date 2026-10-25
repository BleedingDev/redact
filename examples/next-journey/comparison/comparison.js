const config = await (await fetch('/config.json')).json()
const runtimes = ['react', 'redact']
const frames = Object.fromEntries(runtimes.map(name => [name, document.querySelector(`#${name}-frame`)]))
const ready = new Set()
const pending = new Map()
const play = document.querySelector('#play')
const reset = document.querySelector('#reset')
const narration = document.querySelector('#narration')
const observations = document.querySelector('#observations')
const steps = Array.from(document.querySelectorAll('#steps li'))
let sequence = 0, controller, resetting = false

function narrate(text, failed = false) { narration.textContent = text; narration.classList.toggle('failed', failed) }
function controls() {
  play.disabled = ready.size !== 2 || resetting
  reset.disabled = ready.size !== 2 || resetting || !!controller
  play.innerHTML = controller ? '<span aria-hidden="true">■</span> Stop journey' : '<span aria-hidden="true">▶</span> Play journey'
  document.body.classList.toggle('playing', !!controller)
  for (const frame of Object.values(frames)) frame.tabIndex = controller ? -1 : 0
}
function rpc(name, command) {
  const id = ++sequence
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${name}: ${command} timed out`)) }, 12000)
    pending.set(id, { name, resolve, reject, timer })
    frames[name].contentWindow.postMessage({ type: 'fieldwork-command', id, command }, config[name])
  })
}
const both = command => Promise.all(runtimes.map(name => rpc(name, command)))
function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Stopped', 'AbortError'))
    const abort = () => { clearTimeout(timer); reject(new DOMException('Stopped', 'AbortError')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, ms)
    signal?.addEventListener('abort', abort, { once: true })
  })
}
async function until(predicate, description, signal) {
  const deadline = Date.now() + 15000
  while (Date.now() < deadline) {
    signal?.throwIfAborted()
    const states = await both('snapshot')
    if (states.every(predicate)) return states
    await wait(60, signal)
  }
  throw new Error(`The apps did not both reach: ${description}`)
}
async function fresh(signal) {
  resetting = true
  controls()
  try {
    await until(state => !state.saving && !state.posting, 'pending saves to finish', signal)
    await both('reset')
    ready.clear()
    for (const name of runtimes) {
      frames[name].src = config[name] + '/'
      document.querySelector(`#${name}-state`).textContent = 'Connecting'
    }
    const deadline = Date.now() + 15000
    while (ready.size !== 2) {
      if (Date.now() > deadline) throw new Error('The apps did not reconnect')
      await wait(75, signal)
    }
    await until(state => state.route === '/' && state.taskCount === 5 && state.listStatus === 'In progress', 'a fresh project', signal)
    steps.forEach((step, index) => { step.className = ''; step.firstElementChild.textContent = index + 1 })
    observations.hidden = true
    observations.textContent = ''
  } finally { resetting = false; controls() }
}
function step(index, text) {
  steps.forEach((element, i) => { element.className = i < index ? 'done' : i === index ? 'current' : ''; element.firstElementChild.textContent = i < index ? '✓' : i + 1 })
  narrate(text)
}
window.addEventListener('message', event => {
  const data = event.data
  if (data?.type !== 'fieldwork' || !runtimes.includes(data.renderer)) return
  const name = data.renderer
  if (event.origin !== config[name] || event.source !== frames[name].contentWindow) return
  if (data.ready) {
    if (data.state.redact !== (name === 'redact')) {
      narrate(`The ${name} app loaded the wrong runtime. Check the build.`, true)
      document.querySelector(`#${name}-state`).textContent = 'Runtime mismatch'
      return
    }
    ready.add(name)
    document.querySelector(`#${name}-state`).textContent = 'Hydrated'
    controls()
    if (ready.size === 2 && !controller && !resetting) narrate('Try either app, or play the same journey through both.')
  }
  if (data.route || data.state?.route) document.querySelector(`#${name}-route`).textContent = data.route || data.state.route
  const request = pending.get(data.id)
  if (request?.name === name) {
    pending.delete(data.id)
    clearTimeout(request.timer)
    if (data.error) request.reject(new Error(`${name}: ${data.error}`))
    else request.resolve(data.state)
  }
})

play.addEventListener('click', async () => {
  if (controller) { controller.abort(); return }
  controller = new AbortController()
  delete document.body.dataset.journey
  const { signal } = controller
  controls()
  try {
    narrate('Starting with a fresh session on each side…')
    await fresh(signal)
    step(0, 'Filter the task list. Both apps update immediately on the client.')
    await wait(700, signal)
    await both('search')
    await until(state => state.taskCount === 1, 'filtered tasks', signal)
    await wait(1200, signal)

    step(1, 'Open the task with Next.js navigation. Activity streams in from the server.')
    await both('open')
    await until(state => state.route === '/tasks/FW-104' && state.activity, 'the task and its streamed activity', signal)
    await both('show-status')
    await wait(1100, signal)

    step(2, 'Move it to review. The status updates optimistically while the server saves.')
    await both('choose-status')
    await wait(600, signal)
    await both('save-status')
    await until(state => state.status === 'In review' && state.saving, 'an optimistic status with a pending save', signal)
    await until(state => state.status === 'In review' && !state.saving, 'the saved status', signal)
    await wait(900, signal)
    const saved = await both('snapshot')
    if (saved[0].selection !== saved[1].selection) {
      observations.hidden = false
      observations.textContent = `Dropdown after save: React shows “${saved[0].selection}”; Redact shows “${saved[1].selection}”.`
    }

    step(3, 'Try an empty comment. Server validation returns an inline error.')
    await until(state => state.activity, 'the comment form', signal)
    await both('show-comment')
    await wait(600, signal)
    await both('empty-comment')
    await both('post-comment')
    await until(state => state.error === 'Write a comment before posting.' && !state.posting, 'server validation', signal)
    await wait(1400, signal)

    step(4, 'Post a real update. It appears immediately, then the server confirms it.')
    await both('write-comment')
    await wait(1000, signal)
    await both('post-comment')
    await until(state => state.optimistic && state.posting, 'an optimistic comment', signal)
    await until(state => !state.optimistic && !state.posting && !state.error && state.comments.includes('Mobile checkout looks good. Ready for review!'), 'a confirmed comment', signal)
    await wait(1300, signal)

    step(5, 'Return to the project. The list reflects the status saved on the server.')
    await both('show-top')
    await wait(600, signal)
    await both('back')
    await until(state => state.route === '/' && state.listStatus === 'In review', 'the updated project', signal)
    steps.forEach(element => { element.className = 'done'; element.firstElementChild.textContent = '✓' })
    narrate('Both journeys completed. Keep exploring, or reset and run it again.')
    document.body.dataset.journey = 'passed'
  } catch (error) {
    if (error.name === 'AbortError') narrate('Journey stopped. You can use either app from here.')
    else { narrate(error.message, true); document.body.dataset.journey = 'failed'; console.error(error) }
  } finally { controller = undefined; controls() }
})
reset.addEventListener('click', async () => {
  try { await fresh(); delete document.body.dataset.journey; narrate('Fresh sessions. Try either app, or play the journey.') }
  catch (error) { narrate(error.message, true) }
})
for (const name of runtimes) {
  frames[name].src = config[name]
  document.querySelector(`#${name}-link`).href = config[name]
}
