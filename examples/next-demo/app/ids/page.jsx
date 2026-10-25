'use client'
import { Fragment, Suspense, useEffect, useId, useState } from 'react'

function Field({ name, children }) {
  const id = useId()
  const description = useId()
  return <section><label htmlFor={id}>{name}</label><input id={id} aria-describedby={description}/><p id={description}>{name} description</p>{children}</section>
}
function Nested({ depth }) { return depth ? <div>{null}<Nested depth={depth - 1}/></div> : <Field name="Deep"/> }
export default function IDs() {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  return <main data-ready={ready}><Field name="Parent"><Field name="Child"/></Field>{null}<Field name="Sibling"/><Suspense fallback={null}><Field name="Suspense"/></Suspense><Fragment><Field name="Fragment"/>{false}<Field name="After empty"/></Fragment>{[[<Field key="array" name="Nested array"/>]]}<Nested depth={40}/></main>
}
