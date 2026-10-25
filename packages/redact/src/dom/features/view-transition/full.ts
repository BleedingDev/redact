import { ReactSharedInternals } from '../../../react/shared-internals'

import { prepareViewTransition } from './visual'

import { recoverRootError } from '../../reconcile'

import { isFunction } from '../../../core/functions'

import { currentCommit, prepareCommit, commitBeforeMutation, commitMutation, commitSynchronously, type CommitPlan } from '../../commit'

import type { FiberRoot } from '../../../core'

type Work = { c: () => void; s: Set<Set<string>> }
type Visual = NonNullable<ReturnType<typeof prepareViewTransition>>
interface Transaction {
  n?: ViewTransition
  v: Visual
  w: Map<FiberRoot, Work>
  l: Array<() => void>
  p: Array<() => void>
  c: boolean
  a: boolean
  r: boolean
  s: CommitPlan[]
  f: boolean
}
interface Coordinator {
  q: Map<FiberRoot, Work>
  a?: Transaction | undefined
  f: () => void
  s: boolean
}

const marks = new Map<FiberRoot, Set<Set<string>> | null>()
const documents = new Map<Document, Coordinator>()
let committing: Transaction | undefined

const ownerDocument = (root: FiberRoot): Document => ((root.c.ownerDocument || root.c) as Document)

export function deferTransitionPassive(work: () => void): boolean {
  if (!committing) return false
  committing.p.push(work)
  return true
}

function render(work: Map<FiberRoot, Work>): void {
  for (const entry of work.values()) entry.c()
}

function cancel(coordinator: Coordinator): void {
  const transaction = coordinator.a
  const queued = coordinator.q
  const root = queued.keys().next().value
  const doc = transaction?.v.document ?? (root ? ownerDocument(root) : undefined)
  coordinator.q = new Map()
  if (transaction) {
    if (!transaction.r) {
      coordinator.a = undefined
      transaction.a = true
      transaction.n?.skipTransition()
      try { transaction.v.cancel() } catch (error) { report(transaction, error) }
    }
    consume(transaction)
    passive(transaction)
  }
  commitSynchronously(() => render(queued))
  if (doc) release(doc, coordinator)
}

function consume(transaction: Transaction): void {
  transaction.c = true
  within(transaction, () => {
    beforeMutation(transaction)
    mutation(transaction)
  })
  drain(transaction.l)
}

export function deferTransitionLayout(work: () => void): boolean {
  if (!committing) return false
  committing.l.push(work)
  return true
}

function passive(transaction: Transaction): void {
  if (transaction.c) transaction.v.restore()
  drain(transaction.p)
}

function mutation(transaction: Transaction): void {
  for (const plan of transaction.s) commitMutation(plan)
}

function release(doc: Document, coordinator: Coordinator): void {
  if (!coordinator.a && !coordinator.q.size && documents.get(doc) === coordinator) documents.delete(doc)
}

export function deferTransition(root: FiberRoot, commit: () => void, flush: () => void): boolean {
  if (committing?.f && !currentCommit && ownerDocument(root) === committing.v.document) {
    prepareRoot(committing, root, commit)
    return true
  }
  if (!marks.size && !documents.size) return false
  const scopes = marks.get(root)
  marks.delete(root)
  const doc = ownerDocument(root)
  const activeCoordinator = documents.get(doc)
  if (activeCoordinator?.a?.s.length && !activeCoordinator.a.c && !currentCommit) {
    // A reentrant urgent render must consume the already-rendered commit
    // before reconciling another tree against it.
    if (committing || !scopes) cancel(activeCoordinator)
  }
  if (committing || !scopes || !doc.startViewTransition) return false
  let coordinator = documents.get(doc)
  if (!coordinator) {
    coordinator = { q: new Map(), f: flush, s: false }
    documents.set(doc, coordinator)
  }
  const existing = coordinator.q.get(root)
  if (existing) for (const scope of scopes) existing.s.add(scope)
  else coordinator.q.set(root, { c: commit, s: scopes })
  kick(doc, coordinator)
  return true
}

function finish(doc: Document, coordinator: Coordinator, transaction: Transaction): void {
  if (coordinator.a === transaction) coordinator.a = undefined
  try { passive(transaction) } catch (error) { report(transaction, error) } finally {
    try { transaction.v.finish() } catch (error) { report(transaction, error) } finally {
      if (coordinator.q.size) kick(doc, coordinator)
      else release(doc, coordinator)
    }
  }
}

const reportable = (error: unknown): boolean => (error !== null && !(error && typeof error === 'object' && 'name' in error && error.name === 'InvalidStateError' &&
    'message' in error && (
      error.message === 'View transition was skipped because document visibility state is hidden.' ||
      error.message === 'Skipping view transition because document visibility state has become hidden.' ||
      error.message === 'Skipping view transition because viewport size changed.' ||
      error.message === 'Transition was aborted because of invalid state'
    )))

