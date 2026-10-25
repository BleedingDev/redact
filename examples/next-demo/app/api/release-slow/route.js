import { pendingCount, release } from '../../slow/gate'
import { connection } from 'next/server'
export async function GET() { await connection(); return Response.json({ pending: pendingCount() }) }
export async function POST() { return Response.json({ released: release() }) }
