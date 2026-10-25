'use client'
import { useActionState, useEffect, useState } from 'react'
import { save } from '../save'
export default function Direct() {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const [state, dispatch, pending] = useActionState(save, { count: 0, name: 'Initial' })
  return <main data-ready={ready}><p>{state.count}:{state.name}</p><form action={dispatch}><label>Name<input name="name" defaultValue="Initial" /></label><button disabled={pending}>Save</button></form></main>
}
