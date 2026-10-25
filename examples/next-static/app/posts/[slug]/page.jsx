import Link from 'next/link'

export function generateStaticParams() { return [{ slug: 'one' }, { slug: 'two' }] }
export async function generateMetadata({ params }) { return { title: `Post ${(await params).slug}` } }
export default async function Post({ params }) {
  const { slug } = await params
  return <main><h1>Post {slug}</h1><Link href="/posts/two/">Second post</Link><Link href="/">Home</Link></main>
}
