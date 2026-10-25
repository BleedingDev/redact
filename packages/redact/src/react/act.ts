import { isFunction } from '../core/functions'
import { ReactSharedInternals } from './shared-internals'

let depth = 0
let flushing = false
const immediate = process.env.NODE_ENV !== 'production' ? (globalThis as any).setImmediate : undefined
const timeout = process.env.NODE_ENV !== 'production' ? setTimeout : undefined

function flush(queue: Array<() => void>): void {
  if (flushing) return
  flushing = true
  try {
    while (queue.length) queue.shift()!()
  } finally {
    flushing = false
  }
}

// Use a host task so promise continuations can enqueue renderer work first.
// Close MessageChannel ports after each task so tests can exit normally.
function nextTask(callback: () => void): void {
  if (immediate) immediate(callback)
  else if (typeof MessageChannel !== 'undefined') {
    const channel = new MessageChannel()
    channel.port1.onmessage = () => {
      channel.port1.close()
      channel.port2.close()
      callback()
    }
    channel.port2.postMessage(null)
  } else timeout!(callback, 0)
}

function drain(queue: Array<() => void>): Promise<void> {
  return new Promise((resolve, reject) => {
    const step = () => {
      try { flush(queue) } catch (error) { reject(error); return }
      nextTask(() => {
        if (queue.length) step()
        else resolve()
      })
    }
    step()
  })
}

export const act: typeof actDevelopment = process.env.NODE_ENV === 'production'
  ? () => { throw new Error() }
  : actDevelopment

function actDevelopment<T>(callback: () => T | Promise<T>): PromiseLike<T> {
  const outermost = depth === 0
  const previous = ReactSharedInternals.A ?? null
  const queue = ReactSharedInternals.A ||= []
  depth++
  let result: T | Promise<T>
  let exited = false
  const leave = () => {
    if (exited) return
    exited = true
    depth--
    if (!depth) ReactSharedInternals.A = previous
  }
  try {
    result = callback()
  } catch (error) {
    leave()
    throw error
  }
  if (result && isFunction((result as Promise<T>).then)) {
    return {
      then(resolve, reject) {
        const fail = (error: unknown) => {
          leave()
          if (reject) return reject(error)
          throw error
        }
        return (result as Promise<T>).then(value => {
          const finish = () => {
            leave()
            return resolve ? resolve(value) : value
          }
          return depth === 1 ? drain(queue).then(finish, fail) : finish()
        }, fail)
      },
    } as PromiseLike<T>
  }

  try { if (depth === 1) flush(queue) }
  finally { leave() }
  let completion: Promise<T> | undefined
  return {
    then(resolve, reject) {
      if (!outermost) return Promise.resolve(result as T).then(resolve, reject)
      completion ||= (async () => {
        const prior = ReactSharedInternals.A ?? null
        ReactSharedInternals.A = queue
        depth++
        try { await drain(queue); return result as T }
        finally { depth--; ReactSharedInternals.A = prior }
      })()
      return completion.then(resolve, reject)
    },
  }
}
