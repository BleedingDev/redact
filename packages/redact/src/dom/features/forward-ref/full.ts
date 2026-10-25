import { FiberTag, type Fiber } from '../../../core';
import { REACT_FORWARD_REF_TYPE } from '../../../react';
import { installRenderer, registerTypeMatcher, renderFunction } from '../../reconcile';
function renderForwardRef(fiber: Fiber): void {
    const { ref, ...props } = fiber.v ?? {};
    renderFunction(fiber, fiber.type.render, props, fiber.ref ?? ref ?? null);
}
registerTypeMatcher((_type, marker) => marker === REACT_FORWARD_REF_TYPE ? FiberTag.ForwardRef : null);
installRenderer(FiberTag.ForwardRef, renderForwardRef);
