'use client'
import { useActionState, useEffect, useOptimistic, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { save } from './save'

function Submit() {
  const { pending } = useFormStatus()
  return <button disabled={pending}>{pending ? 'Saving' : 'Save'}</button>
}
export default function Actions() {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const [state, dispatch, pending] = useActionState(save, { count: 0, name: 'Initial' })
  const [name, optimistic] = useOptimistic(state.name)
  return <main data-ready={ready}>
    <h1>Form actions</h1>
    <p data-testid="result">{state.count}:{state.name}</p>
    <p data-testid="optimistic">{name}</p>
    <p data-testid="pending">{String(pending)}</p>
    <form action={data => { optimistic(data.get('name')); dispatch(data) }}>
      <label>Name<input name="name" defaultValue="Initial" /></label>
      <Submit />
    </form>
  </main>
}
