'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

// The comparison harness uses the same DOM events as the manual journey.
// It never sets component state or calls server actions directly.
const host = process.env.NEXT_PUBLIC_JOURNEY_HOST
const renderer = process.env.NEXT_PUBLIC_JOURNEY_RENDERER
const find = name => document.querySelector(`[data-journey="${name}"]`)
function required(name) {
  const element = find(name)
  if (!element || element.disabled) throw new Error(`${name} is not ready`)
  return element
}
function fill(name, value) {
  const element = required(name)
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype
  element.focus({ preventScroll: true })
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value)
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }))
}
function click(name) { const element = required(name); element.focus({ preventScroll: true }); element.click() }
function show(name) {
  const bounds = required(name).getBoundingClientRect()
  window.scrollTo({ top: window.scrollY + bounds.top - (window.innerHeight - bounds.height) / 2, behavior: 'smooth' })
}
function snapshot() {
  return {
    route: location.pathname,
    title: document.querySelector('h1')?.textContent,
    taskCount: document.querySelectorAll('.task-list li').length,
    listStatus: find('FW-104')?.querySelector('.status-pill')?.textContent,
    status: find('status')?.textContent,
    selection: find('status-select')?.value,
    scroll: window.scrollY,
    saving: find('status-result')?.textContent === 'Saving…',
    streaming: !!find('streaming'),
    activity: !!find('activity-ready'),
    error: find('comment-error')?.textContent || '',
    comments: Array.from(document.querySelectorAll('.comment p'), node => node.textContent),
    optimistic: !!document.querySelector('.comment[data-pending]'),
    posting: !!find('post-comment')?.disabled,
    redact: !!globalThis[Symbol.for('@tanstack/redact.ReactSharedInternals')],
  }
}

export default function Bridge() {
  const pathname = usePathname()
  useEffect(() => {
    document.documentElement.dataset.hydrated = 'true'
    const instance = crypto.randomUUID()
    const send = data => { if (window.parent !== window) window.parent.postMessage({ type: 'fieldwork', renderer, instance, ...data }, host) }
    async function receive(event) {
      if (window.parent === window || event.source !== window.parent || event.origin !== host || event.data?.type !== 'fieldwork-command') return
      const { id, command } = event.data
      try {
        switch (command) {
          case 'snapshot': break
          case 'reset': {
            const result = await fetch('/api/reset', { method: 'POST' })
            if (!result.ok) throw new Error('Could not reset the session')
            break
          }
          case 'search': fill('search', 'checkout'); break
          case 'open': click('FW-104'); break
          case 'choose-status': fill('status-select', 'In review'); break
          case 'save-status': click('save-status'); break
          case 'empty-comment': fill('comment', ''); break
          case 'write-comment': fill('comment', 'Mobile checkout looks good. Ready for review!'); break
          case 'post-comment': click('post-comment'); break
          case 'back': click('back'); break
          case 'show-status': show('status'); break
          case 'show-comment': show('comment'); break
          case 'show-top': window.scrollTo({ top: 0, behavior: 'smooth' }); break
          default: throw new Error('Unknown journey command')
        }
        send({ id, state: snapshot() })
      } catch (error) { send({ id, error: error.message }) }
    }
    window.addEventListener('message', receive)
    send({ ready: true, state: snapshot() })
    return () => { window.removeEventListener('message', receive); delete document.documentElement.dataset.hydrated }
  }, [])
  useEffect(() => { if (window.parent !== window) window.parent.postMessage({ type: 'fieldwork', renderer, route: pathname }, host) }, [pathname])
  return null
}
