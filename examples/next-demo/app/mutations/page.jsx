import { Suspense } from 'react'
import { cookies } from 'next/headers'
import { readRecord } from './store'
import Forms from './forms'
async function Content({ searchParams }) { const { id = 'default' } = await searchParams; const session = (await cookies()).get('redact-session')?.value || 'none'; return <Forms id={id} record={await readRecord(id)} session={session}/> }
export default function Page(props) { return <Suspense fallback={<p>Loading mutations</p>}><Content {...props}/></Suspense> }
