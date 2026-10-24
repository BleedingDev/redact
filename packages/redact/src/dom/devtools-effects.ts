import type { FiberRoot } from '../core'
import { devToolsMetadata } from '../core/devtools'

interface EffectRecord {
  layout: number
  passive: number
  pending: number
  notify?: () => void
}

const active = /* @__PURE__ */ new WeakMap<FiberRoot, EffectRecord>()
const commits: EffectRecord[] = []

export function hasPendingDevToolsEffects(root: FiberRoot): boolean {
  return commits.length > 0 || !!active.get(root)?.pending
}

function record(root: FiberRoot): EffectRecord {
  let value = active.get(root)
  if (!value) active.set(root, value = { layout: 0, passive: 0, pending: 0 })
  return value
}

export function startDevToolsEffect(): number | undefined {
  return devToolsMetadata.enabled ? performance.now() : undefined
}

export function finishDevToolsLayout(root: FiberRoot, start: number | undefined): void {
  if (start !== undefined) record(root).layout += performance.now() - start
}

export function wrapDevToolsLayout(root: FiberRoot, work: () => void): () => void {
  if (!devToolsMetadata.enabled) return work
  const value = record(root)
  value.pending++
  return () => {
    const start = performance.now()
    try { work() } finally {
      value.layout += performance.now() - start
      value.pending--
      drain()
    }
  }
}

export function wrapDevToolsPassive(root: FiberRoot, work: () => void): () => void {
  if (!devToolsMetadata.enabled) return work
  const value = record(root)
  value.pending++
  return () => {
    const start = performance.now()
    try { work() } finally {
      value.passive += performance.now() - start
      value.pending--
      drain()
    }
  }
}

// DevTools' post-commit protocol has no commit ID. Retain its notifications
// until that commit's effects finish, without changing when app effects run.
// This also keeps multiple synchronous commits and multiple roots in order.
export function notifyDevToolsCommit(root: FiberRoot, notify: (layout: number, passive: number) => void): void {
  const value = record(root)
  active.delete(root)
  value.notify = () => notify(value.layout, value.passive)
  commits.push(value)
  drain()
}

function drain(): void {
  while (commits.length && commits[0]!.pending === 0) commits.shift()!.notify!()
}
