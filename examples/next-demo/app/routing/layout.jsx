import { Suspense } from 'react'
import Shell from './shell'
export default function Layout({ children }) { return <Suspense fallback={<p>Waiting for routing</p>}><Shell>{children}</Shell></Suspense> }
