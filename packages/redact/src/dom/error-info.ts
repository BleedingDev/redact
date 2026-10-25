import { isFunction } from '../core/functions'
import { FiberTag, type Fiber } from '../core'

export function componentStack(fiber: Fiber | null): string {
  let stack = ''
  for (; fiber; fiber = fiber.p) {
    let type = fiber.type
    while (type && isObject(type)) type = type.type || type.render
    const name = isString(type) ? type
      : isFunction(type) ? type.displayName || type.name || 'Anonymous'
      : fiber.t === FiberTag.Suspense ? 'Suspense'
      : fiber.t === FiberTag.Activity ? 'Activity' : ''
    if (name) stack += '\n    at ' + name
  }
  return stack
}

import { isString } from "../core/functions"

import { isObject } from '../core/functions'
