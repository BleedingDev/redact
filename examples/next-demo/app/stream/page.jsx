import { Suspense } from 'react'
import { connection } from 'next/server'
import Counter from '../counter'
async function Delayed() {
  await connection()
  await new Promise(resolve => setTimeout(resolve, 2000))
  return <section><h2>Stream complete</h2><Counter /></section>
}
export default function Stream() {
  return <main><h1>Streaming</h1><Counter /><Suspense fallback={<p>Waiting for stream</p>}><Delayed /></Suspense><p>After boundary</p></main>
}
