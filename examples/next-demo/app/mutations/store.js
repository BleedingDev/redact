import { unstable_cache } from 'next/cache'
const key = Symbol.for('redact.next.fixture.records')
export const records = globalThis[key] || (globalThis[key] = new Map())
export const readRecord = unstable_cache(async id => records.get(id) || 'initial', ['redact-next-record'])
