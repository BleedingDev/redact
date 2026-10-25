export const m = undefined, d = undefined, c = undefined, l = undefined, p = undefined
import type { FiberRoot } from '../../../core'

export function markTransitionUpdate(_root: FiberRoot): void {}
export const deferTransition: (_root: FiberRoot, _commit: () => void, _flush: () => void) => boolean = () => false
export function cancelTransitions(): void {}
export const deferTransitionLayout: (_work: () => void) => boolean = () => false
export const deferTransitionPassive: (_work: () => void) => boolean = () => false
