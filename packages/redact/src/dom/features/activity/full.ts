import { onCommitRollback, queueMutation } from '../../commit';
import { REACT_ACTIVITY_TYPE } from '../../../react/activity';
import { attachRef, childrenToArray, detachRef, enqueueEffect, findRoot, flushFiberCommits, getCurrentRoot, invokeCommit, installCapability, reconcileRaw, installRenderer, registerTypeMatcher, scheduleLifecycle, scheduleUpdate, } from '../../reconcile';
import { disconnectClass, inSuspensePrimary, setRetainedFlag, walkRetained as walk } from '../../retained-effects';
import { FiberTag, type Fiber } from '../../../core';
function isHidden(fiber: Fiber): boolean {
    if (!(fiber.r ?? findRoot(fiber))?.a)
        return false;
    for (let parent: Fiber | null = fiber; parent; parent = parent.p) {
        if (parent.t === FiberTag.Activity && parent.v?.mode === 'hidden')
            return true;
    }
    return false;
}
function renderActivity(fiber: Fiber): void {
    const root = fiber.r ?? findRoot(fiber);
    if (root)
        root.a = true;
    const props = fiber.v ?? {};
    // Hidden content is absent from server HTML. Mount it after hydration so it
    // cannot consume a following visible sibling's hydration cursor.
    if (getCurrentRoot()?.h && props.mode === 'hidden' && !fiber.m) {
        fiber.m = props;
        queueMicrotask(() => scheduleUpdate(fiber));
        return;
    }
    if (isHidden(fiber))
        walk(fiber, prepare);
    else
        walk(fiber, syncDom);
    reconcileRaw(fiber, props.children);
    walk(fiber, reconnect, true);
    fiber.m = props;
}
function needsHiddenDom(fiber: Fiber): boolean {
    for (let parent = fiber.p; parent; parent = parent.p) {
        if (parent.t === FiberTag.Activity && parent.v?.mode === 'hidden')
            return true;
        if (parent.t === FiberTag.Host)
            return false;
        // A portal starts a new DOM tree, but keeps the parent's Activity state.
        if (parent.t === FiberTag.Portal)
            return isHidden(parent);
    }
    return false;
}
function finish(fiber: Fiber): void {
    if (fiber.t === FiberTag.Suspense && (fiber.r ?? findRoot(fiber))?.a)
        walk(fiber, reconnect, true);
    else
        syncDom(fiber);
}
function prepare(fiber: Fiber): void {
    if (!isHidden(fiber) || !!fiber.ad)
        return;
    if (fiber.m == null)
        setRetainedFlag(fiber, 'ad', true);
    else
        disconnect(fiber);
}
function disconnect(fiber: Fiber): void {
    if (!!fiber.ad)
        return;
    setRetainedFlag(fiber, 'ad', true);
    queueMutation(() => {
        // Insertion effects remain connected, just as they do in React.
        const insertion = new Set<() => void>();
        for (const [hook, effect] of fiber.ef ?? []) {
            if (effect.t === 2 && hook.c)
                insertion.add(hook.c);
        }
        if (fiber.e) {
            const keep = fiber.e.filter(cleanup => insertion.has(cleanup));
            for (const cleanup of fiber.e) {
                if (!insertion.has(cleanup))
                    invokeCommit(fiber, cleanup);
            }
            fiber.e = keep.length ? keep : null;
        }
        for (const [hook, effect] of fiber.ef ?? []) {
            if (effect.t !== 2)
                hook.c = null;
        }
        detachRef(fiber.cr ?? fiber.ref);
        fiber.cr = null;
        fiber.rc = null;
        if (!fiber.ld)
            disconnectClass(fiber);
    });
}
function reconnect(fiber: Fiber): void {
    syncDom(fiber);
    if (isHidden(fiber) || inSuspensePrimary(fiber) || !setRetainedFlag(fiber, 'ad', false))
        return;
    setRetainedFlag(fiber, 'ld', false);
    const instance = fiber.i?._f === fiber ? fiber.i : null;
    if (fiber.t === FiberTag.Host || fiber.t === FiberTag.Resource)
        attachRef(fiber, fiber.n);
    else if (instance || fiber.t === FiberTag.Fragment)
        attachRef(fiber, fiber.i);
    for (const effect of fiber.ef?.values() ?? []) {
        if (effect.t !== 2)
            enqueueEffect(fiber, effect);
    }
    if (instance?.componentDidMount) {
        scheduleLifecycle(fiber, () => instance.componentDidMount());
    }
    flushFiberCommits(fiber);
}
function syncDom(fiber: Fiber): void {
    if (!(fiber.r ?? findRoot(fiber))?.a)
        return;
    if (!fiber.n || (fiber.t !== FiberTag.Host && fiber.t !== FiberTag.Text))
        return;
    if (needsHiddenDom(fiber)) {
        setRetainedFlag(fiber, 'ah', true);
        queueMutation(() => {
            if (fiber.t === FiberTag.Text)
                fiber.n!.nodeValue = '';
            else
                (fiber.n as HTMLElement).style.setProperty('display', 'none', 'important');
        });
    }
    else if (setRetainedFlag(fiber, 'ah', false)) {
        // A Suspense fallback can remain active after its Activity is revealed.
        // Its preserved primary DOM must stay hidden until that boundary resumes.
        for (let parent = fiber.p; parent; parent = parent.p) {
            if (parent.t === FiberTag.Suspense && parent.b?.d?.some(([node]: [
                Node,
                string
            ]) => node === fiber.n))
                return;
        }
        const props = fiber.v;
        queueMutation(() => {
            if (fiber.t === FiberTag.Text)
                fiber.n!.nodeValue = props;
            else {
                const display = props?.style?.display;
                (fiber.n as HTMLElement).style.display = display == null || typeof display === 'boolean' ? '' : ('' + display).trim();
            }
        });
    }
}
installCapability('i', isHidden);
installCapability('d', fiber => !!fiber.ad);
installCapability('p', prepare);
installCapability('s', finish);
registerTypeMatcher(type => type === REACT_ACTIVITY_TYPE ? FiberTag.Activity : null);
installRenderer(FiberTag.Activity, renderActivity);
