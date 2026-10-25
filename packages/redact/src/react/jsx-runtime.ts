import { REACT_ELEMENT_TYPE, type Key, type ReactElement, type Ref } from '../core'
import { rememberDevToolsElement } from '../core/devtools'

export { Fragment } from './element'

export function jsx(type: any, props: any, key?: any): ReactElement {
  if (process.env.NODE_ENV !== 'production') return rememberDevToolsElement({
    $$typeof: REACT_ELEMENT_TYPE, type, key: key == null ? null : '' + key,
    ref: props?.ref ?? null, props,
  })
  return {
    $$typeof: REACT_ELEMENT_TYPE,
    type,
    key: key == null ? null : '' + key,
    ref: props?.ref ?? null,
    props,
  }
}

export const jsxs = jsx
export const jsxDEV = process.env.NODE_ENV !== 'production'
  ? (type: any, props: any, key?: any, _staticChildren?: boolean, source?: any) => {
      return rememberDevToolsElement({
        $$typeof: REACT_ELEMENT_TYPE, type, key: key == null ? null : '' + key,
        ref: props?.ref ?? null, props,
      }, source)
    }
  : jsx

// Permissive JSX namespace — picked up by TypeScript via the
// `jsxImportSource: "@tanstack/redact"` + `jsx: "react-jsx"` pair. The
// runtime accepts any element type and any props; matching that with strict
// element typings would require an entire React.dom.d.ts surface, which
// isn't a stated goal of redact (consumers who want strict JSX still alias
// `react`/`react-dom` types from the real packages).
export namespace JSX {
  export type Element = ReactElement
  export type ElementType = any
  export interface IntrinsicAttributes { key?: Key }
  export interface IntrinsicClassAttributes<T> { ref?: Ref<T> | undefined }
  export interface IntrinsicElements {
    [elemName: string]: any
  }
  export interface ElementChildrenAttribute {
    children: {}
  }
  export interface ElementAttributesProperty {
    props: {}
  }
}
