import { invokeCommit, layoutIsDisconnected } from './reconcile';
import { onCommitRollback } from './commit';
import { FiberTag, type Fiber, type Hook, type Effect } from '../core';
export function disconnectClass(fiber: Fiber, removing?: boolean): void {
    const instance = fiber.i?._f === fiber ? fiber.i : null;
    if (!instance)
        return;
    const props = instance.props, state = instance.state, committed = fiber.b?.c;
    if (committed) {
        instance.props = committed.p;
        instance.state = committed.s;
    }
    try {
        if (instance.componentWillUnmount && (!removing || !layoutIsDisconnected(fiber))) {
            invokeCommit(fiber, () => instance.componentWillUnmount());
        }
    }
    finally {
        if (!removing) {
            instance.props = props;
            instance.state = state;
        }
    }
    if (removing)
        instance._f = instance._q = instance._u = null;
}
export function inSuspensePrimary(fiber: Fiber): boolean {
    for (let child = fiber, parent = fiber.p; parent; child = parent, parent = parent.p) {
        if (parent.t === FiberTag.Suspense && parent.b?.d && parent.b.f !== child)
            return true;
    }
    return false;
}
export { walkRetained } from './walk';
export function rememberRetainedEffect(fiber: Fiber, hook: Hook, effect: Effect): void {
    let entries = fiber.ef;
    if (!entries) {
        fiber.ef = entries = new Map();
        onCommitRollback(() => { fiber.ef = undefined; });
    }
    const previous = entries.get(hook), target = entries;
    onCommitRollback(() => {
        if (previous)
            target.set(hook, previous);
        else
            target.delete(hook);
    });
    entries.set(hook, effect);
}
export function setRetainedFlag(fiber: Fiber, key: 'ld' | 'ad' | 'ah', disconnected: boolean): boolean {
    const previous = !!fiber[key];
    if (previous !== disconnected) {
        onCommitRollback(() => { fiber[key] = previous; });
        fiber[key] = disconnected;
    }
    return previous;
}
