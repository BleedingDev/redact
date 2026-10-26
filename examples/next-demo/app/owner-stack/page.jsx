'use client'
import Link from 'next/link'
import { useState } from 'react'

export default function OwnerStackPage() {
  const [count, setCount] = useState(0)
  return <main>
    <h1>Owner stack link</h1>
    <Link href="/other" prefetch={true}>Open target</Link>
    <button onClick={() => setCount(count + 1)}>Count: {count}</button>
  </main>
}
