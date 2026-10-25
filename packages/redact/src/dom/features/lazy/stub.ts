import { FiberTag, type Fiber } from '../../../core';
import { REACT_LAZY_TYPE } from '../../../react';
import { installRenderer, registerTypeMatcher, delegateFiber, isThenable, handleSuspended, } from '../../reconcile';
// Stub: Lazy feature disabled. Lazy elements still resolve — sync if the
// payload is ready, otherwise the thrown thenable goes through the default
// `handleSuspended` capability (retry-on-settle). What's stripped: the
// hydration-deferred-reveal pathway and the Suspense-awaiting coordination.
function renderLazyStub(fiber: Fiber): void {
    const { _payload, _init } = fiber.type as any;
    let resolved: any;
    try {
        resolved = _init(_payload);
    }
    catch (thrown: any) {
        if (isThenable(thrown)) {
            handleSuspended(fiber, thrown);
            return;
        }
        throw thrown;
    }
    delegateFiber(fiber, resolved);
}
registerTypeMatcher((_type, marker) => (marker === REACT_LAZY_TYPE ? FiberTag.Lazy : null));
installRenderer(FiberTag.Lazy, renderLazyStub);
