'use client'

import { useActionState, useEffect, useState } from 'react'
import { saveStatus } from './action'

export default function SelectReset() {
  const [ready, setReady] = useState(false)
  const [state, action, pending] = useActionState(saveStatus, { status: 'In progress', saved: false })
  useEffect(() => setReady(true), [])
  return <main data-ready={ready}>
    <form action={action}>
      <label>Status<select name="status" defaultValue={state.status}>
        {['Todo', 'In progress', 'In review', 'Done'].map(value => <option key={value}>{value}</option>)}
      </select></label>
      <button disabled={pending}>{pending ? 'Saving' : 'Save status'}</button>
    </form>
    <output data-testid="saved">{state.saved ? state.status : ''}</output>
  </main>
}
