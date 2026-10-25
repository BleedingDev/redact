import { connection } from 'next/server'
import { waitForRelease } from '../../slow/gate'
export default async function Pending() { await connection(); await waitForRelease(); return <h1>Pending route complete</h1> }
