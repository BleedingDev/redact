'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Script from 'next/script'
import styles from './page.module.css'
const LazyCounter = dynamic(() => import('./lazy-counter'), { ssr: false, loading: () => <p>Loading dynamic component</p> })
const Context = createContext('default')
function Portal({ close }) { return createPortal(<div role="dialog" aria-label="Portal"><p>{useContext(Context)}</p><button onClick={close}>Close portal</button></div>, document.body) }
export default function Components() {
  const [ready, setReady] = useState(false), [open, setOpen] = useState(false), [scriptReady, setScriptReady] = useState(false), [imageReady, setImageReady] = useState(false)
  useEffect(() => setReady(true), [])
  return <Context.Provider value="Context through portal"><main data-ready={ready} className={styles.panel}><h1>Next components</h1><LazyCounter/><button onClick={() => setOpen(true)}>Open portal</button>{open && <Portal close={() => setOpen(false)}/>}<Image src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/pixel.png`} width={16} height={16} alt="Fixture image" onLoad={() => setImageReady(true)}/><p data-testid="image-ready">{String(imageReady)}</p><Script id="fixture-script" onReady={() => setScriptReady(true)}>{`window.nextFixtureScript = (window.nextFixtureScript || 0) + 1`}</Script><p data-testid="script-ready">{String(scriptReady)}</p></main></Context.Provider>
}
