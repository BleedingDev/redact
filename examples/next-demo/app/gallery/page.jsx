import Link from 'next/link'
import Counter from '../counter'
export default function Gallery() { return <main><h1>Gallery</h1><Counter/><Link href="/gallery/photo/1">Open photo</Link></main> }
