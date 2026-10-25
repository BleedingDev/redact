import { expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'

it('keeps layout and SVG numbers unitless while adding units to lengths', () => {
  const container = document.createElement('div')
  const root = createRoot(container)
  root.render(<div style={{ gridColumnStart: 2, gridRowEnd: 4, flexShrink: 0, lineHeight: 1.5, width: 120, marginTop: 8 }}>
    <svg><path style={{ strokeWidth: 2, strokeOpacity: 0.5 }} /></svg>
  </div>)
  const style = (container.firstElementChild as HTMLElement).style
  expect(style.gridColumnStart).toBe('2')
  expect(style.gridRowEnd).toBe('4')
  expect(style.flexShrink).toBe('0')
  expect(style.lineHeight).toBe('1.5')
  expect(style.width).toBe('120px')
  expect(style.marginTop).toBe('8px')
  const path = container.querySelector('path')!
  expect(path.style.strokeWidth).toBe('2')
  expect(path.style.strokeOpacity).toBe('0.5')
  root.unmount()
})
