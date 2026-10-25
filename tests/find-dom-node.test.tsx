import { expect, it } from 'vitest'
import { act, Component, createRef, Fragment } from 'react'
import { createRoot } from 'react-dom/client'
import { __DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE as internals } from 'react-dom'

it('finds the first host child of a mounted class for Next scroll restoration', async () => {
  const container = document.createElement('div'), root = createRoot(container)
  const ref = createRef<Wrapper>()
  class Wrapper extends Component<{ children?: any }> { render() { return this.props.children } }
  const find = (internals as any).findDOMNode
  try {
    await act(() => root.render(<Wrapper ref={ref}><Fragment>{null}<span>First</span><span>Second</span></Fragment></Wrapper>))
    expect(find(ref.current)).toBe(container.firstChild)
    await act(() => root.render(<Wrapper ref={ref}>Text</Wrapper>))
    expect(find(ref.current)).toBe(container.firstChild)
    await act(() => root.render(<Wrapper ref={ref} />))
    expect(find(ref.current)).toBeNull()
    const instance = ref.current
    await act(() => root.unmount())
    expect(() => find(instance)).toThrow()
  } finally { await act(() => root.unmount()) }
})
