'use client'
import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { saveRecord, setSession, goToRoute, inspectData, inspectAlternate } from './actions'
function Status() { const { pending } = useFormStatus(); return <span data-testid="mutation-pending">{String(pending)}</span> }
export default function Forms({ id, record, session }) {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const [data, send] = useActionState(inspectData.bind(null, 'bound'), 'none')
  const [alternate, sendAlternate] = useActionState(inspectAlternate, 'none')
  return <main data-ready={ready}><h1>Server mutations</h1><p data-testid="cached-record">{record}</p><p data-testid="session">{session}</p>
    <form action={saveRecord.bind(null, id)}><label>Record<input name="value" defaultValue="initial"/></label><button>Update cached record</button><Status/></form>
    <form action={setSession}><label>Session<input name="session"/></label><button>Set session</button></form>
    <form action={goToRoute}><button>Action redirect</button></form>
    <form action={send}><label>Payload<input name="value" defaultValue="payload"/></label><label>Upload<input name="upload" type="file"/></label><button>Send payload</button><button formAction={sendAlternate}>Alternate action</button></form>
    <p data-testid="payload-result">{data}</p><p data-testid="alternate-result">{alternate}</p>
  </main>
}
