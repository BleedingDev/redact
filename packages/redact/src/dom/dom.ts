import { devToolsMetadata } from '../core/devtools';
import { formActions } from './form-actions';
import { attributeName, STRING_BOOLEAN_ATTRS } from '../core/attributes';
import { isString } from "../core/functions";
const SVG_NS = 'http://www.w3.org/2000/svg';
const BOOLEAN_ATTRS = /^(allowfullscreen|async|autofocus|autoplay|checked|controls|credentialless|default|defer|disabled|formnovalidate|hidden|inert|ismap|itemscope|loop|multiple|muted|nomodule|novalidate|open|playsinline|readonly|required|reversed|selected)$/;
const IDL_ATTRS = /^(value|checked|selected|disabled|multiple|muted|readonly)$/;
export const isSvgElement = (el: Element): boolean => ((el as any).ownerSVGElement !== undefined || el.tagName === 'svg');
export function setProp(el: Element, name: string, next: any, prev: any, isSvg: boolean): void {
    if (isReservedProp(name))
        return;
    // These names need no alias or boolean-attribute normalization.
    if (/^(aria|data)-./.test(name)) {
        if (next == null)
            el.removeAttribute(name);
        else
            el.setAttribute(name, '' + next);
        return;
    }
    if (name === 'action' || name === 'formAction') {
        if (isFunction(next)) {
            formActions.set(el, next);
            el.removeAttribute(name.toLowerCase());
            return;
        }
        formActions.delete(el);
    }
    // defaultValue / defaultChecked are IDL-property-only — they seed the
    // initial value/checked of a form control on first mount and must NOT be
    // emitted as HTML attributes (which would leak as `defaultValue="..."`).
    // Setting `el.defaultValue` on a fresh control also sets the initial
    // `el.value`, which is what consumers expect. Skip on hydrated DOM so we
    // don't clobber a live user-typed value.
    if (name === 'defaultValue' || name === 'defaultChecked') {
        if (prev === undefined && next != null) {
            try {
                ;
                (el as any)[name] = next;
            }
            catch { }
        }
        return;
    }
    if (name === 'className' && !isSvg) {
        ;
        (el as HTMLElement).className = next == null ? '' : '' + next;
        return;
    }
    if (name === 'style') {
        setStyle(el as HTMLElement, next, prev);
        return;
    }
    if (name === 'dangerouslySetInnerHTML') {
        const nextHtml = next?.__html ?? '';
        const prevHtml = prev?.__html ?? '';
        if (nextHtml !== prevHtml)
            (el as HTMLElement).innerHTML = nextHtml;
        return;
    }
    if (name[0] === 'o' && name[1] === 'n') {
        setEventHandler(el, name, next);
        return;
    }
    const attr = attributeName(name, isSvg);
    if (name === 'className' || name === 'class' || name === 'htmlFor' || STRING_BOOLEAN_ATTRS.test(attr)) {
        if (next != null)
            next = '' + next;
    }
    else {
        if (!isSvg && IDL_ATTRS.test(name) && name in el) {
            try {
                ;
                (el as any)[name] = next == null ? '' : next;
                return;
            }
            catch { }
        }
        if (BOOLEAN_ATTRS.test(attr))
            next = !!next;
    }
    if (next == null || next === false) {
        el.removeAttribute(attr);
    }
    else {
        el.setAttribute(attr, next === true ? '' : next);
    }
}
function setStyleProperty(style: CSSStyleDeclaration, key: string, value: any): void {
    if (key[0] === '-') {
        style.setProperty(key, value == null ? '' : '' + value);
    }
    else {
        ;
        (style as any)[key] = value == null || value === '' ? ''
            : typeof value === 'number' && !UNITLESS_STYLE.test(key) ? value + 'px' : '' + value;
    }
}
function setStyle(el: HTMLElement, next: any, prev: any): void {
    const style = el.style;
    if (isString(next)) {
        style.cssText = next;
        return;
    }
    if (isString(prev))
        style.cssText = '';
    if (prev && isObject(prev)) {
        for (const k in prev) {
            if (!next || !(k in next))
                setStyleProperty(style, k, '');
        }
    }
    if (next && isObject(next)) {
        for (const k in next) {
            if (!prev || prev[k] !== next[k])
                setStyleProperty(style, k, next[k]);
        }
    }
}
function setEventHandler(el: Element, name: string, next: any): void {
    // Only function handlers are accepted. Reject strings/objects/etc — the
    // legacy `onclick="..."` HTML attribute (string handler) is a known XSS
    // vector if a parent spreads untrusted props onto a host element. React
    // also ignores non-function handlers.
    const enabled = isFunction(next);
    const capture = name.endsWith('Capture') && !name.endsWith('PointerCapture');
    const lower = name.slice(2, capture ? -7 : undefined).toLowerCase();
    const events = lower === 'change' && (el.tagName === 'TEXTAREA' ||
        (el.tagName === 'INPUT' && !/^(checkbox|radio|file)$/.test((el as HTMLInputElement).type)))
        ? ['input', 'change']
        : [lower === 'focus' ? 'focusin' : lower === 'blur' ? 'focusout' : lower === 'doubleclick' ? 'dblclick' : lower];
    // Key by the React prop name (not DOM event name) so `onChange` and
    // `onInput` on the same text input — which both dispatch from the native
    // `input` event — can coexist without clobbering each other's handlers.
    const handlers = ((el as any).__h ||= Object.create(null));
    let existing = handlers[name];
    // Replace the listener when a control's type changes its native event.
    if (existing && (!enabled || existing.e[0] !== events[0])) {
        for (const event of existing.e)
            el.removeEventListener(event, existing, capture);
        existing = handlers[name] = null;
    }
    if (!enabled)
        return;
    if (!existing) {
        let inputValue: string | undefined;
        const entry = ((e: Event) => {
            if (events.length > 1) {
                const value = (el as HTMLInputElement).value;
                if (e.type === 'change' && inputValue === value)
                    return;
                inputValue = e.type === 'input' ? value : undefined;
            }
            // React hands handlers a SyntheticEvent that carries `.nativeEvent`.
            // Many libraries check `event.nativeEvent.isComposing` (react-instantsearch)
            // or `event.nativeEvent.shiftKey` (UI kits) — without the alias they throw
            // on `undefined.foo`. Aliasing the native event to itself is the cheapest
            // way to satisfy the shape without building a full synthetic layer.
            if ((e as any).nativeEvent === undefined)
                (e as any).nativeEvent = e;
            if (process.env.NODE_ENV !== 'production') {
                const previous = devToolsMetadata.current;
                devToolsMetadata.current = devToolsMetadata.hosts.get(el) || null;
                try { entry.c(e); } finally { devToolsMetadata.current = previous; }
            } else entry.c(e);
        }) as ((e: Event) => void) & {
            c: Function;
            e: string[];
        };
        entry.e = events;
        existing = handlers[name] = entry;
        for (const event of events)
            el.addEventListener(event, entry, capture);
    }
    existing.c = next;
}
const UNITLESS_STYLE = /^(animationIterationCount|borderImage(Outset|Slice|Width)|box(Flex(Group)?|OrdinalGroup)|column(Count|s)|flex(Grow|Positive|Shrink|Negative|Order)?|grid(Area|(Row|Column)(End|Span|Start)?)|fontWeight|line(Clamp|Height)|opacity|order|orphans|tabSize|widows|zIndex|zoom|(fill|flood|stop|stroke)Opacity|stroke(Dasharray|Dashoffset|Miterlimit|Width))$/;
export interface SyntheticEvent extends Event {
    nativeEvent: Event;
    isDefaultPrevented(): boolean;
    isPropagationStopped(): boolean;
    persist(): void;
    currentTarget: EventTarget & Element;
}
export function createHostNode(type: string, isSvg: boolean): Element {
    if (isSvg || type === 'svg') {
        return document.createElementNS(SVG_NS, type);
    }
    return document.createElement(type);
}
import { isObject } from '../core/functions';
import { isFunction, isReservedProp } from '../core/functions';
