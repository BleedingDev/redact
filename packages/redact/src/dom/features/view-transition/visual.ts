import { FiberTag, type Fiber, type FiberRoot } from '../../../core';
import { REACT_VIEW_TRANSITION_TYPE, type ViewTransitionClass, type ViewTransitionInstance, type ViewTransitionProps, type ViewTransitionPseudoElement, } from '../../../react/view-transition';
import { isFunction } from '../../../core/functions';
import { transitionResources, type TransitionImages } from './resources';
type Kind = 'enter' | 'exit' | 'update' | 'share';
type Host = HTMLElement | SVGElement;
type Rect = [
    number,
    number,
    number,
    number
];
interface Boundary {
    f: Fiber;
    p: ViewTransitionProps;
    h: Host[];
    a: Fiber[];
    r: Fiber | null;
    n: string;
    e: boolean;
    s: Rect[];
    c: string;
    v: boolean;
}
interface Snapshot {
    b: Map<Fiber, Boundary>;
    v: Set<Fiber>;
    i: TransitionImages;
}
interface Capture {
    o?: Boundary | undefined;
    n?: Boundary | undefined;
    k: Kind;
    s: string;
    h: Host[];
    e: boolean;
}
interface Event {
    b: Boundary;
    k: Kind;
    n: string;
}
const names = new WeakMap<Fiber, string>();
const styleProperties = ['view-transition-name', 'view-transition-class'];
let nextName = 0;
function pseudo(doc: Document, kind: string, name: string): ViewTransitionPseudoElement {
    const scope = doc.documentElement;
    const selector = '::view-transition-' + kind + '(' + nativeName(name) + ')';
    return {
        animate(keyframes, options) {
            return scope.animate(keyframes, { ...(typeof options === 'number' ? { duration: options } : options), pseudoElement: selector });
        },
        getAnimations() {
            return scope.getAnimations({ subtree: true }).filter(animation => {
                const effect = animation.effect as KeyframeEffect | null;
                return effect?.target === scope && effect.pseudoElement === selector;
            });
        },
        getComputedStyle() { return doc.defaultView!.getComputedStyle(scope, selector); },
    };
}
// Ignore nested boundary content: its mutations belong to that boundary.
function contents(node: Node, nested: Set<Node>, first?: boolean): string {
    if (!first && nested.has(node))
        return '|';
    if (node.nodeType === 3)
        return JSON.stringify(node.nodeValue);
    if (node.nodeType !== 1)
        return '';
    const element = node as Host;
    let result = '<' + element.nodeName;
    for (const attribute of element.attributes) {
        if (attribute.name !== 'style')
            result += ' ' + attribute.name + '=' + JSON.stringify(attribute.value);
    }
    for (let i = 0; i < element.style.length; i++) {
        const property = element.style[i]!;
        if (property !== 'view-transition-name' && property !== 'view-transition-class') {
            result += ';' + property + ':' + element.style.getPropertyValue(property) + '!' + element.style.getPropertyPriority(property);
        }
    }
    if ('value' in element)
        result += '=' + (element as HTMLInputElement).value;
    if ('checked' in element)
        result += ':' + (element as HTMLInputElement).checked;
    result += '>';
    for (let child = node.firstChild; child; child = child.nextSibling)
        result += contents(child, nested);
    return result + '</' + element.nodeName + '>';
}
function className(props: ViewTransitionProps, kind: Kind, types: string[]): string | undefined {
    const value = byType(props[kind], types) ?? byType(props.default, types);
    return value === 'auto' ? undefined : value;
}
function snapshot(roots: FiberRoot[], doc: Document, types: string[], connected = true): Snapshot {
    const boundaries = new Map<Fiber, Boundary>();
    const visible = new Set<Fiber>();
    const images: TransitionImages = new Map();
    const allHosts = new Set<Node>();
    const empty: Boundary[] = [];
    const ancestors: Fiber[] = [];
    function walk(fiber: Fiber, parent: Fiber | null, pending: Boundary[]): void {
        if (fiber.u)
            return;
        if (fiber.type === REACT_VIEW_TRANSITION_TYPE) {
            const props: ViewTransitionProps = fiber.v ?? {};
            const explicitName = byType(props.name, types);
            let name = explicitName;
            if (name == null || name === 'auto') {
                name = names.get(fiber);
                if (!name)
                    names.set(fiber, name = '_redact_t_' + (++nextName).toString(32));
            }
            const boundary: Boundary = {
                f: fiber, p: props, h: [], a: ancestors.slice(), r: parent, n: name,
                e: explicitName != null && explicitName !== 'auto', s: [], c: '', v: false,
            };
            boundaries.set(fiber, boundary);
            pending = pending.concat(boundary);
            parent = fiber;
        }
        if (fiber.t === FiberTag.Host) {
            visible.add(fiber);
            const dom = fiber.n as Host | null;
            if (parent && fiber.type === 'img' && dom?.ownerDocument === doc) {
                images.set(dom as HTMLImageElement, fiber.v);
            }
            if (pending.length && dom?.ownerDocument === doc && (!connected || dom.isConnected) && dom.style) {
                for (const boundary of pending)
                    boundary.h.push(dom);
                allHosts.add(dom);
            }
            pending = empty;
            ancestors.push(fiber);
        }
        visibleChildren(fiber, child => walk(child, parent, pending));
        if (fiber.t === FiberTag.Host)
            ancestors.pop();
    }
    for (const root of roots)
        walk(root.r, null, empty);
    const view = doc.defaultView;
    if (connected)
        for (const boundary of boundaries.values()) {
            boundary.s = boundary.h.map(host => {
                const rect = host.getBoundingClientRect();
                return [rect.x, rect.y, rect.width, rect.height];
            });
            boundary.v = boundary.s.some(([x, y, width, height]) => width > 0 && height > 0 && x + width > 0 && y + height > 0 && x < (view?.innerWidth ?? Infinity) && y < (view?.innerHeight ?? Infinity));
            boundary.c = boundary.h.map(host => contents(host, allHosts, true)).join('');
        }
    return { b: boundaries, v: visible, i: images };
}
export function prepareViewTransition(rootIterable: Iterable<FiberRoot>, types: string[]): PreparedViewTransition | null {
    const roots = Array.from(rootIterable);
    const container = roots[0]?.c;
    const doc = (container?.ownerDocument || container) as Document | undefined;
    if (!doc?.documentElement)
        return null;
    const before = snapshot(roots, doc, types);
    const saved = new Map<Host, string[]>();
    const suppressed = new Set<string>();
    const events: Event[] = [];
    const cleanups: (() => void)[] = [];
    const captures: Capture[] = [];
    let done = false;
    let after: Snapshot;
    let resources: ReturnType<typeof transitionResources> | undefined;
    function apply(host: Host, name: string, classes?: string): void {
        let previous = saved.get(host);
        if (!previous)
            saved.set(host, previous = []);
        for (let index = 0; index < 2; index++) {
            const property = styleProperties[index]!;
            const offset = index * 3;
            const current = host.style.getPropertyValue(property);
            // A committed style prop may replace either temporary value.
            if (current !== previous[offset + 2]) {
                previous[offset] = current;
                previous[offset + 1] = host.style.getPropertyPriority(property);
            }
            const value = index ? classes === 'none' ? '' : classes ?? previous[offset]! : nativeName(name);
            host.style.setProperty(property, previous[offset + 2] = value, 'important');
        }
    }
    function applyHosts(hosts: Host[], name: string, props: ViewTransitionProps, kind: Kind): void {
        const classes = className(props, kind, types);
        hosts.forEach((host, index) => apply(host, index ? name + '_' + index : name, classes));
    }
    function suppress(hosts: Host[], name: string): void {
        hosts.forEach((_, index) => suppressed.add(index ? name + '_' + index : name));
    }
    function ownership(side: 'o' | 'n'): Map<Host, Capture> {
        const owners = new Map<Host, Capture>();
        for (const capture of captures) {
            if (side === 'n' && !capture.e)
                continue;
            for (const host of capture[side]?.h ?? [])
                owners.set(host, capture);
        }
        return owners;
    }
    function capture(kind: Kind, old?: Boundary, next?: Boundary, enabled = true): void {
        captures.push({ o: old, n: next, k: kind, s: (old ?? next)!.n, h: [], e: !!next && enabled });
    }
    function restore(): void {
        for (const [host, previous] of saved) {
            for (let index = 0; index < 2; index++) {
                const property = styleProperties[index]!;
                const offset = index * 3;
                if (host.style.getPropertyValue(property) === previous[offset + 2]) {
                    host.style.setProperty(property, previous[offset]!, previous[offset + 1]);
                }
            }
        }
        saved.clear();
    }
    function finish(): void {
        if (done)
            return;
        done = true;
        resources?.cancel();
        restore();
        let error: unknown;
        let failed = false;
        for (const cleanup of cleanups.splice(0)) {
            try {
                cleanup();
            }
            catch (caught) {
                if (!failed) {
                    error = caught;
                    failed = true;
                }
            }
        }
        if (failed)
            throw error;
    }
    return {
        document: doc,
        exclude(root) {
            const index = roots.indexOf(root);
            if (index >= 0)
                roots.splice(index, 1);
            for (const [fiber] of before.b)
                if (fiber.r === root)
                    before.b.delete(fiber);
        },
        prepare() {
            after = snapshot(roots, doc, types, false);
            resources = transitionResources(doc, before.i, after.i);
            return resources.before();
        },
        waitForResources(fontsWereLoaded) {
            if (!done)
                return resources?.after(fontsWereLoaded);
        },
        beforeCommit() {
            if (done)
                return false;
            const entering = new Map<string, Boundary>();
            const paired = new Set<Fiber>();
            for (const boundary of after.b.values()) {
                if (!before.b.has(boundary.f) && boundary.e)
                    entering.set(boundary.n, boundary);
            }
            for (const old of before.b.values()) {
                const current = after.b.get(old.f);
                if (current) {
                    if (className(current.p, 'update', types) !== 'none')
                        capture('update', old, current);
                }
                else {
                    const shared = old.e && old.v ? entering.get(old.n) : undefined;
                    if (shared) {
                        entering.delete(old.n);
                        if (className(old.p, 'share', types) !== 'none') {
                            paired.add(shared.f);
                            capture('share', old, shared, className(shared.p, 'share', types) !== 'none');
                        }
                    }
                    else if (topLevel(old, after, before) && old.v && className(old.p, 'exit', types) !== 'none') {
                        capture('exit', old);
                    }
                }
            }
            for (const boundary of after.b.values()) {
                if (before.b.has(boundary.f) || paired.has(boundary.f))
                    continue;
                if (topLevel(boundary, before, after) && className(boundary.p, 'enter', types) !== 'none') {
                    capture('enter', undefined, boundary);
                }
            }
            // A directly nested boundary owns updates; an outer presence boundary
            // owns entering/exiting hosts. Shared descendants take precedence.
            captures.sort((a, b) => (a.k === 'share' ? 2 : a.k === 'update' ? 0 : 1) - (b.k === 'share' ? 2 : b.k === 'update' ? 0 : 1));
            if (!captures.some(capture => capture.o?.h.length || (capture.e && capture.n?.h.length)))
                return false;
            const owners = ownership('o');
            apply(doc.documentElement, 'none');
            for (const boundary of before.b.values())
                for (const host of boundary.h)
                    apply(host, 'none');
            for (const capture of captures) {
                capture.h = capture.o?.h.filter(host => owners.get(host) === capture) ?? [];
                const props = capture.k === 'update' ? capture.n!.p : capture.o?.p;
                if (props)
                    applyHosts(capture.h, capture.s, props, capture.k);
            }
            return true;
        },
        afterCommit() {
            if (done)
                return;
            const after = snapshot(roots, doc, types);
            for (const capture of captures) {
                if (capture.n)
                    capture.n = after.b.get(capture.n.f);
                if (capture.k !== 'update' && !capture.n?.v)
                    capture.e = false;
            }
            const owners = ownership('n');
            for (const boundary of after.b.values())
                for (const host of boundary.h)
                    apply(host, 'none');
            for (const capture of captures) {
                const newHosts = capture.n?.h.filter(host => owners.get(host) === capture) ?? [];
                if (capture.n)
                    applyHosts(newHosts, capture.s, capture.n.p, capture.k);
                if (!capture.h.length && !newHosts.length)
                    continue;
                if (capture.k === 'update') {
                    if (capture.n && capture.o && changed(capture.o, capture.n))
                        events.push({ b: capture.n, n: capture.s, k: 'update' });
                    else
                        suppress(capture.h, capture.s);
                }
                else {
                    const boundary = capture.k === 'enter' ? capture.n : capture.o;
                    if (boundary)
                        events.push({ b: boundary, n: capture.s, k: capture.k });
                }
            }
        },
        ready() {
            if (done)
                return;
            // These captures were needed before the synchronous commit could tell
            // which boundaries changed. Cancel their native animations, not the DOM.
            const nativeSuppressed = new Set([...suppressed].map(nativeName));
            for (const animation of doc.documentElement.getAnimations({ subtree: true })) {
                const effect = animation.effect as KeyframeEffect | null;
                const selector = effect?.pseudoElement;
                if (effect?.target !== doc.documentElement || !selector)
                    continue;
                const start = selector.indexOf('(');
                if (start >= 0 && nativeSuppressed.has(selector.slice(start + 1, -1)))
                    animation.cancel();
            }
            for (const name of suppressed) {
                const animation = pseudo(doc, 'group', name).animate({ opacity: 0 }, { duration: 0, fill: 'forwards' });
                cleanups.push(() => animation.cancel());
            }
            let error: unknown;
            let failed = false;
            for (const event of events) {
                if (done)
                    break;
                const callback = event.b.p[('on' + event.k[0]!.toUpperCase() + event.k.slice(1)) as 'onEnter'];
                if (callback) {
                    try {
                        const cleanup = callback(instance(doc, event.n), types);
                        if (isFunction(cleanup)) {
                            if (done)
                                cleanup();
                            else
                                cleanups.push(cleanup);
                        }
                    }
                    catch (caught) {
                        if (!failed) {
                            error = caught;
                            failed = true;
                        }
                    }
                }
            }
            if (failed)
                throw error;
        },
        restore,
        finish,
        cancel: finish,
    };
}
function visibleChildren(fiber: Fiber, visit: (child: Fiber) => void): void {
    if (fiber.t === FiberTag.Activity && fiber.v?.mode === 'hidden')
        return;
    if (fiber.t === FiberTag.Suspense && fiber.b?.f) {
        visit(fiber.b.f);
        return;
    }
    for (let child = fiber.c; child; child = child.s)
        visit(child);
}
const nativeName = (name: string): string => (CSS.escape(name) === name ? name : CSS.escape('r-' + btoa(name).replace(/=/g, '')));
const instance = (doc: Document, name: string): ViewTransitionInstance => ({
    name,
    group: pseudo(doc, 'group', name),
    imagePair: pseudo(doc, 'image-pair', name),
    old: pseudo(doc, 'old', name),
    new: pseudo(doc, 'new', name),
});
function byType(value: ViewTransitionClass | undefined, types: string[]): string | undefined {
    if (isString(value))
        return value;
    if (!value)
        return undefined;
    let result: string | undefined;
    for (const type of types) {
        const match = value[type];
        if (match === 'none')
            return match;
        if (match != null)
            result = result == null ? match : result + ' ' + match;
    }
    return result ?? value.default;
}
const changed = (before: Boundary, after: Boundary): boolean => (before.c !== after.c || before.h.length !== after.h.length ||
    before.h.some((host, i) => host !== after.h[i] || before.s[i]!.some((value, axis) => value !== after.s[i]![axis])));
export interface PreparedViewTransition {
    document: Document;
    exclude(root: FiberRoot): void;
    prepare(): Promise<void> | undefined;
    waitForResources(fontsWereLoaded: boolean): Promise<void> | undefined;
    beforeCommit(): boolean;
    afterCommit(): void;
    ready(): void;
    restore(): void;
    finish(): void;
    cancel(): void;
}
function topLevel(boundary: Boundary, other: Snapshot, side: Snapshot): boolean {
    // An inserted/deleted host wrapper owns its subtree's enter/exit animation.
    if (boundary.a.some(fiber => !other.v.has(fiber)))
        return false;
    for (let parent = boundary.r; parent; parent = side.b.get(parent)?.r ?? null) {
        if (!other.b.has(parent))
            return false;
    }
    return true;
}
import { isString } from "../../../core/functions";
