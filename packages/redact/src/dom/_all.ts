// Unified entry exposing both top-level public API (createRoot, hydrateRoot,
// createPortal, …) and the registration primitives that custom features and
// custom bundler plugins need to hook into the reconciler. Reachable as
// `@tanstack/redact/_all` via the package's subpath exports. Single-instance
// state for things like the hydration CLAIMED WeakSet, scheduler queue,
// dispatcher H slot, etc. is preserved because every public entry funnels
// through this module.
// Side-effect import: registers all opt-in features (renderers, type matchers,
// element markers) with the reconciler. A vite plugin may alias individual
// feature modules to ./features/<name>/stub to strip them from the bundle.
import './features';
// Top-level public API (mirrors the surface of /, /dom, /dom-client).
export { flushSync, batchedUpdates as unstable_batchedUpdates } from './root';
export { createRoot, hydrateRoot } from './root';
export type { Root, RootOptions } from './root';
export { createPortal } from './portal';
export { act } from './test-utils';
export { preconnect, prefetchDNS, preload, preinit, preloadModule, preinitModule } from './resource-hints';
export const version = '19.2.3';
// Registration primitives — needed by custom features
// (`installRenderer`, `registerTypeMatcher`, `registerElementMarker`) and by
// anything that wants to override a cross-cutting concern like Suspense's
// `handleSuspended` or Context's `readContext` (`installCapability`). The
// built-in features in `./features/*/{full,stub}.ts` use these via relative
// imports; external authors reach them through this entry. Order-of-
// registration matters: later calls overwrite earlier ones.
export { registerTypeMatcher, registerElementMarker, reconcileChildren, childrenToArray, } from './reconcile';
export type { TypeMatcher, } from './reconcile';
import { installCapability as install, type Capabilities as InternalCapabilities } from './reconcile';
const capabilityKeys = {
    handleSuspended: 'h', readContext: 'c', isActivityHidden: 'i',
    activityIsDisconnected: 'd', prepareActivityFiber: 'p', syncActivity: 's',
} as const;
export type Capabilities = {
    [K in keyof typeof capabilityKeys]: InternalCapabilities[(typeof capabilityKeys)[K]];
};
// Keep extension names stable while ordinary bundles use compact private keys.
export function installCapability<K extends keyof Capabilities>(name: K, fn: Capabilities[K]): void {
    install(capabilityKeys[name], fn as InternalCapabilities[(typeof capabilityKeys)[K]]);
}
// Core types most custom features need.
export { FiberTag } from '../core';
export type { Fiber, FiberRoot, ReactNode, ReactElement } from '../core';
import { installRenderer, getHostParent, getAnchor } from "./reconcile";
export type RenderFn = (fiber: import("../core").Fiber, parent: Node, anchor: Node | null) => void;
export function registerRenderer(tag: import("../core").FiberTag, fn: RenderFn): void { installRenderer(tag, fiber => { const parent = getHostParent(fiber); fn(fiber, parent, getAnchor(fiber, parent)); }); }