function within(transaction: Transaction, work: () => void): void {
  const previous = committing
  committing = transaction
  try { work() } finally { committing = previous }
}

function report(transaction: Transaction, error: unknown): void {
  const root = transaction.w.keys().next().value
  if (root?.ue) root.ue(error, { componentStack: null })
  else queueMicrotask(() => { throw error })
}

function drain(queue: Array<() => void>): void {
  while (queue.length) queue.shift()!()
}

export function markTransitionUpdate(root: FiberRoot): void {
  if (committing) return
  const coordinator = documents.size ? documents.get(ownerDocument(root)) : undefined
  if (coordinator?.a) passive(coordinator.a)
  const scope = ReactSharedInternals.T
  if (scope) {
    if (marks.get(root) !== null) {
      let scopes = marks.get(root)
      if (!scopes) marks.set(root, scopes = new Set())
      scopes.add(scope)
    }
  } else {
    if (marks.has(root)) marks.set(root, null)
    if (coordinator) cancel(coordinator)
  }
}

function prepareRoot(transaction: Transaction, root: FiberRoot, commit: () => void): void {
  try {
    prepareCommit(() => {
      transaction.s.push(currentCommit!)
      commit()
    })
  } catch (error) {
    transaction.s.pop()
    if (!recoverRootError(error)) throw error
    transaction.w.delete(root)
    transaction.v.exclude(root)
  }
}

function beforeMutation(transaction: Transaction): void {
  for (const plan of transaction.s) commitBeforeMutation(plan)
}

export function cancelTransitions(): void {
  if (!marks.size && !documents.size) return
  marks.clear()
  for (const [doc, coordinator] of [...documents]) {
    cancel(coordinator)
    release(doc, coordinator)
  }
}

function kick(doc: Document, coordinator: Coordinator): void {
  if (coordinator.a || coordinator.s || !coordinator.q.size) return
  coordinator.s = true
  queueMicrotask(async () => {
    coordinator.s = false
    if (coordinator.a || !coordinator.q.size) return
    const work = coordinator.q
    coordinator.q = new Map()
    const types = new Set<string>()
    for (const entry of work.values()) for (const scope of entry.s) for (const type of scope) types.add(type)
    const visual = prepareViewTransition(work.keys(), [...types])
    if (!visual) {
      commitSynchronously(() => render(work))
      release(doc, coordinator)
      return
    }
    const transaction: Transaction = { v: visual, w: work, l: [], p: [], s: [], f: true, c: false, a: false, r: false }
    coordinator.a = transaction
    try {
      try {
        within(transaction, () => {
          for (const [root, entry] of work) prepareRoot(transaction, root, entry.c)
          coordinator.f()
        })
      } finally { transaction.f = false }
      const resources = visual.prepare()
      if (resources) await resources
      if (transaction.a) return
      within(transaction, () => beforeMutation(transaction))
      if (!visual.beforeCommit()) {
        cancel(coordinator)
        return
      }
    } catch (error) {
      cancel(coordinator)
      report(transaction, error)
      return
    }
    const update = () => {
      if (transaction.c) return
      transaction.c = true
      const navigation = (doc.defaultView as any)?.navigation?.transition
      const fonts = doc.fonts
      const wasLoaded = fonts?.status === 'loaded'
      within(transaction, () => {
        mutation(transaction)
        coordinator.f()
      })
      const finishCommit = () => {
        if (transaction.a) return
        within(transaction, () => { drain(transaction.l); coordinator.f() })
        if (navigation) return navigation.finished.catch(() => {}).then(() => {
          if (!transaction.a) visual.afterCommit()
        })
        visual.afterCommit()
      }
      const resources = visual.waitForResources(!!wasLoaded)
      if (resources) return resources.then(finishCommit)
      return finishCommit()
    }
    try {
      const native = transaction.n = doc.startViewTransition({ update, types: [...types] })
      native.updateCallbackDone.catch(error => report(transaction, error))
      native.ready.then(() => {
        if (!transaction.a) {
          transaction.r = true
          try { visual.ready() } catch (error) { report(transaction, error) }
        }
      }, error => {
        try {
          if (!transaction.a && reportable(error)) {
            const root = transaction.w.keys().next().value
            if (root?.re) root.re(error, { componentStack: null })
            else if (isFunction(reportError)) reportError(error)
            else queueMicrotask(() => { throw error })
          }
        } finally {
          transaction.a = true
          try { visual.cancel() } finally { consume(transaction) }
        }
      })
      native.finished.then(() => finish(doc, coordinator, transaction), () => finish(doc, coordinator, transaction))
    } catch {
      cancel(coordinator)
    }
  })
}

export { markTransitionUpdate as m, deferTransition as d, cancelTransitions as c, deferTransitionLayout as l, deferTransitionPassive as p }
