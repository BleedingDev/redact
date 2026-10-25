import { Suspense } from 'react'
async function Photo({ params }) { return <h1>Photo {(await params).id}</h1> }
export default function Page(props) { return <Suspense fallback={<p>Loading photo</p>}><Photo {...props}/></Suspense> }
