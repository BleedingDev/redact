export async function getStaticProps() { return { props: { value: 'Generated static props' } } }
export default function Page({ value }) { return <h1>{value}</h1> }
