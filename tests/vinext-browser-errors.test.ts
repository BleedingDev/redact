import { describe, expect, it } from 'vitest'
// @ts-expect-error The shared browser gate is a native Node ESM script.
import { isExpectedVinextBoundaryLog } from '../scripts/vinext-browser-errors.mjs'

describe('Vinext deliberate boundary diagnostics', () => {
  it('recognizes the stack-only formats emitted by Chromium, Firefox, and WebKit', () => {
    for (const stack of [
      '    at Page (http://localhost:4530/app/fail/page.jsx:12:20)\n    at body',
      'Page@http://localhost:4530/app/fail/page.jsx:12:20\nbody@unknown:0:0',
      '@http://localhost:4530/_next/static/chunks/page.js:1:40',
      'AwaitAppRenderDependencies [Server]@unknown:0:0\nAppRouterScrollTargetInner@\nQa@',
    ]) {
      const message = 'The above error occurred in a React component:\n\n' + stack
      expect(isExpectedVinextBoundaryLog(message)).toBe(true)
      expect(isExpectedVinextBoundaryLog(message.replace(/\n/g, '\\n'))).toBe(true)
    }
  })
  it('does not classify errors, incomplete traces, or unrelated resource failures as stack-only output', () => {
    for (const message of [
      'Unexpected renderer error',
      'The above error occurred in a React component:\n\n',
      'The above error occurred in a React component:\n    at Page\nUnexpected renderer error',
      'The above error occurred in a React component:\nError: wrong state',
      'The above error occurred in a React component:\nUnexpected error@',
      'The above error occurred in a React component:\n@',
      'Failed to load resource: the server responded with a status of 404 ()',
      'Failed to load resource: the server responded with a status of 500 ()\nUnexpected error',
    ]) expect(isExpectedVinextBoundaryLog(message)).toBe(false)
    expect(isExpectedVinextBoundaryLog('Failed to load resource: the server responded with a status of 500 ()')).toBe(true)
  })
})


it('accepts hosted Firefox stacks only from the explicitly verified application origin', () => {
  const origin = 'https://redact-preview.example'
  const message = `The above error occurred in a React component:\n\nPage@${origin}/_next/static/chunks/page.js:1:40\nbody@unknown:0:0`
  expect(isExpectedVinextBoundaryLog(message, origin)).toBe(true)
  expect(isExpectedVinextBoundaryLog(message)).toBe(false)
  expect(isExpectedVinextBoundaryLog(message, 'https://another.example')).toBe(false)
  expect(isExpectedVinextBoundaryLog(message.replace('https:', 'http:'), origin)).toBe(false)
  expect(isExpectedVinextBoundaryLog(message + '\nUnexpected renderer error', origin)).toBe(false)
})
