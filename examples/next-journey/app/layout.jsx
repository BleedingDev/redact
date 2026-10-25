import Link from 'next/link'
import { Icon } from './icons'
import Bridge from '../comparison/bridge'
import './globals.css'

export const metadata = { title: 'Fieldwork · Website launch', description: 'A Next.js user journey with React and Redact.' }

export default function Layout({ children }) {
  return <html lang="en"><body>
    <header className="app-header">
      <Link href="/" className="brand" aria-label="Fieldwork home"><span className="brand-icon"><Icon name="grid" /></span>Fieldwork</Link>
      <span className="workspace-name">Acme studio</span>
      <span className="avatar user" aria-label="You">JL</span>
    </header>
    {children}
    <Bridge />
  </body></html>
}
