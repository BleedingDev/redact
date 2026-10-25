import Link from 'next/link'
export default function Loading() { return <><p>Loading slow route</p><Link href="/routing/three" prefetch={false}>Cancel slow route</Link></> }
