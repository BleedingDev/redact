import { FiberTag, type Fiber } from '../core'

export function walkRetained(fiber: Fiber, visit: (fiber: Fiber) => void, postorder?: boolean): void {
  if (!postorder) visit(fiber)
  for (let child = fiber.c; child; child = child.s) walkRetained(child, visit, postorder)
  if (fiber.t === FiberTag.Suspense && fiber.b?.f) walkRetained(fiber.b.f, visit, postorder)
  if (postorder) visit(fiber)
}
