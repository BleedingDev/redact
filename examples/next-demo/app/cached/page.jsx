import { Suspense } from 'react'
import { connection } from 'next/server'
import Counter from '../counter'
async function Cached() {
  'use cache'
  return <h1>Cached content</h1>
}
async function RequestContent() {
  await connection()
  return <section><h2>Request content</h2><Counter /></section>
}
export default function CachedPage() {
  return <main><Cached /><Suspense fallback={<p>Waiting for request</p>}><RequestContent /></Suspense></main>
}
