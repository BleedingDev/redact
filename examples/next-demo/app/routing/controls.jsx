'use client'
import { useRouter, usePathname, useSearchParams, useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
export default function Controls({ slug, query, generation }) {
  const router = useRouter(), pathname = usePathname(), search = useSearchParams(), params = useParams()
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  return <main data-ready={ready}><h1>Route {slug}</h1><p data-testid="route-query">{query}</p><p data-testid="route-hooks">{params.slug}:{search.get('q') || search.get('from') || ''}:{pathname}</p><p data-testid="generation">{generation}</p><button onClick={() => router.push('/routing/pushed?q=push')}>Push route</button><button onClick={() => router.replace('/routing/replaced?q=replace')}>Replace route</button><button onClick={() => router.refresh()}>Refresh route</button></main>
}
