import { FiberTag, type Fiber } from '../../../core';
import { REACT_MEMO_TYPE, } from '../../../react';
import { installRenderer, registerTypeMatcher, delegateFiber } from '../../reconcile';
// Stub: Memo feature disabled. `memo(Component)` still works — the element
// renders — but without the prop-equality gate, so every parent rerender
// passes through to the inner component. `shallowEqual` and the
// forceRerenderingFiber read are stripped.
function renderMemoStub(fiber: Fiber): void {
    const { type } = fiber.type as any;
    delegateFiber(fiber, type);
}
registerTypeMatcher((_type, marker) => (marker === REACT_MEMO_TYPE ? FiberTag.Memo : null));
installRenderer(FiberTag.Memo, renderMemoStub);
