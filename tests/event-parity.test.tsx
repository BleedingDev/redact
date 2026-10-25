import { expect, it } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

it('rebinds change handlers when an input switches between text and checkbox', () => {
  const container = document.createElement('div'), root = createRoot(container)
  const calls: string[] = []
  const render = (type: string, label: string) => act(() => root.render(<input type={type} onChange={() => calls.push(label)} />))
  render('text', 'text')
  const input = container.querySelector('input')!
  input.value = 'value'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  render('checkbox', 'checkbox')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  render('text', 'text again')
  input.value = 'value'
  input.dispatchEvent(new Event('change', { bubbles: true }))
  render('text', 'replacement')
  input.dispatchEvent(new Event('input', { bubbles: true }))
  expect(calls).toEqual(['text', 'checkbox', 'text again', 'replacement'])
  act(() => root.render(<input type="text" />))
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  expect(calls).toHaveLength(4)
  root.unmount()
})

it('rebinds stable change callbacks after the input type changes', () => {
  const container = document.createElement('div'), root = createRoot(container)
  const calls: string[] = []
  const change = (event: any) => calls.push(event.target.type)
  const capture = (event: any) => calls.push('capture:' + event.target.type)
  const render = (type: string) => act(() => root.render(<input onChange={change} onChangeCapture={capture} type={type} />))
  try {
    render('text')
    const input = container.querySelector('input')!
    input.value = 'first'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    render('checkbox')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(calls).toEqual(['capture:text', 'text'])
    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(calls).toEqual(['capture:text', 'text', 'capture:checkbox', 'checkbox'])
    render('text')
    input.value = 'second'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(calls).toEqual(['capture:text', 'text', 'capture:checkbox', 'checkbox', 'capture:text', 'text'])
  } finally { act(() => root.unmount()) }
})

it('distinguishes pointer capture event names from capture-phase suffixes', () => {
  const container = document.createElement('div'), root = createRoot(container)
  const calls: string[] = []
  act(() => root.render(<div onGotPointerCaptureCapture={() => calls.push('capture')} onGotPointerCapture={() => calls.push('got')} onLostPointerCapture={() => calls.push('lost')} />))
  container.firstElementChild!.dispatchEvent(new Event('gotpointercapture', { bubbles: true }))
  container.firstElementChild!.dispatchEvent(new Event('lostpointercapture', { bubbles: true }))
  expect(calls).toEqual(['capture', 'got', 'lost'])
  root.unmount()
})

it('bubbles focus and blur in capture and bubble order', () => {
  const container = document.createElement('div'), root = createRoot(container)
  const calls: string[] = []
  act(() => root.render(<div onFocusCapture={() => calls.push('capture')} onFocus={() => calls.push('parent focus')} onBlur={() => calls.push('parent blur')}><input onFocus={() => calls.push('child focus')} onBlur={() => calls.push('child blur')} /></div>))
  const input = container.querySelector('input')!
  input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  expect(calls).toEqual(['capture', 'child focus', 'parent focus', 'child blur', 'parent blur'])
  root.unmount()
})

it('accepts native change for text fields without duplicating an input notification', () => {
  const container = document.createElement('div'), root = createRoot(container)
  const calls: string[] = []
  const handler = (event: any) => calls.push(event.target.value)
  act(() => root.render(<input onChange={handler} />))
  const input = container.querySelector('input')!
  input.value = 'first'
  input.dispatchEvent(new Event('change', { bubbles: true }))
  input.value = 'second'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
  expect(calls).toEqual(['first', 'second'])
  act(() => root.render(<input />))
  input.value = 'removed'
  input.dispatchEvent(new Event('change', { bubbles: true }))
  expect(calls).toEqual(['first', 'second'])
  root.unmount()
})
