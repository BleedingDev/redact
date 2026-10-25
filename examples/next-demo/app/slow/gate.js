const key = Symbol.for('redact.nextFixture.slow')
const pending = globalThis[key] ||= new Set()
export function waitForRelease() { return new Promise(resolve => pending.add(resolve)) }
export function pendingCount() { return pending.size }
export function release() {
  const count = pending.size
  for (const resolve of pending) resolve()
  pending.clear()
  return count
}
