'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'node:crypto'
import { statuses, tasks } from './data'
import { delay, readSession, writeSession } from './store'

export async function changeStatus(previous, data) {
  const id = data.get('id')
  const status = data.get('status')
  await delay(750)
  if (!tasks.some(task => task.id === id) || !statuses.includes(status)) return { error: 'Choose a valid task and status.' }
  const session = await readSession()
  session[id].status = status
  await writeSession(session)
  revalidatePath('/', 'layout')
  return { error: null }
}

export async function postComment(previous, data) {
  const id = data.get('id')
  const text = String(data.get('comment') || '').trim()
  await delay(750)
  if (!tasks.some(task => task.id === id)) return { error: 'This task is no longer available.' }
  if (!text) return { error: 'Write a comment before posting.' }
  if (text.length > 200) return { error: 'Keep your comment under 200 characters.' }
  const session = await readSession()
  session[id].comments = [...session[id].comments, { id: randomUUID(), text }].slice(-3)
  await writeSession(session)
  revalidatePath('/', 'layout')
  return { error: null }
}
