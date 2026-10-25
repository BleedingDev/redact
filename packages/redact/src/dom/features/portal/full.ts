import { FiberTag, type Fiber, type ReactNode } from '../../../core';
import { REACT_PORTAL_TYPE } from '../../../react';
import { installRenderer, registerTypeMatcher, registerElementMarker, reconcileRaw, childrenToArray, } from '../../reconcile';
function renderPortal(fiber: Fiber): void {
    const { children } = fiber.v as {
        children: ReactNode;
        container: Element;
    };
    reconcileRaw(fiber, children);
    fiber.m = fiber.v;
}
registerElementMarker(REACT_PORTAL_TYPE);
registerTypeMatcher((type) => (type === REACT_PORTAL_TYPE ? FiberTag.Portal : null));
installRenderer(FiberTag.Portal, renderPortal);
