'use client'

import { useEffect, useState } from 'react'
import { increment } from './increment'

export default function Counter() {
  const [count, setCount] = useState(0)
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  return (
    <div>
      <button data-ready={ready} onClick={() => setCount(count + 1)}>Count: {count}</button>
      <button onClick={async () => setCount(await increment(count))}>Increment on server</button>
    </div>
  )
}
