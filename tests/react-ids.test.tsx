import { expect, it, vi } from 'vitest'
import { Fragment, Suspense, useId, useState } from 'react'
import { hydrateRoot, createRoot } from '../packages/redact/src/next/client'
import { flushSync } from 'react-dom'

it('matches React tree IDs, local IDs, empty slots and prefixes during hydration', () => {
  function Field() { return <input id={useId()} aria-describedby={useId()} /> }
  const container = document.createElement('div')
  container.innerHTML = '<input id="_test-R_1_" aria-describedby="_test-R_1H1_"><input id="_test-R_3_" aria-describedby="_test-R_3H1_">'
  const nodes = [...container.children]
  const error = vi.fn()
  const root = hydrateRoot(container, [<Field key="a" />, null, <Field key="b" />], { identifierPrefix: 'test-', onRecoverableError: error })
  expect(error).not.toHaveBeenCalled()
  expect([...container.children]).toEqual(nodes)
  expect(nodes.map(node => node.id)).toEqual(['_test-R_1_', '_test-R_3_'])
  root.unmount()
})

it('retains hydrated IDs across updates and allocates unique IDs for new client children and roots', () => {
  let update!: (value: boolean) => void
  function Field() { return <input id={useId()} /> }
  function App() {
    const [extra, set] = useState(false)
    update = set
    return <><Field />{extra && <Field />}</>
  }
  const container = document.createElement('div')
  container.innerHTML = '<input id="_R_1_">'
  const root = hydrateRoot(container, <App />)
  flushSync(() => update(true))
  const ids = [...container.children].map(node => node.id)
  expect(ids[0]).toBe('_R_1_')
  expect(ids[1]).toMatch(/^_r_[0-9a-v]+_$/)
  const second = document.createElement('div')
  const otherRoot = createRoot(second)
  flushSync(() => otherRoot.render(<Field />))
  expect(second.firstElementChild!.id).not.toBe(ids[1])
  root.unmount()
  otherRoot.unmount()
})
