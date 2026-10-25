import { FiberTag, type Fiber } from '../../../core';
import { REACT_ACTIVITY_TYPE } from '../../../react/activity';
import { childrenToArray, reconcileRaw, installRenderer, registerTypeMatcher } from '../../reconcile';
// Explicit small-preset downgrade: hidden children unmount instead of being
// retained. Showing them again creates fresh state, DOM, effects, and refs.
function renderActivity(fiber: Fiber): void {
    const props = fiber.v ?? {};
    reconcileRaw(fiber, props.mode === 'hidden' ? null : props.children);
    fiber.m = props;
}
registerTypeMatcher(type => type === REACT_ACTIVITY_TYPE ? FiberTag.Activity : null);
installRenderer(FiberTag.Activity, renderActivity);
