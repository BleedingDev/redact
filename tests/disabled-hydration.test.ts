import { expect, it } from 'vitest'
import { abortHydration, beginHydration, isHydrationBailout, recoverHydration } from '../packages/redact/src/dom/features/hydration/stub'

it('rejects hydration while preserving the original error when recovery is disabled', () => {
  expect(() => beginHydration(null as any)).toThrow('requires the `hydration` feature')
  for (const cause of [new Error('original'), { reason: 'original' }, null, undefined]) {
    let thrown = false
    try { abortHydration(cause) } catch (error) { thrown = true; expect(error).toBe(cause) }
    expect(thrown).toBe(true)
    expect(isHydrationBailout(cause)).toBe(false)
    expect(recoverHydration(null as any, cause)).toBe(false)
  }
})
