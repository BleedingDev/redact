import Counter from './counter'
import './style.css'

export const metadata = { title: 'Static Redact' }

export default function Layout({ children }) {
  return <html><body><Counter />{children}</body></html>
}
