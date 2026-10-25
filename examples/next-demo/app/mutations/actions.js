'use server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { records } from './store'
export async function saveRecord(id, data) {
  records.set(id, String(data.get('value')))
  revalidatePath('/mutations', 'page')
}
export async function setSession(data) { (await cookies()).set('redact-session', String(data.get('session')), { httpOnly: true, sameSite: 'lax', path: '/' }) }
export async function goToRoute() { redirect('/routing/action-destination?from=action') }
export async function inspectData(prefix, previous, data) { const file = data.get('upload'); return `${prefix}:${data.get('value')}:${file.name}:${await file.text()}` }
export async function inspectAlternate(previous, data) { return `alternate:${data.get('value')}` }
