'use client'
import { useActionState, useState, useEffect } from 'react'
import { failAction } from './action'
export default function Page() {
  const [failed, setFailed] = useState(false), [ready, setReady] = useState(false)
  const [, action] = useActionState(failAction, null)
  useEffect(() => setReady(true), [])
  if (failed) throw new Error('Expected render failure')
  return <main data-ready={ready}><h1>Failure controls</h1><button onClick={() => setFailed(true)}>Render failure</button><form action={action}><button>Action failure</button></form></main>
}
