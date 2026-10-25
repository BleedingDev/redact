import { Suspense } from 'react'
import { connection } from 'next/server'
import { notFound, redirect } from 'next/navigation'
import Controls from '../controls'
async function Content({ params, searchParams }) {
  await connection()
  const { slug } = await params
  const query = await searchParams
  if (slug === 'missing') notFound()
  if (slug === 'redirect') redirect('/routing/destination?from=server')
  return <Controls slug={slug} query={query.q || query.from || ''} generation={crypto.randomUUID()} />
}
export default function Page(props) { return <Suspense fallback={<p>Waiting for route</p>}><Content {...props}/></Suspense> }
