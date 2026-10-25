import { FiberTag, type Fiber } from '../../../core';
import { REACT_MEMO_TYPE, } from '../../../react';
import { installRenderer, registerTypeMatcher, delegateFiber, getForceRerenderingFiber, } from '../../reconcile';
import { ownContextChanged, renderContextConsumers } from '../context';
import { resolveRefreshMemo } from '../../refresh';
function shallowEqual(a: any, b: any): boolean {
    if (a === b)
        return true;
    if (!a || !b)
        return false;
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length)
        return false;
    for (const k of ak) {
        if (a[k] !== b[k])
            return false;
    }
    return true;
}
function renderMemo(fiber: Fiber): void {
    const { type, compare } = process.env.NODE_ENV !== 'production' ? resolveRefreshMemo(fiber.type) : fiber.type as any;
    const props = fiber.v ?? {};
    const prev = fiber.m;
    // Memo's prop-equality gate guards PARENT-triggered rerenders. If this
    // render is a STATE-triggered rerender of this exact fiber (hook update,
    // useSyncExternalStore notification), props haven't changed by definition —
    // bailing would swallow the state change and the subscriber never re-runs.
    // rerenderFiber tags the fiber so we skip the gate here.
    const bypassMemo = fiber.g || fiber === getForceRerenderingFiber();
    const eq = !bypassMemo && prev && (compare ? compare(prev, props) : shallowEqual(prev, props));
    if (eq && !ownContextChanged(fiber)) {
        renderContextConsumers(fiber);
        return;
    }
    delegateFiber(fiber, type);
}
registerTypeMatcher((_type, marker) => (marker === REACT_MEMO_TYPE ? FiberTag.Memo : null));
installRenderer(FiberTag.Memo, renderMemo);
