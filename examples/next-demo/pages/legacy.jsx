import { useState } from 'react'
import Link from 'next/link'

export default function Legacy() {
  const [count, setCount] = useState(0)
  return <main><h1>Pages Router</h1><button onClick={() => setCount(count + 1)}>Count: {count}</button><Link href="/legacy-other">Next legacy page</Link></main>
}
