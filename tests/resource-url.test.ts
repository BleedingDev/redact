import { describe, expect, it } from 'vitest'
import { resourceURL } from '../packages/redact/src/core/resource-hints'

const blocked = "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')"

describe('resource URL sanitization', () => {
  it('blocks every leading ASCII control character and space', () => {
    for (let code = 0; code <= 32; code++) {
      expect(resourceURL(String.fromCharCode(code) + 'JaVaScRiPt:alert(1)')).toBe(blocked)
    }
  })

  it('blocks tabs and line breaks at every position in a javascript scheme', () => {
    const scheme = 'JaVaScRiPt:'
    for (const separator of ['\t', '\r', '\n', '\r\n\t']) {
      for (let index = 0; index < scheme.length; index++) {
        expect(resourceURL(scheme.slice(0, index) + separator + scheme.slice(index) + 'alert(1)')).toBe(blocked)
      }
      expect(resourceURL([...scheme].join(separator) + 'alert(1)')).toBe(blocked)
    }
  })

  it('preserves safe URLs exactly, including whitespace outside the scheme', () => {
    for (const value of [
      'https://resource.test/javascript:module.js',
      '/javascript:module.js',
      './javascript:module.js',
      'https://resource.test/?q=\tjavascript:\nvalue',
      'data:text/plain,javascript:alert(1)',
      'java script:module.js',
      'java\u0000script:module.js',
      'java\u200bscript:module.js',
      '',
    ]) expect(resourceURL(value)).toBe(value)
  })
})
