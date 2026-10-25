import { connection } from 'next/server'
import { waitForRelease } from './gate'
export default async function Slow() { await connection(); await waitForRelease(); return <h1>Slow route complete</h1> }
