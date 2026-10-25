import { cookies } from 'next/headers'
import { tasks, statuses } from './data'

// Ports share a cookie jar. Keep each renderer's demo session independent.
const cookieName = `fieldwork-${process.env.JOURNEY_RENDERER || 'redact'}`
export const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

export async function readSession() {
  let value
  try { value = JSON.parse((await cookies()).get(cookieName)?.value || '{}') } catch { value = {} }
  const result = {}
  for (const task of tasks) {
    const stored = value?.[task.id]
    result[task.id] = {
      status: statuses.includes(stored?.status) ? stored.status : task.status,
      comments: Array.isArray(stored?.comments) ? stored.comments.filter(c =>
        typeof c?.id === 'string' && typeof c?.text === 'string' && c.text.length <= 200,
      ).slice(-3).map(c => ({ id: c.id, text: c.text })) : [],
    }
  }
  return result
}

export async function writeSession(session) {
  // Bound the whole cookie, not just individual task histories.
  const entries = Object.entries(session)
  while (encodeURIComponent(JSON.stringify(session)).length > 3000) {
    const longest = entries.reduce((a, b) => b[1].comments.length > a[1].comments.length ? b : a)
    if (!longest[1].comments.length) break
    longest[1].comments.shift()
  }
  ;(await cookies()).set(cookieName, JSON.stringify(session), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 3600 })
}

export async function clearSession() { (await cookies()).delete(cookieName) }
