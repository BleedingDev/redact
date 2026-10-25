import Counter from './counter'
import Link from 'next/link'

export const metadata = { title: 'Redact with Next.js' }

export default function Page() {
  return (
    <main>
      <h1>Redact with Next.js</h1>
      <Counter />
      <Link href="/other">Other page</Link>
    </main>
  )
}
