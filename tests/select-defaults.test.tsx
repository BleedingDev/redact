import { afterEach, expect, it } from 'vitest'
import * as React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'

const cleanups: Array<() => void> = []
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup() })
function Form(props: any) {
  return <form><select {...props}><option value="a" disabled>A</option><option value="b">B</option><option value="c">C</option><option value="d">D</option></select></form>
}
function mount(props: any) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const render = (next: any) => flushSync(() => root.render(<Form {...next} />))
  render(props)
  cleanups.push(() => { flushSync(() => root.unmount()); container.remove() })
  return { render, select: container.querySelector('select')!, form: container.querySelector('form')! }
}
const values = (select: HTMLSelectElement) => [...select.options].filter(option => option.selected).map(option => option.value)

it('retains the initial uncontrolled default across prop updates and native form resets', () => {
  const { select, form, render } = mount({ defaultValue: 'c' })
  expect(select.options[2]!.defaultSelected).toBe(true)
  select.value = 'd'
  render({ defaultValue: 'b' })
  expect(select.value).toBe('d')
  form.reset()
  expect(select.value).toBe('c')
  render({})
  expect(select.value).toBe('c')
})

it('preserves multiple-selection defaults without overwriting a user edit on rerender', () => {
  const { select, form, render } = mount({ multiple: true, defaultValue: ['b', 'd'] })
  expect(values(select)).toEqual(['b', 'd'])
  expect([...select.options].filter(option => option.defaultSelected).map(option => option.value)).toEqual(['b', 'd'])
  select.options[1]!.selected = false
  select.options[2]!.selected = true
  render({ multiple: true, defaultValue: ['c'] })
  expect(values(select)).toEqual(['c', 'd'])
  expect([...select.options].filter(option => option.defaultSelected).map(option => option.value)).toEqual(['b', 'd'])
  form.reset()
  expect(values(select)).toEqual(['b', 'd'])
})

it.each([false, true])('falls back to the first enabled option for an unmatched single value, controlled=%s', controlled => {
  const { select } = mount(controlled ? { value: 'missing', onChange() {} } : { defaultValue: 'missing' })
  expect(select.value).toBe('b')
})

it('uses explicit multiple changes to reinitialize uncontrolled selection', () => {
  const { select, render } = mount({ defaultValue: 'c' })
  render({ multiple: true, defaultValue: ['b', 'd'] })
  expect(values(select)).toEqual(['b', 'd'])
  render({ defaultValue: 'b' })
  expect(values(select)).toEqual(['b'])
  render({ multiple: true })
  expect(values(select)).toEqual([])
  render({})
  expect(values(select)).toEqual(['b'])
})

it('updates controlled values without assigning uncontrolled defaults', () => {
  const { select, render } = mount({ value: 'b', onChange() {} })
  render({ value: 'd', onChange() {} })
  expect(select.value).toBe('d')
  expect([...select.options].some(option => option.defaultSelected)).toBe(false)
  render({ multiple: true, value: ['b', 'c'], onChange() {} })
  expect(values(select)).toEqual(['b', 'c'])
  render({ multiple: true, value: ['d'], onChange() {} })
  expect(values(select)).toEqual(['d'])
})

it('preserves a pre-hydration selection and its server default through subsequent prop updates', async () => {
  const container = document.createElement('div')
  container.innerHTML = '<form><select><option value="a" disabled>A</option><option value="b">B</option><option value="c" selected>C</option><option value="d">D</option></select></form>'
  document.body.appendChild(container)
  const select = container.querySelector('select')!
  select.value = 'd'
  let mounted!: () => void
  const ready = new Promise<void>(resolve => { mounted = resolve })
  function App({ value }: { value: string }) { React.useLayoutEffect(mounted, []); return <Form defaultValue={value} /> }
  const root = hydrateRoot(container, <App value="c" />)
  cleanups.push(() => { flushSync(() => root.unmount()); container.remove() })
  await ready
  expect(container.querySelector('select')).toBe(select)
  expect(select.value).toBe('d')
  flushSync(() => root.render(<App value="b" />))
  expect(select.value).toBe('d')
  container.querySelector('form')!.reset()
  expect(select.value).toBe('c')
})
