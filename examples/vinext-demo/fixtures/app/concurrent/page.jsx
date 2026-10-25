'use client'

import { Suspense, useDeferredValue, useEffect, useState, useTransition } from 'react'

function resource() {
  let release
  const value = { ready: false, promise: new Promise(resolve => { release = resolve }) }
  value.release = () => { value.ready = true; release() }
  return value
}

function Result({ value, pending }) {
  if (pending && !pending.ready) throw pending.promise
  return <p data-testid="result">{value}</p>
}

export default function Concurrent() {
  const [ready, setReady] = useState(false)
  const [transition, startTransition] = useTransition()
  const [selection, setSelection] = useState(null)
  const [pendingSelection, setPendingSelection] = useState(null)
  const [query, setQuery] = useState('alpha')
  const [queries] = useState(() => new Map())
  const deferred = useDeferredValue(query)
  useEffect(() => setReady(true), [])
  return <main data-ready={ready}>
    <section aria-label="Transition">
      <button onClick={() => {
        const pending = resource()
        setPendingSelection(pending)
        startTransition(() => setSelection(pending))
      }}>Load second result</button>
      <button onClick={() => pendingSelection?.release()}>Release transition</button>
      <output data-testid="transition-pending">{String(transition)}</output>
      <Suspense fallback={<p data-testid="transition-fallback">Loading transition</p>}>
        <Result value={selection ? 'Second result' : 'First result'} pending={selection} />
      </Suspense>
    </section>
    <section aria-label="Deferred search">
      <label>Search<input value={query} onChange={event => {
        const next = event.target.value
        if (next !== 'alpha' && !queries.has(next)) queries.set(next, resource())
        setQuery(next)
      }} /></label>
      <button onClick={() => queries.get(query)?.release()}>Release search</button>
      <output data-testid="stale">{String(query !== deferred)}</output>
      <Suspense fallback={<p data-testid="search-fallback">Loading search</p>}>
        <Result value={deferred} pending={queries.get(deferred)} />
      </Suspense>
    </section>
  </main>
}
