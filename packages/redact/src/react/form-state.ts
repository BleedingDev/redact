import type { Fiber, FiberRoot } from '../core'
export type FormStatus = {
  pending: false
  data: null
  method: null
  action: null
} | {
  pending: true
  data: FormData
  method: string
  action: (data: FormData) => unknown
}
export const idleFormStatus: FormStatus = { pending: false, data: null, method: null, action: null }
export interface FormState {
  s: FormStatus
  l: Set<() => void>
  g: number
}
export const formStates = new WeakMap<Fiber, FormState>()
export function formState(fiber: Fiber): FormState {
  let state = formStates.get(fiber)
  if (!state) { state = { s: idleFormStatus, l: new Set(), g: 0 }; formStates.set(fiber, state) }
  return state
}
export function publishForm(state: FormState, status: FormStatus): void {
  state.s = status
  for (const listener of state.l) listener()
}

export const hydratedFormStates = new WeakMap<FiberRoot, { value: unknown; consume: (fiber: Fiber) => boolean }>()
export function actionInitialState<T>(fiber: Fiber | null, initial: T): T {
  const root = fiber?.r
  const state = root?.h ? hydratedFormStates.get(root) : undefined
  return state && state.consume(fiber!) ? state.value as T : initial
}
