'use client'
import { useState } from 'react'
import Link from 'next/link'
export default function Shell({ children }) {
  const [count, setCount] = useState(0)
  return <section><button onClick={() => setCount(count + 1)}>Layout: {count}</button><nav><Link href="/routing/two?q=link">Second route</Link><Link href="/slow" prefetch={false}>Slow route</Link><Link href="/routing/pending" prefetch={false}>Pending route</Link><Link href="/routing/three" prefetch={false}>Third route</Link></nav>{children}</section>
}
