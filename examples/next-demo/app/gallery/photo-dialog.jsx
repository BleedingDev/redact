'use client'
import { useRouter } from 'next/navigation'
export default function PhotoDialog({ id }) { const router = useRouter(); return <div role="dialog" aria-label="Photo"><h2>Photo {id}</h2><button onClick={() => router.back()}>Close photo</button></div> }
