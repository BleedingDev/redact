'use client'
import { useEffect, useId, useState } from 'react'

export default function Counter() {
  const [count, setCount] = useState(0), [ready, setReady] = useState(false)
  const id = useId()
  useEffect(() => setReady(true), [])
  return <div><button data-ready={ready} onClick={() => setCount(count + 1)}>Count: {count}</button><label htmlFor={id}>Static input</label><input id={id} defaultValue="Static"/></div>
}
